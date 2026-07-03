"use client";

import { useEffect, useRef } from "react";
import { useRefresh } from "@/contexts/RefreshContext";
import { getStoredAuth } from "@/lib/auth";
import {
  canUseNotifications,
  setupPushNotifications,
  subscribeToForegroundMessages,
} from "@/lib/fcm";
import {
  syncAuthTokenToIndexedDb,
  syncNotificationSettingsToIndexedDb,
} from "@/lib/notifications/authIndexedDb";
import {
  confirmScanFromNotification,
  getScanMarkErrorMessage,
  isScanFollowUpPayload,
  parseScanFollowUpData,
} from "@/lib/notifications/handleScanFollowUpReminder";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type FcmNotificationsProviderProps = {
  enabled: boolean;
};

type FcmPayload = {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};

async function handleForegroundScanConfirmation(
  scanId: string,
  onSuccess: () => void,
) {
  try {
    await confirmScanFromNotification(scanId);
    showSuccessToast("Escaneo confirmado");
    onSuccess();
  } catch (error) {
    showErrorToast(getScanMarkErrorMessage(error));
  }
}

export default function FcmNotificationsProvider({
  enabled,
}: FcmNotificationsProviderProps) {
  const hasInitialized = useRef(false);
  const { refresh } = useRefresh();

  useEffect(() => {
    if (!enabled || !canUseNotifications()) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const auth = getStoredAuth();
    if (auth?.token) {
      void syncAuthTokenToIndexedDb(auth.token);
    } else {
      void syncNotificationSettingsToIndexedDb();
    }

    void setupPushNotifications();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onScanMarked = () => {
      void refresh();
    };

    window.addEventListener("salvalab:scan-marked", onScanMarked);
    return () => window.removeEventListener("salvalab:scan-marked", onScanMarked);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !canUseNotifications()) return;

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      unsubscribe = await subscribeToForegroundMessages((payload) => {
        const message = payload as FcmPayload;
        const data = message.data;

        if (isScanFollowUpPayload(data)) {
          const parsed = parseScanFollowUpData(data)!;
          const title = message.notification?.title ?? "Recordatorio de escaneo";
          const body =
            message.notification?.body ?? "Toca para confirmar el escaneo";

          const notification = new Notification(title, {
            body,
            icon: "/favicon.png",
            tag: `scan-follow-up-${parsed.scanId}`,
            data: {
              action: parsed.action,
              scanId: parsed.scanId,
              dateTime: parsed.dateTime,
            },
          });

          notification.onclick = (event) => {
            event.preventDefault();
            notification.close();
            void handleForegroundScanConfirmation(parsed.scanId, () => {
              void refresh();
            });
          };
          return;
        }

        const title = message.notification?.title ?? "SalvaLab";
        const body = message.notification?.body ?? "";

        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon: "/favicon.png",
            data,
          });
        }
      });
    })();

    return () => {
      unsubscribe?.();
    };
  }, [enabled, refresh]);

  return null;
}
