importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyA-QqAiwKQWFw53eekx4eB6ILU7hiG0mCQ",
  authDomain: "salvalab-scans.firebaseapp.com",
  projectId: "salvalab-scans",
  storageBucket: "salvalab-scans.firebasestorage.app",
  messagingSenderId: "1033226068356",
  appId: "1:1033226068356:web:a90a40136cbeca64677dd1",
  measurementId: "G-295WG9XSY2",
});

const messaging = firebase.messaging();

const DB_NAME = "salvalab-notifications";
const DB_VERSION = 1;
const AUTH_STORE = "auth";
const SETTINGS_STORE = "settings";
const PROCESSED_STORE = "processedScans";
const AUTH_TOKEN_KEY = "token";
const API_BASE_URL_KEY = "apiBaseUrl";
const DEFAULT_API_BASE_URL = "https://vps-5610837-x.dattaweb.com/prod";
const PROCESSED_SCAN_TTL_MS = 5 * 60 * 1000;

function openDb() {
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function () {
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
    request.onerror = function () {
      reject(request.error);
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
  });
}

function idbGet(storeName, key) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onerror = function () {
        reject(request.error);
      };
      request.onsuccess = function () {
        resolve(request.result === undefined ? null : request.result);
      };
      tx.oncomplete = function () {
        db.close();
      };
    });
  });
}

function idbPut(storeName, key, value) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(value, key);
      request.onerror = function () {
        reject(request.error);
      };
      request.onsuccess = function () {
        resolve();
      };
      tx.oncomplete = function () {
        db.close();
      };
    });
  });
}

function wasScanRecentlyProcessed(scanId) {
  return idbGet(PROCESSED_STORE, scanId).then(function (processedAt) {
    if (!processedAt) return false;
    return Date.now() - processedAt < PROCESSED_SCAN_TTL_MS;
  });
}

function markScanAsProcessed(scanId) {
  return idbPut(PROCESSED_STORE, scanId, Date.now());
}

function getAuthTokenFromIndexedDB() {
  return idbGet(AUTH_STORE, AUTH_TOKEN_KEY);
}

function getApiBaseUrlFromIndexedDB() {
  return idbGet(SETTINGS_STORE, API_BASE_URL_KEY).then(function (value) {
    return value || DEFAULT_API_BASE_URL;
  });
}

function markScanFromNotification(scanId) {
  return wasScanRecentlyProcessed(scanId).then(function (alreadyProcessed) {
    if (alreadyProcessed) {
      return { alreadyProcessed: true };
    }

    return getAuthTokenFromIndexedDB().then(function (token) {
      if (!token) {
        return { error: "NO_TOKEN" };
      }

      return getApiBaseUrlFromIndexedDB().then(function (apiBaseUrl) {
        return fetch(apiBaseUrl + "/scans/" + scanId + "/mark-scanned", {
          method: "PATCH",
          headers: {
            token: token,
            "Content-Type": "application/json",
          },
        })
          .then(function (response) {
            if (!response.ok) {
              if (response.status === 401) {
                return { error: "UNAUTHORIZED" };
              }
              if (response.status === 404) {
                return { error: "NOT_FOUND" };
              }
              return { error: "UNKNOWN" };
            }
            return markScanAsProcessed(scanId).then(function () {
              return { success: true };
            });
          })
          .catch(function () {
            return { error: "NETWORK" };
          });
      });
    });
  });
}

function notifyClients(payload) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
    function (clientsList) {
      clientsList.forEach(function (client) {
        client.postMessage(payload);
      });
    },
  );
}

messaging.onBackgroundMessage(function (payload) {
  const notification = payload.notification || {};
  const title = notification.title || "SalvaLab";
  const options = {
    body: notification.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: payload.data || {},
  };

  if (payload.data && payload.data.action === "scan_follow_up_reminder" && payload.data.scanId) {
    options.tag = "scan-follow-up-" + payload.data.scanId;
  }

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const data = event.notification.data || {};

  if (data.action !== "scan_follow_up_reminder" || !data.scanId) {
    return;
  }

  event.waitUntil(
    markScanFromNotification(String(data.scanId)).then(function (result) {
      return notifyClients({
        type: "SCAN_MARKED_FROM_NOTIFICATION",
        scanId: String(data.scanId),
        result: result,
      });
    }),
  );
});
