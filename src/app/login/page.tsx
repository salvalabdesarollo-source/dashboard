"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";
import { apiRequest } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";

type LoginResponse = {
  id: number;
  username: string;
  role: string;
  phone?: string | null;
  token: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const payload = await apiRequest<LoginResponse>("/users/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        skipAuth: true,
      });
      setStoredAuth(payload);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <LoadingOverlay show={isLoading} message="Validando credenciales..." />
      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-4 py-6">
        <div className="grid w-full max-w-md gap-6 lg:max-w-6xl lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          <div className="hidden flex-col items-center justify-center gap-6 text-center text-white lg:flex lg:items-start lg:text-left">
            <Image
              src="/logo-full.png"
              alt="Laboratorio dental Salva"
              width={460}
              height={160}
              priority
            />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Laboratorio dental Salva
              </h1>
            </div>
          </div>

          <div className="rounded-3xl bg-white/95 p-6 shadow-2xl lg:p-8">
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <Image
                src="/logo-full.png"
                alt="Laboratorio dental Salva"
                width={220}
                height={80}
                priority
              />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Laboratorio dental Salva
              </p>
            </div>
            <div className="mb-6 space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Iniciar sesión
              </h2>
              <p className="text-sm text-slate-500">
                Ingresa tus credenciales para continuar.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                Usuario
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Contraseña
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <button
                className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Validando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
