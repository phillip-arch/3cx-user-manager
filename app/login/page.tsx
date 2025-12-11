"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("LOGIN RESPONSE", data);

      if (!res.ok || !data.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      if (data.role === "admin") {
        router.replace("/dashboard/companies");
      } else {
        router.replace(`/dashboard/companies/${data.companyId}/users`);
      }
    } catch (err) {
      console.error(err);
      setError("Unexpected error.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/30 backdrop-blur">
        <div className="mb-4 space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            3CX User Manager
          </p>
          <h1 className="text-2xl font-semibold text-white">Login</h1>
          <p className="text-xs text-slate-300">
            Use your admin or editor account to access the dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-100 bg-red-500/20 border border-red-300/40 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-300">Email</label>
            <input
              name="email"
              type="email"
              className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-300">Password</label>
            <input
              name="password"
              type="password"
              className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
