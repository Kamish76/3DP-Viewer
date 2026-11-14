"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();

  const urlError = searchParams.get("error");
  const urlEmail = searchParams.get("email");

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUrlErrorMessage = (): string | null => {
    if (!urlError) return null;
    switch (urlError) {
      case "unauthorized_email":
        return urlEmail
          ? `Access denied: ${urlEmail} is not authorized. Only the site owner can sign in.`
          : "Access denied: Only the site owner Google account is authorized to sign in.";
      case "not_configured":
        return "Google OAuth is not configured on this deployment.";
      case "invalid_state":
        return "Authentication session expired or invalid state. Please try again.";
      case "missing_code":
        return "Authorization code missing from Google redirect.";
      case "cancelled":
        return "Google sign-in was cancelled.";
      case "oauth_failed":
        return "Google authentication failed. Please check server logs.";
      default:
        return "Authentication error occurred. Please try again.";
    }
  };

  const displayError = error || getUrlErrorMessage();

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/admin",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4">
          <Box className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Owner Sign In</h1>
        <p className="text-sm text-slate-400 mt-1">Single-Owner 3D Model Platform</p>
      </div>

      {displayError && (
        <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span className="text-xs leading-relaxed">{displayError}</span>
        </div>
      )}

      {/* Sole-Owner Google Login Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500/15 to-indigo-600/15 hover:from-sky-500/25 hover:to-indigo-600/25 border border-sky-500/40 hover:border-sky-400/60 text-white font-medium rounded-xl transition-all shadow-lg shadow-sky-500/10 flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
      >
        {googleLoading ? (
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <GoogleIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">Continue with Google</span>
          </>
        )}
      </button>

      <div className="mt-5 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          Access is locked exclusively to the verified site owner&apos;s Google account. Other Google accounts and password sign-ins are blocked.
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Neon Auth Protected
        </span>
        <Link href="/" className="hover:text-slate-300 transition-colors">
          Return to Home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-2xl flex items-center justify-center min-h-[320px]">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
