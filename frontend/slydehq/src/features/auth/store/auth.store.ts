import { create } from "zustand";
import { tokenStorage } from "@/lib/token-storage";
import { decodeJwt } from "@/lib/jwt";
import type { AuthResponse, JwtClaims, User } from "../types/auth.types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** Persist a successful login/signup with a full user object. */
  setSession: (session: AuthResponse) => void;
  /** Persist a token-only session (e.g. Google OAuth); user derived from JWT. */
  setToken: (token: string) => void;
  /** Update just the user (e.g. after a profile refetch). */
  setUser: (user: User) => void;
  /** Clear everything (logout / 401). */
  clearSession: () => void;
}

/** Build a minimal user from JWT claims (until a /me endpoint exists). */
function userFromToken(token: string): User | null {
  const claims = decodeJwt<JwtClaims>(token);
  if (!claims?.id) return null;
  return {
    id: claims.id,
    email: claims.email,
    name: claims.email?.split("@")[0] ?? "there",
  };
}

// Seed from storage so a page refresh keeps the user signed in.
const initialToken = tokenStorage.get();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialToken ? userFromToken(initialToken) : null,
  token: initialToken,
  isAuthenticated: Boolean(initialToken),

  setSession: ({ user, token }) => {
    tokenStorage.set(token);
    set({ user, token, isAuthenticated: true });
  },

  setToken: (token) => {
    tokenStorage.set(token);
    set({ token, user: userFromToken(token), isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  clearSession: () => {
    tokenStorage.clear();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
