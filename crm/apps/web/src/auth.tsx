import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setSession } from "./api";
import type { User } from "./types";

type LoginResult = { mfaRequired: false } | { mfaRequired: true; challengeToken: string };

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfa: (challengeToken: string, code: string) => Promise<void>;
  register: (input: Record<string, string>) => Promise<void>;
  adoptSession: (token: string, refreshToken: string, user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession(token = getToken()) {
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      setSession(token);
      try {
        const data = await api<{ user: User }>("/auth/me");
        if (active) setUser(data.user);
      } catch {
        setSession(null);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    function receiveHydriaMessage(event: MessageEvent) {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "hydria-crm-auth" && typeof event.data.token === "string") {
        setLoading(true);
        void restoreSession(event.data.token);
      }
      if (event.data.type === "hydria-crm-refresh") {
        window.location.reload();
      }
    }

    window.addEventListener("message", receiveHydriaMessage);
    window.parent?.postMessage({ type: "hydria-crm-ready" }, "*");
    void restoreSession();

    return () => {
      active = false;
      window.removeEventListener("message", receiveHydriaMessage);
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const data = await api<
          { token: string; refreshToken: string; user: User } |
          { mfaRequired: true; challengeToken: string }
        >("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        if ("mfaRequired" in data) return data;
        setSession(data.token, data.refreshToken);
        setUser(data.user);
        return { mfaRequired: false };
      },
      async completeMfa(challengeToken, code) {
        const data = await api<{ token: string; refreshToken: string; user: User }>("/auth/login/mfa", {
          method: "POST",
          body: JSON.stringify({ challengeToken, code })
        });
        setSession(data.token, data.refreshToken);
        setUser(data.user);
      },
      async register(input) {
        const data = await api<{ token: string; refreshToken: string; user: User }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setSession(data.token, data.refreshToken);
        setUser(data.user);
      },
      adoptSession(token, refreshToken, nextUser) {
        setSession(token, refreshToken);
        setUser(nextUser);
      },
      async refreshUser() {
        const data = await api<{ user: User }>("/auth/me");
        setUser(data.user);
      },
      async logout() {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        setSession(null);
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
