type LoadingOverlayProps = {
  show: boolean;
  message?: string;
};

export default function LoadingOverlay({ show, message }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-slate-700 shadow-xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Procesando</p>
          <p className="text-sm text-slate-500">
            {message ?? "Un momento, por favor..."}
          </p>
        </div>
      </div>
    </div>
  );
}
