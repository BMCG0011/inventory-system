import { config } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@/server/api/routers/_app";
import { auth } from "@/server/auth";
import { prisma } from "@/server/lib/prisma";
import { createContext } from "@/server/trpc";
import { HTTPException } from "hono/http-exception";
import { logger as honoLogger } from "hono/logger";
import { logger } from "@/server/lib/logger";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "trpc-to-mcp";
import { basicAuth } from "hono/basic-auth";
import { collectMetrics } from "./metrics";
import {
    handleStatusJson,
    handleComponentsJson,
    handleUnresolvedIncidents,
} from "./health";
import sharp from "sharp";
import {
    uploadFile,
    buildItemImageKey,
    buildAvatarKey,
    deleteFile,
    fileExists,
    downloadFile,
} from "@/server/lib/s3";
import { mountExternalApiRoutes } from "./external-api";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

// Load environment variables
config();

// ─── Process exit diagnostics ────────────────────────────────────────────────
// Log WHY the process is dying so we can debug container restarts.
process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection");
});
process.on("SIGTERM", () => {
    logger.info("SIGTERM received — shutting down gracefully");
    prisma.$disconnect().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
    logger.info("SIGINT received — shutting down gracefully");
    prisma.$disconnect().finally(() => process.exit(0));
});
process.on("exit", (code) => logger.info({ code }, "Process exiting"));

// Initialize Hono app
const app = new Hono();

app.use(honoLogger());

app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// ─── Statuspage-compatible health API ─────────────────────────────────────────
app.get("/api/v2/status.json", () => handleStatusJson());
app.get("/api/v2/components.json", () => handleComponentsJson());
app.get("/api/v2/incidents/unresolved.json", () => handleUnresolvedIncidents());

// Apply CORS middleware
app.use(
    "/api/*",
    cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
        credentials: true,
        maxAge: 86400, // 24 hours
    }),
);

//app.use('/*', serveStatic({ root: './dist' })); // Add this to serve dist/

// Handle authentication routes
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const start = Date.now();
    logger.debug({ method, path }, "auth request started");
    try {
        const response = await auth.handler(c.req.raw);
        logger.debug(
            { method, path, status: response.status, ms: Date.now() - start },
            "auth request completed",
        );
        return response;
    } catch (error) {
        logger.error(
            { method, path, ms: Date.now() - start, err: error },
            "auth request threw",
        );
        throw new HTTPException(500, {
            message: "Authentication processing failed",
        });
    }
});

// tRPC route
app.use(
    "/api/trpc/*",
    trpcServer({
        endpoint: "/api/trpc",
        router: appRouter,
        createContext,
        onError: ({ error, path }) => {
            logger.error({ path, err: error }, "tRPC error");
        },
    }),
);

//app.get('*', serveStatic({ path: './dist/index.html' }));
// Global error handler
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({ error: err.message }, err.status);
    }
    logger.error({ err }, "Unexpected error");
    return c.json({ error: "Internal server error" }, 500);
});

// ─── Item image proxy ─────────────────────────────────────────────────────────
app.get("/api/items/:id/image", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }

    const itemId = c.req.param("id");
    const item = await prisma.item.findUnique({
        where: { id: itemId, deleted: false },
        select: { image: true },
    });
    if (!item?.image) {
        throw new HTTPException(404, { message: "No image" });
    }

    const bytes = await downloadFile(item.image);
    return new Response(bytes, {
        headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "private, max-age=3600",
        },
    });
});

// ─── Item image upload ────────────────────────────────────────────────────────
app.post("/api/items/:id/image", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }
    if (session.user.role !== "admin") {
        throw new HTTPException(403, { message: "Admin only" });
    }

    const itemId = c.req.param("id");
    const item = await prisma.item.findUnique({
        where: { id: itemId, deleted: false },
        select: { id: true, image: true },
    });
    if (!item) {
        throw new HTTPException(404, { message: "Item not found" });
    }

    const formData = await c.req.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
        throw new HTTPException(400, { message: "Missing image field" });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new HTTPException(400, {
            message: "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
        });
    }

    const rawBytes = await file.arrayBuffer();
    if (rawBytes.byteLength > MAX_IMAGE_BYTES) {
        throw new HTTPException(413, { message: "Image exceeds 10 MB limit" });
    }

    const webpBuffer = await sharp(Buffer.from(rawBytes))
        .rotate()
        .resize({
            width: 1200,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

    const key = buildItemImageKey(itemId);
    await uploadFile(key, webpBuffer, "image/webp");

    await prisma.item.update({
        where: { id: itemId },
        data: { image: key },
    });

    return c.json({ ok: true, key });
});

