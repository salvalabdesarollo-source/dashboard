"use client";

import { useEffect } from "react";
import type { ScanMarkedFromNotificationMessage } from "@/lib/notifications/types";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

function getScanMarkResultMessage(
  result: ScanMarkedFromNotificationMessage["result"],
): { success: boolean; message: string } | null {
  if ("success" in result && result.success) {
    return { success: true, message: "Escaneo confirmado" };
  }
  if ("alreadyProcessed" in result && result.alreadyProcessed) {
    return { success: true, message: "Escaneo confirmado" };
  }
  if ("error" in result) {
    const messages: Record<string, string> = {
      NO_TOKEN: "Inicia sesión para confirmar",
      UNAUTHORIZED: "Sesión expirada, inicia sesión de nuevo",
      NOT_FOUND: "Escaneo no encontrado",
      NETWORK: "No se pudo confirmar, intenta de nuevo",
      UNKNOWN: "No se pudo confirmar, intenta de nuevo",
    };
    return {
      success: false,
      message: messages[result.error] ?? "No se pudo confirmar, intenta de nuevo",
    };
  }
  return null;
}

export default function NotificationServiceWorkerListener() {
  useEffect(() => {
    const onServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data as ScanMarkedFromNotificationMessage | undefined;
      if (data?.type !== "SCAN_MARKED_FROM_NOTIFICATION") return;

      const feedback = getScanMarkResultMessage(data.result);
      if (!feedback) return;

      if (feedback.success) {
        showSuccessToast(feedback.message);
        window.dispatchEvent(
          new CustomEvent("salvalab:scan-marked", {
            detail: { scanId: data.scanId },
          }),
        );
        return;
      }

      showErrorToast(feedback.message);
    };

    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener(
        "message",
        onServiceWorkerMessage,
      );
    };
  }, []);

  return null;
}
