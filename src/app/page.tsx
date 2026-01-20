"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = getStoredAuth();
    router.replace(auth ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        <p>Redirigiendo...</p>
      </div>
    </div>
  );
}
