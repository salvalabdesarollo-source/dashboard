export type ScanFollowUpNotificationData = {
  action: "scan_follow_up_reminder";
  scanId: string;
  dateTime: string;
};

export type ScanMarkedFromNotificationMessage = {
  type: "SCAN_MARKED_FROM_NOTIFICATION";
  scanId: string;
  result: ScanMarkNotificationResult;
};

export type ScanMarkNotificationResult =
  | { success: true; alreadyProcessed?: boolean }
  | { error: ScanMarkErrorCode };

export type ScanMarkErrorCode =
  | "NO_TOKEN"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NETWORK"
  | "UNKNOWN";
