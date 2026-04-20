"use client";

import type { StatsRankingItem } from "@/components/stats/types";

type StatsRankingTableProps = {
  title: string;
  subtitle: string;
  items: StatsRankingItem[];
  formatPercent: (value: number) => string;
};

export default function StatsRankingTable({
  title,
  subtitle,
  items,
  formatPercent,
}: StatsRankingTableProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Sin datos
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-3">Nombre</th>
                  <th>Clínica</th>
                  <th>Total</th>
                  <th>Completados</th>
                  <th>Pendientes</th>
                  <th>Cancelados</th>
                  <th>Efectividad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.id ?? item.name}-${index}`} className="border-b border-slate-100">
                    <td className="py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="text-slate-600">{item.clinicName ?? "-"}</td>
                    <td className="text-slate-600">{item.totalScans}</td>
                    <td className="text-slate-600">{item.completedScans}</td>
                    <td className="text-slate-600">{item.pendingScans}</td>
                    <td className="text-slate-600">{item.cancelledScans}</td>
                    <td className="text-slate-600">
                      {formatPercent(item.completionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item, index) => (
              <div
                key={`${item.id ?? item.name}-${index}`}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.clinicName ?? "Sin clínica"}
                    </p>
                  </div>
                  <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {formatPercent(item.completionRate)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p>Total</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.totalScans}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p>Completados</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.completedScans}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p>Pendientes</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.pendingScans}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p>Cancelados</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.cancelledScans}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
