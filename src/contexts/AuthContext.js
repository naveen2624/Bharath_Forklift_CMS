// LOCATION: src/contexts/AuthContext.js
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─── Module-level cache ───────────────────────────────────────────────────────
// Persists across page navigations (Next.js keeps the module alive).
// Cleared only on signOut.
let _cachedProfile = null;
let _cachedPermissions = [];
let _cachedRole = null;
let _cachedUser = null;

function clearCache() {
  _cachedProfile = null;
  _cachedPermissions = [];
  _cachedRole = null;
  _cachedUser = null;
}

// ─── Default context (safe no-ops before Provider mounts) ─────────────────────
const AuthContext = createContext({
  user: null,
  profile: null,
  permissions: [],
  role: null,
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  signIn: async () => ({}),
  signOut: async () => {},
  resetPassword: async () => ({}),
  updatePassword: async () => ({}),
  refreshProfile: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(_cachedUser);
  const [profile, setProfile] = useState(_cachedProfile);
  const [permissions, setPermissions] = useState(_cachedPermissions);
  const [role, setRole] = useState(_cachedRole);
  // If we already have a cached profile, start as NOT loading
  const [loading, setLoading] = useState(!_cachedProfile);

  const router = useRouter();

  async function loadUserProfile(authUser) {
    if (!authUser) {
      setLoading(false);
      return;
    }

    // Already cached from a previous navigation — use immediately
    if (_cachedProfile && _cachedUser?.id === authUser.id) {
      setUser(_cachedUser);
      setProfile(_cachedProfile);
      setPermissions(_cachedPermissions);
      setRole(_cachedRole);
      setLoading(false);
      return;
    }

    try {
      // Run profile + permissions in parallel with a 5s timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      );

      const [profileRes, permsRes] = await Promise.race([
        Promise.all([
          supabase
            .from("users")
            .select("*, roles(role_name, description)")
            .eq("auth_user_id", authUser.id)
            .maybeSingle(),
          // perms fetched after profile (needs role_id) — placeholder
          Promise.resolve({ data: null }),
        ]),
        timeout.then(() => {
          throw new Error("timeout");
        }),
      ]).catch(() => [{ data: null }, { data: null }]);

      const profileData = profileRes?.data;

      if (profileData) {
        // Fetch permissions in parallel with last-login update
        const [permsResult] = await Promise.all([
          supabase
            .from("role_permissions")
            .select("permissions(permission_name)")
            .eq("role_id", profileData.role_id),
          // fire-and-forget last login
          supabase
            .from("users")
            .update({ last_login: new Date().toISOString() })
            .eq("id", profileData.id),
        ]);

        const permsList = (permsResult?.data || [])
          .map((rp) => rp.permissions?.permission_name)
          .filter(Boolean);

        // Store in module cache
        _cachedUser = authUser;
        _cachedProfile = profileData;
        _cachedPermissions = permsList;
        _cachedRole = profileData.roles;

        setUser(authUser);
        setProfile(profileData);
        setPermissions(permsList);
        setRole(profileData.roles);
      } else {
        // Auth user exists but no users row yet — still unblock the UI
        setUser(authUser);
        console.warn("No user profile row found for auth user", authUser.id);
      }
    } catch (err) {
      console.error("Profile load error:", err);
      // On any error, unblock loading so the app doesn't hang forever
    }

    setLoading(false);
  }

  useEffect(() => {
    // Get existing session immediately (no network call if token in cookie)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null;
      loadUserProfile(authUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;

      if (event === "SIGNED_OUT") {
        clearCache();
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setRole(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await loadUserProfile(authUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function hasPermission(permission) {
    if (!permission) return true;
    if (role?.role_name === "admin") return true;
    return permissions.includes(permission);
  }

  function hasAnyPermission(perms = []) {
    return perms.some((p) => hasPermission(p));
  }

  async function signIn(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  }

  async function signOut() {
    clearCache();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    });
  }

  async function updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword });
  }

  async function refreshProfile() {
    // Bust cache and reload
    _cachedProfile = null;
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) await loadUserProfile(authUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        permissions,
        role,
        loading,
        hasPermission,
        hasAnyPermission,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
