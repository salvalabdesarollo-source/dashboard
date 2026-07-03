import { clearStoredAuth, getStoredAuth } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import {
  clearProcessedScan,
  markScanAsProcessed,
  wasScanRecentlyProcessed,
} from "@/lib/notifications/authIndexedDb";
import type {
  ScanFollowUpNotificationData,
  ScanMarkErrorCode,
} from "@/lib/notifications/types";

export class ScanMarkError extends Error {
  code: ScanMarkErrorCode;

  constructor(message: string, code: ScanMarkErrorCode) {
    super(message);
    this.name = "ScanMarkError";
    this.code = code;
  }
}

export function parseScanFollowUpData(
  data: Record<string, string> | undefined | null,
): ScanFollowUpNotificationData | null {
  if (!data || data.action !== "scan_follow_up_reminder" || !data.scanId) {
    return null;
  }

  return {
    action: "scan_follow_up_reminder",
    scanId: data.scanId,
    dateTime: data.dateTime ?? "",
  };
}

export function getScanMarkErrorMessage(error: unknown): string {
  if (error instanceof ScanMarkError) {
    switch (error.code) {
      case "NO_TOKEN":
        return "Inicia sesión para confirmar";
      case "UNAUTHORIZED":
        return "Sesión expirada, inicia sesión de nuevo";
      case "NOT_FOUND":
        return "Escaneo no encontrado";
      case "NETWORK":
        return "No se pudo confirmar, intenta de nuevo";
      default:
        return "No se pudo confirmar, intenta de nuevo";
    }
  }

  return "No se pudo confirmar, intenta de nuevo";
}

function mapHttpStatusToError(status: number): ScanMarkError {
  if (status === 401) {
    return new ScanMarkError("Unauthorized", "UNAUTHORIZED");
  }
  if (status === 404) {
    return new ScanMarkError("Not found", "NOT_FOUND");
  }
  return new ScanMarkError(`Failed with status ${status}`, "UNKNOWN");
}

export async function markScanFromNotification(scanId: string, token: string) {
  if (await wasScanRecentlyProcessed(scanId)) {
    return { alreadyProcessed: true as const };
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/scans/${scanId}/mark-scanned`, {
      method: "PATCH",
      headers: {
        token,
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new ScanMarkError("Network error", "NETWORK");
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuth();
    }
    throw mapHttpStatusToError(response.status);
  }

  await markScanAsProcessed(scanId);

  const hasJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  if (hasJson) {
    return response.json();
  }

  return { success: true };
}

export async function confirmScanFromNotification(
  scanId: string,
  token?: string | null,
) {
  const authToken = token ?? getStoredAuth()?.token ?? null;
  if (!authToken) {
    throw new ScanMarkError("Missing auth token", "NO_TOKEN");
  }

  try {
    return await markScanFromNotification(scanId, authToken);
  } catch (error) {
    if (error instanceof ScanMarkError && error.code !== "UNAUTHORIZED") {
      await clearProcessedScan(scanId);
    }
    throw error;
  }
}

export function isScanFollowUpPayload(
  data: Record<string, string> | undefined | null,
): data is ScanFollowUpNotificationData {
  return parseScanFollowUpData(data) !== null;
}
