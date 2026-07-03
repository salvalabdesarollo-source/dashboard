export type ToastType = "success" | "error";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitToast(message: string, type: ToastType) {
  const toast: ToastItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
  };
  listeners.forEach((listener) => listener(toast));
}

export function showToast(message: string, type: ToastType = "success") {
  emitToast(message, type);
}

export function showSuccessToast(message: string) {
  showToast(message, "success");
}

export function showErrorToast(message: string) {
  showToast(message, "error");
}
