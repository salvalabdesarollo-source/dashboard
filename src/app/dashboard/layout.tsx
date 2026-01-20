"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearStoredAuth, getStoredAuth, type AuthUser } from "@/lib/auth";

const navigationItems = [
  { label: "Agenda", href: "/dashboard" },
  { label: "Usuarios", href: "/dashboard/users" },
  { label: "Clinicas", href: "/dashboard/clinics" },
  { label: "Doctores", href: "/dashboard/doctors" },
  { label: "Escaneos", href: "/dashboard/scans" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  const availableNavigation = useMemo(() => {
    if (user?.role === "Administrator") return navigationItems;
    return navigationItems.filter(
      (item) => item.href === "/dashboard" || item.href === "/dashboard/scans",
    );
  }, [user?.role]);

  const activeLabel = useMemo(() => {
    return availableNavigation.find((item) => pathname === item.href)?.label;
  }, [pathname, availableNavigation]);

  const onLogout = () => {
    clearStoredAuth();
    router.replace("/login");
  };

  const roleLabel = useMemo(() => {
    if (user?.role === "Administrator") return "Administrador";
    if (user?.role === "Scanner") return "Escaneador";
    return user?.role ?? "";
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
        <aside className="hidden h-screen flex-col border-r border-slate-200 bg-white px-6 py-8 md:sticky md:top-0 md:flex">
          <div className="mb-10 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Laboratorio dental Salva
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Panel principal
            </h1>
          </div>

          <nav className="flex flex-1 flex-col gap-2 overflow-y-auto text-sm">
            {availableNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-4 py-3 transition ${
                    isActive
                      ? "bg-sky-50 text-sky-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">{user?.username}</p>
            <p className="text-slate-500">{roleLabel}</p>
            <button
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              onClick={onLogout}
              type="button"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
            <div className="flex items-center justify-between md:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Laboratorio dental Salva
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activeLabel ?? "Panel"}
                </h2>
              </div>
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={onLogout}
                type="button"
              >
                Salir
              </button>
            </div>

            <div className="hidden md:block">
              <p className="text-sm text-slate-500">Módulo</p>
              <h2 className="text-2xl font-semibold text-slate-900">
                {activeLabel ?? "Panel"}
              </h2>
            </div>

          </header>

          <div className="border-b border-slate-200 bg-white px-4 py-4 md:hidden">
            <nav className="grid grid-cols-2 gap-2 text-sm">
            {availableNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            </nav>
          </div>

          <section className="flex-1 px-4 py-5 md:px-8 md:py-6">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
