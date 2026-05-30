"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function LogoVideo({ className = "" }) {
  return (
    <video autoPlay muted loop playsInline preload="auto" className={className}>
      <source src="/logo/BF_Logo_Animated.mp4" type="video/mp4" />
    </video>
  );
}
export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      toast.error(error.message || "Invalid credentials");
    } else {
      toast.success("Welcome back!");
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-surface-950">
      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{
          background:
            "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fb923c 100%)",
        }}
      >
        {/* Animated logo centred on panel */}
        <div className="flex-1 flex items-center justify-center">
          <LogoVideo className="w-72 h-72 drop-shadow-2xl" />
        </div>

        {/* Feature pills */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { label: "Modules", value: "12+" },
            { label: "Role-based Access", value: "RBAC" },
            { label: "PDF Generation", value: "✓" },
            { label: "Real-time Data", value: "✓" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20"
            >
              <div className="text-2xl font-display font-bold text-white">
                {item.value}
              </div>
              <div className="text-orange-200 text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      </div>

      {/* ── Right panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <LogoVideo className="w-32 h-32" />
          </div>

          <h2 className="font-display font-bold text-3xl text-white mb-2">
            Sign in
          </h2>
          <p className="text-surface-400 mb-8">
            Enter your credentials to access the system
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl bg-surface-800 border border-surface-700
                           text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500
                           focus:ring-2 focus:ring-brand-500/20 transition-all"
                placeholder="you@bharathforklift.com"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-surface-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-brand-400 hover:text-brand-300 text-sm transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 rounded-xl bg-surface-800 border border-surface-700
                             text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500
                             focus:ring-2 focus:ring-brand-500/20 transition-all pr-12"
                  placeholder="••••••••"
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold
                         rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:ring-offset-2 focus:ring-offset-surface-950 disabled:opacity-60
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