// ─── Apply item image to all same-name items ─────────────────────────────────
app.post("/api/items/:id/image/apply-to-group", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }
    if (session.user.role !== "admin") {
        throw new HTTPException(403, { message: "Admin only" });
    }

    const itemId = c.req.param("id");
    const source = await prisma.item.findUnique({
        where: { id: itemId, deleted: false },
        select: { id: true, name: true, image: true },
    });
    if (!source) {
        throw new HTTPException(404, { message: "Item not found" });
    }
    if (!source.image) {
        throw new HTTPException(400, { message: "Source item has no image" });
    }

    const siblings = await prisma.item.findMany({
        where: { name: source.name, deleted: false, id: { not: itemId } },
        select: { id: true, image: true },
    });

    if (siblings.length === 0) {
        return c.json({ ok: true, updated: 0 });
    }

    const imageBytes = await downloadFile(source.image);

    await Promise.all(
        siblings.map(async (sibling) => {
            if (sibling.image && sibling.image !== source.image) {
                const exists = await fileExists(sibling.image);
                if (exists) await deleteFile(sibling.image);
            }
            const key = buildItemImageKey(sibling.id);
            await uploadFile(key, imageBytes, "image/webp");
            await prisma.item.update({
                where: { id: sibling.id },
                data: { image: key },
            });
        }),
    );

    return c.json({ ok: true, updated: siblings.length });
});

// ─── Remove image from all same-name items ────────────────────────────────────
app.delete("/api/items/:id/image/apply-to-group", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }
    if (session.user.role !== "admin") {
        throw new HTTPException(403, { message: "Admin only" });
    }

    const itemId = c.req.param("id");
    const source = await prisma.item.findUnique({
        where: { id: itemId, deleted: false },
        select: { name: true },
    });
    if (!source) {
        throw new HTTPException(404, { message: "Item not found" });
    }

    const siblings = await prisma.item.findMany({
        where: {
            name: source.name,
            deleted: false,
            id: { not: itemId },
            image: { not: null },
        },
        select: { id: true, image: true },
    });

    if (siblings.length === 0) {
        return c.json({ ok: true, updated: 0 });
    }

    await Promise.all(
        siblings.map(async (sibling) => {
            if (sibling.image?.startsWith("items/")) {
                const exists = await fileExists(sibling.image);
                if (exists) await deleteFile(sibling.image);
            }
            await prisma.item.update({
                where: { id: sibling.id },
                data: { image: null },
            });
        }),
    );

    return c.json({ ok: true, updated: siblings.length });
});

// ─── Item image delete ────────────────────────────────────────────────────────
app.delete("/api/items/:id/image", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }
    if (session.user.role !== "admin") {
        throw new HTTPException(403, { message: "Admin only" });
    }

    const itemId = c.req.param("id");
    const item = await prisma.item.findUnique({
        where: { id: itemId, deleted: false },
        select: { id: true, image: true },
    });
    if (!item) {
        throw new HTTPException(404, { message: "Item not found" });
    }

    if (item.image?.startsWith("items/")) {
        const exists = await fileExists(item.image);
        if (exists) await deleteFile(item.image);
    }

    await prisma.item.update({
        where: { id: itemId },
        data: { image: null },
    });

    return c.json({ ok: true });
});

// ─── User avatar upload ───────────────────────────────────────────────────────
app.post("/api/users/me/avatar", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }

    const formData = await c.req.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
        throw new HTTPException(400, { message: "Missing avatar field" });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new HTTPException(400, {
            message: "Unsupported image type. Use JPEG, PNG, or WebP.",
        });
    }

    const rawBytes = await file.arrayBuffer();
    if (rawBytes.byteLength > MAX_IMAGE_BYTES) {
        throw new HTTPException(413, { message: "Image exceeds 10 MB limit" });
    }

    const webpBuffer = await sharp(Buffer.from(rawBytes))
        .rotate()
        .resize({ width: 256, height: 256, fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();

    const userId = session.user.id;
    const key = buildAvatarKey(userId);

    // Delete existing avatar if present before overwriting
    const exists = await fileExists(key);
    if (exists) await deleteFile(key);

    await uploadFile(key, webpBuffer, "image/webp");

    await prisma.user.update({
        where: { id: userId },
        data: { image: key },
    });

    return c.json({ ok: true });
});

