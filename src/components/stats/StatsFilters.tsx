"use client";

import type {
  StatsFilterState,
  StatsPeriodOption,
} from "@/components/stats/types";

type StatsFiltersProps = {
  filters: StatsFilterState;
  disabled?: boolean;
  validationMessage?: string | null;
  onChange: (patch: Partial<StatsFilterState>) => void;
  onPeriodChange: (period: StatsPeriodOption) => void;
  onReset: () => void;
};

const periodButtons: { label: string; value: StatsPeriodOption }[] = [
  { label: "Todos", value: "all" },
  { label: "Hoy", value: "today" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Personalizado", value: "custom" },
];

export default function StatsFilters({
  filters,
  disabled = false,
  validationMessage,
  onChange,
  onPeriodChange,
  onReset,
}: StatsFiltersProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Filtros</h3>
          <p className="text-sm text-slate-500">
            Ajusta el rango temporal de las estadísticas.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {periodButtons.map((period) => {
          const isActive = filters.period === period.value;
          return (
            <button
              key={period.value}
              type="button"
              onClick={() => onPeriodChange(period.value)}
              disabled={disabled}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {period.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {filters.period === "custom" && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Fecha inicial
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => onChange({ startDate: event.target.value })}
                disabled={disabled}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Fecha final
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
                disabled={disabled}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </>
        )}
      </div>

      {validationMessage && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {validationMessage}
        </div>
      )}
    </div>
  );
}
