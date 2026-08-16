/**
 * External API — bearer-token authenticated REST endpoints for FYP integrations.
 *
 * Auth: All routes require `Authorization: Bearer <FYP_BEARER_TOKEN>`.
 *
 * Routes:
 *   GET    /api/ext/consumables                   — query consumable stock levels
 *   GET    /api/ext/assets                        — query asset availability
 *   POST   /api/ext/assets/checkout               — check out an asset
 *   POST   /api/ext/assets/checkin                — check in an asset
 */

import { type Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { prisma } from "@/server/lib/prisma";
import { logger as rootLogger } from "@/server/lib/logger"
import { itemCheckout } from "@/server/api/utils/item/item.checkout";
import { itemCheckin } from "@/server/api/utils/item/item.checkin";
import { randomUUID } from "crypto";

const logger = rootLogger.child({ module: "external-api" });

// ─── Request logging helpers ──────────────────────────────────────────────────

function startRequest(req: Request): { requestId: string; start: number; ip: string } {
    const requestId = randomUUID();
    const start = Date.now();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("x-real-ip")
        ?? "unknown";
    const url = new URL(req.url);
    logger.info(
        { requestId, method: req.method, path: url.pathname, ip },
        "ext-api request received",
    );
    return { requestId, start, ip };
}

function logSuccess(
    requestId: string,
    start: number,
    method: string,
    path: string,
    extra?: Record<string, unknown>,
): void {
    logger.info(
        { requestId, method, path, ms: Date.now() - start, status: 200, ...extra },
        "ext-api request completed",
    );
}

function logError(
    requestId: string,
    start: number,
    method: string,
    path: string,
    status: number,
    message: string,
    extra?: Record<string, unknown>,
): void {
    logger.warn(
        { requestId, method, path, ms: Date.now() - start, status, message, ...extra },
        "ext-api request failed",
    );
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireFypToken(req: Request, requestId: string): void {
    const expected = process.env.FYP_BEARER_TOKEN;
    if (!expected) {
        logger.error({ requestId }, "FYP_BEARER_TOKEN not configured");
        throw new HTTPException(503, {
            message: "External API not configured: FYP_BEARER_TOKEN missing",
        });
    }
    const authHeader = req.headers.get("authorization") ?? "";
    const spaceIdx = authHeader.indexOf(" ");
    const scheme = spaceIdx === -1 ? authHeader : authHeader.slice(0, spaceIdx);
    const token = spaceIdx === -1 ? "" : authHeader.slice(spaceIdx + 1);
    if (scheme.toLowerCase() !== "bearer" || token !== expected) {
        logger.warn(
            {
                requestId,
                hasAuthHeader: authHeader.length > 0,
                scheme: scheme || "(none)",
            },
            "ext-api auth failed: invalid or missing bearer token",
        );
        throw new HTTPException(401, {
            message: "Invalid or missing bearer token",
        });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveUserById(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
    });
    if (!user) {
        throw new HTTPException(404, {
            message: `No user found with ID: ${userId}`,
        });
    }
    return user;
}

// ─── Route mount ─────────────────────────────────────────────────────────────

export function mountExternalApiRoutes(app: Hono): void {
    // ── GET /api/ext/consumables ──────────────────────────────────────────────
    // Query stock levels for consumables.
    //
    // Query params:
    //   type   string? — filter by item name (partial, case-insensitive)
    //
    // Success 200:
    //   { ok: true, consumables: [{ name, available, total, minStock }] }
    //
    // Errors: 401
    app.get("/api/ext/consumables", async (c) => {
        const { requestId, start } = startRequest(c.req.raw);
        const path = "/api/ext/consumables";
        requireFypToken(c.req.raw, requestId);
        const typeFilter = c.req.query("type");
        logger.debug({ requestId, typeFilter }, "ext-api querying consumables");

        const consumables = await prisma.consumable.findMany({
            where: typeFilter
                ? { item: { name: { contains: typeFilter, mode: "insensitive" }, deleted: false } }
                : { item: { deleted: false } },
            select: {
                available: true,
                total: true,
                minStock: true,
                item: { select: { name: true } },
            },
            orderBy: { item: { name: "asc" } },
        });

        logSuccess(requestId, start, "GET", path, { resultCount: consumables.length, typeFilter });
        return c.json({
            ok: true,
            consumables: consumables.map((c) => ({
                name: c.item?.name ?? "Unknown",
                available: c.available,
                total: c.total,
                minStock: c.minStock,
                lowStock: c.available <= c.minStock,
            })),
        });
    });

    // ── GET /api/ext/assets ───────────────────────────────────────────────────
    // Query availability of non-consumable assets.
    //
    // Query params:
    //   type   string? — filter by item name (partial, case-insensitive)
    //
    // Success 200:
    //   {
    //     ok: true,
    //     assets: [{
    //       name, serial, status: "in_storage" | "checked_out",
    //       storageLocation, availableCount, totalCount
    //     }]
    //   }
    //
    // Errors: 401
    app.get("/api/ext/assets", async (c) => {
        const { requestId, start } = startRequest(c.req.raw);
        const path = "/api/ext/assets";
        requireFypToken(c.req.raw, requestId);
        const typeFilter = c.req.query("type");
        logger.debug({ requestId, typeFilter }, "ext-api querying assets");

        const items = await prisma.item.findMany({
            where: {
                deleted: false,
                consumable: null,
                ...(typeFilter
                    ? { name: { contains: typeFilter, mode: "insensitive" } }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                serial: true,
                location: { select: { name: true } },
                ItemRecords: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { loaned: true },
                },
            },
            orderBy: [{ name: "asc" }, { serial: "asc" }],
        });

        // Group by name for summary counts
        const byName = new Map<
            string,
            { total: number; available: number; location: string }
        >();
        for (const item of items) {
            const isLoaned = item.ItemRecords[0]?.loaned === true;
            const entry = byName.get(item.name) ?? {
                total: 0,
                available: 0,
                location: item.location?.name ?? "Unknown",
            };
            entry.total += 1;
            if (!isLoaned) entry.available += 1;
            byName.set(item.name, entry);
        }

        logSuccess(requestId, start, "GET", path, { resultCount: items.length, typeFilter });
        return c.json({
            ok: true,
            assets: items.map((item) => ({
                name: item.name,
                serial: item.serial,
                status: item.ItemRecords[0]?.loaned === true ? "checked_out" : "in_storage",
                storageLocation: item.location?.name ?? null,
                availableCount: byName.get(item.name)?.available ?? 0,
                totalCount: byName.get(item.name)?.total ?? 0,
            })),
        });
    });

    // ── POST /api/ext/assets/checkout ─────────────────────────────────────────
    // Check out an asset to a user.
    //
    // Body (JSON):
    //   userId  string — user id
    //   serial     string — asset serial number
    //
    // Success 200: { ok: true, serial, name, checkedOutTo: { name, userId } }
    // Errors: 400, 401, 404, 409 (already checked out)
    app.post("/api/ext/assets/checkout", async (c) => {
        const { requestId, start } = startRequest(c.req.raw);
        const path = "/api/ext/assets/checkout";
        requireFypToken(c.req.raw, requestId);

        const body = await c.req.json<{ userId?: string; serial?: string }>();
        const userId = body.userId;
        const serial = body.serial;

        if (!userId) {
            logError(requestId, start, "POST", path, 400, "userId is required");
            throw new HTTPException(400, { message: "userId is required" });
        }
        if (!serial) {
            logError(requestId, start, "POST", path, 400, "serial is required");
            throw new HTTPException(400, { message: "serial is required" });
        }

        logger.debug({ requestId, userId, serial }, "ext-api checkout params");
        const user = await resolveUserById(userId);

        const item = await prisma.item.findUnique({
            where: { serial, deleted: false },
            select: { id: true, name: true, consumable: true },
        });
        if (!item) {
            logError(requestId, start, "POST", path, 404, `Asset not found: ${serial}`, { serial });
            throw new HTTPException(404, { message: `Asset not found: ${serial}` });
        }
        if (item.consumable) {
            logError(requestId, start, "POST", path, 400, "consumable item via assets endpoint", { serial });
            throw new HTTPException(400, {
                message: "Use the consumable endpoint for consumable items",
            });
        }

        logger.info({ requestId, serial, itemId: item.id, userId: user.id }, "ext-api checking out asset");
        const result = await itemCheckout(
            user.id,
            [{ itemId: item.id, quantity: 1 }],
            undefined,
            "Via External API",
        );

        if (!result.ok) {
            logger.error({ requestId, serial, itemId: item.id, userId: user.id, failures: result.failures }, "ext-api checkout failed");
            logError(requestId, start, "POST", path, 422, "Checkout failed");
            throw new HTTPException(422, {
                message: `Checkout failed: ${typeof result.failures === "string" ? result.failures : JSON.stringify(result.failures)}`,
            });
        }

        logSuccess(requestId, start, "POST", path, { serial, itemId: item.id, userId: user.id });
        return c.json({
            ok: true,
            serial,
            name: item.name,
            checkedOutTo: { name: user.name, userId: user.id },
        });
    });

    // ── POST /api/ext/assets/checkin ──────────────────────────────────────────
    // Check in an asset from a user.
    //
    // Body (JSON):
    //   userId  string — user id
    //   serial     string — asset serial number
    //
    // Success 200: { ok: true, serial, name, checkedInBy: { name, userId } }
    // Errors: 400, 401, 404, 409 (already in storage)
    app.post("/api/ext/assets/checkin", async (c) => {
        const { requestId, start } = startRequest(c.req.raw);
        const path = "/api/ext/assets/checkin";
        requireFypToken(c.req.raw, requestId);

        const body = await c.req.json<{ userId?: string; serial?: string }>();
        const userId = body.userId;
        const serial = body.serial;

        if (!userId) {
            logError(requestId, start, "POST", path, 400, "userId is required");
            throw new HTTPException(400, { message: "userId is required" });
        }
        if (!serial) {
            logError(requestId, start, "POST", path, 400, "serial is required");
            throw new HTTPException(400, { message: "serial is required" });
        }

        logger.debug({ requestId, userId, serial }, "ext-api checkin params");
        const user = await resolveUserById(userId);

        const item = await prisma.item.findUnique({
            where: { serial, deleted: false },
            select: { id: true, name: true, consumable: true },
        });
        if (!item) {
            logError(requestId, start, "POST", path, 404, `Asset not found: ${serial}`, { serial });
            throw new HTTPException(404, { message: `Asset not found: ${serial}` });
        }
        if (item.consumable) {
            logError(requestId, start, "POST", path, 400, "consumable cannot be returned", { serial });
            throw new HTTPException(400, {
                message: "Consumables cannot be returned",
            });
        }

        logger.info({ requestId, serial, itemId: item.id, userId: user.id }, "ext-api checking in asset");
        const result = await itemCheckin(
            user.id,
            [{ itemId: item.id, quantity: 1 }],
            undefined,
            "Via External API",
        );

        if (!result.ok) {
            logger.error({ requestId, serial, itemId: item.id, userId: user.id, failures: result.failures }, "ext-api checkin failed");
            logError(requestId, start, "POST", path, 422, "Checkin failed");
            throw new HTTPException(422, {
                message: `Checkin failed: ${typeof result.failures === "string" ? result.failures : JSON.stringify(result.failures)}`,
            });
        }

        logSuccess(requestId, start, "POST", path, { serial, itemId: item.id, userId: user.id });
        return c.json({
            ok: true,
            serial,
            name: item.name,
            checkedInBy: { name: user.name, userId: user.id },
        });
    });
}
