"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ACCEPTED_KEY = "a2hsAccepted";
const LAST_RESPONSE_KEY = "a2hsLastResponse";

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const byWidth = window.matchMedia("(max-width: 768px)").matches;
  const byAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return byWidth || byAgent;
};

const isIos = () => {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
};

export default function AddToHomeScreenPrompt() {
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isMobileDevice()) return;
    if (localStorage.getItem(ACCEPTED_KEY) === "true") return;
    if (isStandalone()) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setOpen(true);
    };

    const handleInstalled = () => {
      localStorage.setItem(ACCEPTED_KEY, "true");
      setOpen(false);
    };

    if (isIos()) {
      setOpen(true);
    } else {
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    }
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const onClose = () => {
    localStorage.setItem(LAST_RESPONSE_KEY, "rejected");
    setOpen(false);
  };

  const onInstall = async () => {
    if (!deferredPrompt) {
      onClose();
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(ACCEPTED_KEY, "true");
      setOpen(false);
      return;
    }
    localStorage.setItem(LAST_RESPONSE_KEY, "rejected");
    setOpen(false);
  };

  return (
    <Modal open={open} title="Agregar acceso directo" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-600">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="SalvaLab"
            className="h-10 w-10 rounded-xl border border-slate-200"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Laboratorio dental Salva
            </p>
            <p className="text-xs text-slate-500">
              Guarda la app en tu pantalla de inicio.
            </p>
          </div>
        </div>
        {isIos() ? (
          <div className="space-y-3 text-xs text-slate-500">
            <p>
              En iPhone/iPad, toca el boton de compartir y luego selecciona
              "Agregar a pantalla de inicio".
            </p>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              onClick={() => void onInstall()}
            >
              Crear acceso directo
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
              onClick={onClose}
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
