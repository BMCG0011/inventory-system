import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "@/auth/client";
import { useNavigate, NavLink } from "react-router-dom";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <AuthUIProvider
      // better-auth-ui's bundled AnyAuthClient type lags better-auth's own
      // customSession + admin plugin type inference; the client is
      // runtime-compatible, just not type-compatible across the version skew.
      authClient={
        authClient as Parameters<typeof AuthUIProvider>[0]["authClient"]
      }
      navigate={void navigate}
      credentials={import.meta.env.DEV}
      providers={["github"]}
      Link={
        NavLink as unknown as React.FC<{
          href: string;
          className?: string;
          children: React.ReactNode;
        }>
      }
    >
      {children}
    </AuthUIProvider>
  );
}
