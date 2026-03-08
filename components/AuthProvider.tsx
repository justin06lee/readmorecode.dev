"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { mergeUserWithStoredAvatar } from "@/lib/avatar-storage";
import type { AuthUser } from "@/lib/types";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  openAuthModal: (mode?: AuthMode) => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setUser(mergeUserWithStoredAvatar((data.user as AuthUser | null) ?? null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const openAuthModal = useCallback((mode: AuthMode = "login") => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthOpen(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setUser(null);
  }, []);

  const handleAuthenticated = useCallback((nextUser: AuthUser) => {
    setUser(mergeUserWithStoredAvatar(nextUser));
    setAuthOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        openAuthModal,
        closeAuthModal,
        refreshUser,
        setUser,
        logout,
      }}
    >
      {children}
      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={closeAuthModal}
        onModeChange={setAuthMode}
        onAuthenticated={handleAuthenticated}
      />
    </AuthContext.Provider>
  );
}
