import { Route, BrowserRouter, Routes, Navigate } from "react-router-dom";
import Assets from "@/pages/Assets";
import Consumables from "@/pages/Consumables";
import ConsumableRequests from "@/pages/ConsumableRequests";
import MyRequests from "@/pages/MyRequests";
import AuditLog from "@/pages/AuditLog";
import Activity from "@/pages/Activity";
import Members from "@/pages/Members";
import Dashboard from "@/pages/Dashboard";
import Cart from "@/pages/Cart";
import AuthPage from "@/auth/page.tsx";
import { CartProvider } from "@/contexts/cart-context";
import { AuthProvider } from "@/auth/provider.tsx";
import React from "react";
import Settings from "@/pages/Settings";
import { Toaster } from "sonner";
import ErrorPage from "@/pages/Error.tsx";
import QR from "@/pages/QR.tsx";
import ItemDetails from "@/pages/ItemDetails.tsx";
import { ProtectedLayout } from "@/auth/ProtectedLayout.tsx";
import CheckIn from "@/pages/CheckIn.tsx";
import Chat from "./pages/Chat";

const App = () => {
  React.useEffect(() => {
    // On mount, apply theme based on localStorage or system preference
    const isDark =
      localStorage.theme === "dark" ||
      (!localStorage.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only absolute focus:absolute top-0 left-0 bg-white text-black px-4 py-2 rounded-md z-50"
          >
            Skip to main content
          </a>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            <Route path="error" element={<ErrorPage />} />
            <Route path="/auth/:pathname" element={<AuthPage />} />
            <Route path="/" element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/activity" element={<Activity />} />
              <Route
                path="/transactions"
                element={<Navigate to="/activity" replace />}
              />
              <Route
                path="/audit-log"
                element={<Navigate to="/activity" replace />}
              />
              <Route path="/assets/*" element={<Assets />} />
              <Route
                path="/consumables/requests"
                element={<ConsumableRequests />}
              />
              <Route path="/consumables/*" element={<Consumables />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/members" element={<Members />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/item/:id" element={<ItemDetails />} />
              <Route path="/qr/*" element={<QR />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/checkin" element={<CheckIn />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
