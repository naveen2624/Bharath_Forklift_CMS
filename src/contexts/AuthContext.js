"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Default context shape — every function is a no-op so components never crash
// even if they somehow render outside the Provider
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
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // loadUserProfile — no supabase in deps (it's a stable module singleton)
  const loadUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    try {
      const { data: profileData } = await supabase
        .from("users")
        .select("*, roles(role_name, description)")
        .eq("auth_user_id", authUser.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setRole(profileData.roles);

        const { data: permsData } = await supabase
          .from("role_permissions")
          .select("permissions(permission_name, module)")
          .eq("role_id", profileData.role_id);

        setPermissions(
          (permsData || [])
            .map((rp) => rp.permissions?.permission_name)
            .filter(Boolean),
        );

        // fire-and-forget last login update
        supabase
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", profileData.id)
          .then(() => {});
      } else {
        // user row missing — still unblock loading
        setLoading(false);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
    setLoading(false);
  }, []); // stable — supabase is a module-level singleton

  useEffect(() => {
    // Initial session check
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser);
      loadUserProfile(authUser);
    });

    // Listen for auth changes (login / logout / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        await loadUserProfile(authUser);
      } else {
        setProfile(null);
        setPermissions([]);
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  // ── Permission helpers ─────────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      if (role?.role_name === "admin") return true;
      return permissions.includes(permission);
    },
    [role, permissions],
  );

  const hasAnyPermission = useCallback(
    (perms) => (perms || []).some((p) => hasPermission(p)),
    [hasPermission],
  );

  // ── Auth actions ───────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const resetPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    });
  };

  const updatePassword = async (newPassword) => {
    return supabase.auth.updateUser({ password: newPassword });
  };

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
        refreshProfile: () => loadUserProfile(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