// ─── User avatar delete ───────────────────────────────────────────────────────
app.delete("/api/users/me/avatar", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }

    const userId = session.user.id;
    const key = buildAvatarKey(userId);
    const exists = await fileExists(key);
    if (exists) await deleteFile(key);

    await prisma.user.update({
        where: { id: userId },
        data: { image: null },
    });

    return c.json({ ok: true });
});

// ─── User avatar proxy ────────────────────────────────────────────────────────
app.get("/api/users/:id/avatar", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) {
        throw new HTTPException(401, { message: "Authentication required" });
    }

    const userId = c.req.param("id");
    const key = buildAvatarKey(userId);
    const exists = await fileExists(key);
    if (!exists) {
        throw new HTTPException(404, { message: "No avatar" });
    }

    const bytes = await downloadFile(key);
    return new Response(bytes, {
        headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "private, max-age=300",
        },
    });
});

// ─── External FYP API routes ─────────────────────────────────────────────────
mountExternalApiRoutes(app);

// MCP route
const mcpPassword = process.env.MCP_PASSWORD;
if (!mcpPassword) {
    throw new Error("MCP_PASSWORD environment variable is required");
}
app.use(
    "/mcp",
    basicAuth({
        username: "bot",
        password: mcpPassword,
        realm: "Inventory System MCP",
        invalidUserMessage: "Access denied: Invalid credentials",
    }),
);

app.all("/mcp", async (c) => {
    try {
        // Create tRPC context for the current request
        const context = await createContext(
            {
                req: c.req.raw,
                resHeaders: new Headers(),
                info: {
                    accept:
                        c.req.header("trpc-accept") === "application/jsonl"
                            ? "application/jsonl"
                            : null,
                    type: "query", // Default; adjust to 'mutation' or 'subscription' if needed
                    isBatchCall: false, // Assume no batch calls unless specified
                    calls: [], // Empty array unless you expect specific procedure calls
                    connectionParams: null, // No connection params unless using subscriptions
                    signal: c.req.raw.signal, // Use request's AbortSignal
                    url: new URL(c.req.raw.url), // Construct URL from request
                },
            },
            c,
        );

        // Create McpServer instance for this request
        const mcpServer = createMcpServer(
            {
                name: "trpc-mcp",
                version: "0.0.1",
            },
            appRouter,
            context,
        );

        // Create transport and handle the request
        const transport = new StreamableHTTPTransport();
        await mcpServer.connect(transport);
        return transport.handleRequest(c);
    } catch (error) {
        logger.error({ err: error }, "MCP route error");
        throw new HTTPException(500, { message: "MCP processing failed" });
    }
});

// ─── Metrics endpoint ─────────────────────────────────────────────────────────
// Prometheus-compatible metrics endpoint. Enable via METRICS_ENABLED=true.
// Natively queries Prisma.
const metricsEnabled = process.env.METRICS_ENABLED === "true";
if (metricsEnabled) {
    const metricsUsername = process.env.METRICS_USERNAME;
    const metricsPassword = process.env.METRICS_PASSWORD;
    if (!metricsUsername || !metricsPassword) {
        throw new Error(
            "METRICS_USERNAME and METRICS_PASSWORD are required when METRICS_ENABLED=true",
        );
    }
    app.use(
        "/metrics",
        basicAuth({
            username: metricsUsername,
            password: metricsPassword,
            realm: "Inventory System Metrics",
            invalidUserMessage: "Access denied: Invalid credentials",
        }),
    );
    app.get("/metrics", async (c) => {
        try {
            const body = await collectMetrics();
            return c.text(body, 200, {
                "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
            });
        } catch (error) {
            logger.error({ err: error }, "Metrics endpoint error");
            throw new HTTPException(500, {
                message: "Failed to collect metrics",
            });
        }
    });
}

export default {
    port: process.env.PORT ?? 3000,
    fetch: app.fetch,
};
