import { getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { apiRequest } from "@/lib/api";
import { FIREBASE_VAPID_KEY, getFirebaseApp } from "@/lib/firebase";

const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";

let messagingPromise: Promise<Messaging | null> | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;

  if (!messagingPromise) {
    messagingPromise = (async () => {
      const { getMessaging } = await import("firebase/messaging");
      return getMessaging(getFirebaseApp());
    })();
  }

  return messagingPromise;
}

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!canUseNotifications()) return null;
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!canUseNotifications()) return "denied" as NotificationPermission;
  return Notification.requestPermission();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration(
    SERVICE_WORKER_PATH,
  );
  if (existing) return existing;
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH);
}

export async function obtainFcmToken(): Promise<string | null> {
  if (!canUseNotifications() || Notification.permission !== "granted") {
    return null;
  }

  if (!FIREBASE_VAPID_KEY) {
    console.warn(
      "Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY para obtener el token FCM.",
    );
    return null;
  }

  try {
    const registration = await registerServiceWorker();
    const messaging = await getMessagingInstance();
    if (!messaging || !registration) return null;

    return await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.warn("No se pudo obtener el token FCM:", error);
    return null;
  }
}

export async function syncFcmTokenToBackend(token: string) {
  await apiRequest("/users/fcm-token", {
    method: "PATCH",
    body: JSON.stringify({ FCM_token: token }),
  });
}

export async function clearFcmTokenOnBackend() {
  await apiRequest("/users/fcm-token", {
    method: "PATCH",
    body: JSON.stringify({ FCM_token: null }),
  });
}

export async function setupPushNotifications() {
  if (!canUseNotifications()) return;

  try {
    if (Notification.permission !== "granted") {
      await requestNotificationPermission();
    }

    if (Notification.permission !== "granted") return;

    const token = await obtainFcmToken();
    if (token) {
      await syncFcmTokenToBackend(token);
    }
  } catch (error) {
    console.warn("No se pudieron configurar las notificaciones:", error);
  }
}

export async function getFcmTokenForLogin(): Promise<string | null> {
  if (!canUseNotifications() || Notification.permission !== "granted") {
    return null;
  }
  return obtainFcmToken();
}

export async function subscribeToForegroundMessages(
  handler: (payload: unknown) => void,
) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, handler);
}
