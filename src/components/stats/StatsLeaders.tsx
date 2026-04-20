"use client";

import type { StatsLeader, StatsResponse } from "@/components/stats/types";

type StatsLeadersProps = {
  leaders: StatsResponse["leaders"];
  formatPercent: (value: number) => string;
};

type LeaderCardConfig = {
  title: string;
  subtitle: string;
  value: StatsLeader | null;
  primaryMetricLabel: string;
  primaryMetricValue: (value: StatsLeader) => number;
  tone: "success" | "danger" | "info" | "brand" | "scanner";
};

const leaderToneClasses = {
  success: {
    card: "border-emerald-200 bg-emerald-50/60",
    badge: "bg-emerald-100 text-emerald-700",
    metric: "bg-white/80 text-emerald-900",
    empty: "border-emerald-200 bg-white/70 text-emerald-700",
  },
  danger: {
    card: "border-rose-200 bg-rose-50/60",
    badge: "bg-rose-100 text-rose-700",
    metric: "bg-white/80 text-rose-900",
    empty: "border-rose-200 bg-white/70 text-rose-700",
  },
  info: {
    card: "border-sky-200 bg-sky-50/60",
    badge: "bg-sky-100 text-sky-700",
    metric: "bg-white/80 text-sky-900",
    empty: "border-sky-200 bg-white/70 text-sky-700",
  },
  brand: {
    card: "border-violet-200 bg-violet-50/60",
    badge: "bg-violet-100 text-violet-700",
    metric: "bg-white/80 text-violet-900",
    empty: "border-violet-200 bg-white/70 text-violet-700",
  },
  scanner: {
    card: "border-cyan-200 bg-cyan-50/60",
    badge: "bg-cyan-100 text-cyan-700",
    metric: "bg-white/80 text-cyan-900",
    empty: "border-cyan-200 bg-white/70 text-cyan-700",
  },
} as const;

function LeaderCard({
  title,
  subtitle,
  value,
  primaryMetricLabel,
  primaryMetricValue,
  tone,
  formatPercent,
}: {
  title: string;
  subtitle: string;
  value: StatsLeader | null;
  primaryMetricLabel: string;
  primaryMetricValue: (value: StatsLeader) => number;
  tone: LeaderCardConfig["tone"];
  formatPercent: (value: number) => string;
}) {
  const styles = leaderToneClasses[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {subtitle}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
        >
          Lider
        </span>
      </div>

      {value ? (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div>
            <p className="text-base font-semibold text-slate-900">{value.name}</p>
            {value.clinicName && <p>{value.clinicName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className={`rounded-xl px-3 py-2 ${styles.metric}`}>
              <p>Total</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {value.totalScans}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${styles.metric}`}>
              <p>{primaryMetricLabel}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {primaryMetricValue(value)}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${styles.metric}`}>
              <p>Pendientes</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {value.pendingScans}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${styles.metric}`}>
              <p>Efectividad</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPercent(value.completionRate)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm ${styles.empty}`}
        >
          Sin datos
        </div>
      )}
    </div>
  );
}

export default function StatsLeaders({
  leaders,
  formatPercent,
}: StatsLeadersProps) {
  const cards: LeaderCardConfig[] = [
    {
      title: "Doctor con más completados",
      subtitle: "Mejor desempeño",
      value: leaders.doctorByCompleted,
      primaryMetricLabel: "Completados",
      primaryMetricValue: (value) => value.completedScans,
      tone: "success",
    },
    {
      title: "Doctor con más cancelados",
      subtitle: "Mayor cancelación",
      value: leaders.doctorByCancelled,
      primaryMetricLabel: "Cancelados",
      primaryMetricValue: (value) => value.cancelledScans,
      tone: "danger",
    },
    {
      title: "Clínica con más completados",
      subtitle: "Top clínica",
      value: leaders.clinicByCompleted,
      primaryMetricLabel: "Completados",
      primaryMetricValue: (value) => value.completedScans,
      tone: "info",
    },
    {
      title: "Admin que más creó",
      subtitle: "Mayor creación",
      value: leaders.adminByCreated,
      primaryMetricLabel: "Creados",
      primaryMetricValue: (value) => value.totalScans,
      tone: "brand",
    },
    {
      title: "Scanner con más completados",
      subtitle: "Top scanner",
      value: leaders.scannerByCompleted,
      primaryMetricLabel: "Completados",
      primaryMetricValue: (value) => value.completedScans,
      tone: "scanner",
    },
  ];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Líderes</h3>
        <p className="text-sm text-slate-500">
          Destacados del período según productividad y comportamiento.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <LeaderCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            value={card.value}
            primaryMetricLabel={card.primaryMetricLabel}
            primaryMetricValue={card.primaryMetricValue}
            tone={card.tone}
            formatPercent={formatPercent}
          />
        ))}
      </div>
    </div>
  );
}
