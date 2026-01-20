"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearStoredAuth, getStoredAuth, type AuthUser } from "@/lib/auth";
import { RefreshProvider, useRefresh } from "@/contexts/RefreshContext";

const navigationItems = [
  { label: "Agenda", href: "/dashboard" },
  { label: "Usuarios", href: "/dashboard/users" },
  { label: "Clinicas", href: "/dashboard/clinics" },
  { label: "Doctores", href: "/dashboard/doctors" },
  { label: "Escaneos", href: "/dashboard/scans" },
];

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const { refresh } = useRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
        <aside className="hidden h-screen flex-col border-r border-slate-200 bg-white px-6 py-8 md:sticky md:top-0 md:flex">
          <div className="mb-10">
            <Image
              src="/logo-full.png"
              alt="Laboratorio dental Salva"
              width={200}
              height={70}
              className="h-auto w-full"
              priority
            />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
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
              <div className="flex-1">
                <Image
                  src="/logo-full.png"
                  alt="Laboratorio dental Salva"
                  width={180}
                  height={63}
                  className="h-auto w-auto max-w-[180px]"
                  priority
                />
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {activeLabel ?? "Panel"}
                </h2>
              </div>
              <button
                className="ml-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={onLogout}
                type="button"
              >
                Salir
              </button>
            </div>

            <div className="hidden flex-1 items-center justify-between md:flex">
              <div>
                <p className="text-sm text-slate-500">Módulo</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {activeLabel ?? "Panel"}
                </h2>
              </div>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                type="button"
                title="Actualizar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                type="button"
                title="Actualizar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefreshProvider>
      <DashboardContent>{children}</DashboardContent>
    </RefreshProvider>
  );
}
