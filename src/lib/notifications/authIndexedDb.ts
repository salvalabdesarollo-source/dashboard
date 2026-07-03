import { API_BASE_URL } from "@/lib/config";

const DB_NAME = "salvalab-notifications";
const DB_VERSION = 1;

const AUTH_STORE = "auth";
const SETTINGS_STORE = "settings";
const PROCESSED_STORE = "processedScans";

const AUTH_TOKEN_KEY = "token";
const API_BASE_URL_KEY = "apiBaseUrl";

export const PROCESSED_SCAN_TTL_MS = 5 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE);
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
      if (!db.objectStoreNames.contains(PROCESSED_STORE)) {
        db.createObjectStore(PROCESSED_STORE);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function idbPut(storeName: string, key: string, value: unknown) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function idbDelete(storeName: string, key: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

export async function syncAuthTokenToIndexedDb(token: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await idbPut(AUTH_STORE, AUTH_TOKEN_KEY, token);
  await idbPut(SETTINGS_STORE, API_BASE_URL_KEY, API_BASE_URL);
}

export async function clearAuthFromIndexedDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await idbDelete(AUTH_STORE, AUTH_TOKEN_KEY);
}

export async function syncNotificationSettingsToIndexedDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await idbPut(SETTINGS_STORE, API_BASE_URL_KEY, API_BASE_URL);
}

export async function wasScanRecentlyProcessed(scanId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return false;
  const processedAt = await idbGet<number>(PROCESSED_STORE, scanId);
  if (!processedAt) return false;
  return Date.now() - processedAt < PROCESSED_SCAN_TTL_MS;
}

export async function markScanAsProcessed(scanId: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await idbPut(PROCESSED_STORE, scanId, Date.now());
}

export async function clearProcessedScan(scanId: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await idbDelete(PROCESSED_STORE, scanId);
}
