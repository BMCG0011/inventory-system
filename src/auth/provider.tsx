import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "@/auth/client";
import { useNavigate, NavLink } from "react-router-dom";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={void navigate}
      credentials={false}
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
