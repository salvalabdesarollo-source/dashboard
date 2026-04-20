"use client";

import type { StatsSummary } from "@/components/stats/types";

type StatsSummaryCardsProps = {
  summary: StatsSummary;
  formatPercent: (value: number) => string;
};

type SummaryItem = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneClasses: Record<NonNullable<SummaryItem["tone"]>, string> = {
  default: "border-slate-200 bg-white text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

export default function StatsSummaryCards({
  summary,
  formatPercent,
}: StatsSummaryCardsProps) {
  const items: SummaryItem[] = [
    { label: "Total de escaneos", value: summary.totalScans },
    {
      label: "Completados",
      value: summary.completedScans,
      tone: "success",
    },
    { label: "Pendientes", value: summary.pendingScans, tone: "warning" },
    { label: "Cancelados", value: summary.cancelledScans, tone: "danger" },
    { label: "Confirmados", value: summary.confirmedScans },
    { label: "Sin confirmar", value: summary.unconfirmedScans },
    { label: "Asignados", value: summary.assignedScans },
    { label: "No asignados", value: summary.unassignedScans },
    {
      label: "Pendientes sin asignar",
      value: summary.pendingUnassignedScans,
      tone: "warning",
    },
    { label: "Tasa de completados", value: formatPercent(summary.completionRate) },
    {
      label: "Tasa de cancelación",
      value: formatPercent(summary.cancellationRate),
    },
    { label: "Tasa de asignación", value: formatPercent(summary.assignmentRate) },
    {
      label: "Tasa de confirmación",
      value: formatPercent(summary.confirmationRate),
    },
  ];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Resumen</h3>
        <p className="text-sm text-slate-500">
          Indicadores clave del rango y filtros seleccionados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border p-4 shadow-sm ${
              toneClasses[item.tone ?? "default"]
            }`}
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
