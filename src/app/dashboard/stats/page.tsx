"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";
import StatsFilters from "@/components/stats/StatsFilters";
import StatsLeaders from "@/components/stats/StatsLeaders";
import StatsRankingTable from "@/components/stats/StatsRankingTable";
import StatsSummaryCards from "@/components/stats/StatsSummaryCards";
import type {
  StatsFilterState,
  StatsLeader,
  StatsRankingItem,
  StatsResponse,
} from "@/components/stats/types";
import { useRefresh } from "@/contexts/RefreshContext";
import { apiRequest } from "@/lib/api";
import { getStoredAuth } from "@/lib/auth";

const defaultFilters: StatsFilterState = {
  period: "all",
  startDate: "",
  endDate: "",
  clinicId: "",
  doctorId: "",
  createdById: "",
  assignedToId: "",
};

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableString = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
};

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeLeader = (value: unknown): StatsLeader | null => {
  const record = toRecord(value);
  if (!record) return null;

  return {
    id:
      record.id === undefined || record.id === null
        ? null
        : (record.id as number | string),
    name: String(record.name ?? record.username ?? record.title ?? "Sin datos"),
    clinicName: toNullableString(
      record.clinicName ?? toRecord(record.clinic)?.name ?? null,
    ),
    totalScans: toNumber(record.totalScans ?? record.createdScans),
    completedScans: toNumber(record.completedScans ?? record.createdScans),
    pendingScans: toNumber(record.pendingScans),
    cancelledScans: toNumber(record.cancelledScans),
    completionRate: toNumber(record.completionRate),
  };
};

const normalizeRankingList = (value: unknown): StatsRankingItem[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeLeader(item)).filter(Boolean) as StatsRankingItem[];
};

const normalizeStatsResponse = (payload: unknown): StatsResponse => {
  const root = toRecord(payload) ?? {};
  const filters = toRecord(root.filters) ?? {};
  const summary = toRecord(root.overview ?? root.summary) ?? {};
  const leaders = toRecord(root.leaders) ?? {};
  const rankings = toRecord(root.rankings) ?? {};
  const catalog = toRecord(root.catalog) ?? {};
  const resolvedRange = toRecord(filters.resolvedRange);

  return {
    filters: {
      period: (filters.period as StatsResponse["filters"]["period"]) ?? null,
      startDate: toNullableString(filters.startDate),
      endDate: toNullableString(filters.endDate),
      clinicId: (filters.clinicId as number | string | null) ?? null,
      doctorId: (filters.doctorId as number | string | null) ?? null,
      createdById: (filters.createdById as number | string | null) ?? null,
      assignedToId: (filters.assignedToId as number | string | null) ?? null,
      resolvedRange: resolvedRange
        ? {
            startDate: String(
              resolvedRange.startDate ?? resolvedRange.start ?? "",
            ),
            endDate: String(resolvedRange.endDate ?? resolvedRange.end ?? ""),
          }
        : null,
    },
    summary: {
      totalScans: toNumber(summary.totalScans),
      completedScans: toNumber(summary.completedScans ?? summary.completed),
      pendingScans: toNumber(summary.pendingScans ?? summary.pending),
      cancelledScans: toNumber(summary.cancelledScans ?? summary.cancelled),
      confirmedScans: toNumber(summary.confirmedScans ?? summary.confirmed),
      unconfirmedScans: toNumber(
        summary.unconfirmedScans ?? summary.unconfirmed,
      ),
      assignedScans: toNumber(summary.assignedScans ?? summary.assigned),
      unassignedScans: toNumber(summary.unassignedScans ?? summary.unassigned),
      pendingUnassignedScans: toNumber(
        summary.pendingUnassignedScans ??
          summary.pendingUnassigned ??
          summary.unassignedPendingScans,
      ),
      completionRate: toNumber(summary.completionRate),
      cancellationRate: toNumber(summary.cancellationRate),
      assignmentRate: toNumber(summary.assignmentRate),
      confirmationRate: toNumber(summary.confirmationRate),
    },
    leaders: {
      doctorByCompleted: normalizeLeader(
        leaders.doctorByCompleted ??
          leaders.doctorMostCompleted ??
          leaders.topDoctorByCompleted,
      ),
      doctorByCancelled: normalizeLeader(
        leaders.doctorByCancelled ??
          leaders.doctorMostCancelled ??
          leaders.topDoctorByCancelled,
      ),
      clinicByCompleted: normalizeLeader(
        leaders.clinicByCompleted ??
          leaders.clinicMostCompleted ??
          leaders.topClinicByCompleted,
      ),
      adminByCreated: normalizeLeader(
        leaders.adminByCreated ??
          leaders.adminMostCreated ??
          leaders.topAdminByCreated,
      ),
      scannerByCompleted: normalizeLeader(
        leaders.scannerByCompleted ??
          leaders.scannerMostCompleted ??
          leaders.topScannerByCompleted,
      ),
    },
    rankings: {
      doctorsByCompleted: normalizeRankingList(rankings.doctorsByCompleted),
      doctorsByCancelled: normalizeRankingList(rankings.doctorsByCancelled),
      clinicsByCompleted: normalizeRankingList(rankings.clinicsByCompleted),
      adminsByCreated: normalizeRankingList(rankings.adminsByCreated),
      scannersByCompleted: normalizeRankingList(rankings.scannersByCompleted),
    },
    catalog: {
      totalUsers: toNumber(catalog.totalUsers),
      totalAdmins: toNumber(catalog.totalAdmins),
      totalScanners: toNumber(catalog.totalScanners),
      totalDoctors: toNumber(catalog.totalDoctors),
      totalClinics: toNumber(catalog.totalClinics),
      averageScansPerDoctor: toNumber(catalog.averageScansPerDoctor),
      averageScansPerClinic: toNumber(catalog.averageScansPerClinic),
    },
  };
};

export default function StatsPage() {
  const router = useRouter();
  const auth = getStoredAuth();
  const isAdmin = auth?.role === "Administrator";
  const todayValue = useMemo(() => toDateValue(new Date()), []);
  const [filters, setFilters] = useState<StatsFilterState>(defaultFilters);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const { registerRefresh } = useRefresh();

  useEffect(() => {
    if (auth && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [auth, isAdmin, router]);

  const statsQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.period === "custom") {
      if (!filters.startDate || !filters.endDate) {
        return {
          isValid: false,
          query: "",
          validationMessage:
            "Selecciona fecha inicial y fecha final para usar el rango personalizado.",
        };
      }

      if (filters.startDate > filters.endDate) {
        return {
          isValid: false,
          query: "",
          validationMessage:
            "La fecha inicial no puede ser mayor que la fecha final.",
        };
      }

      params.set("startDate", filters.startDate);
      params.set("endDate", filters.endDate);
    } else {
      params.set("period", filters.period);
    }

    return {
      isValid: true,
      query: params.toString(),
      validationMessage: null,
    };
  }, [filters]);

  const loadStats = useCallback(async (query: string) => {
    setIsStatsLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(`/scans/stats/summary?${query}`);
      setStats(normalizeStatsResponse(payload));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las estadísticas.",
      );
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || !statsQuery.isValid) return;
    void loadStats(statsQuery.query);
  }, [isAdmin, loadStats, statsQuery]);

  useEffect(() => {
    if (!isAdmin) return;
    const unregister = registerRefresh(async () => {
      if (!statsQuery.isValid) return;
      await loadStats(statsQuery.query);
    });
    return unregister;
  }, [isAdmin, loadStats, registerRefresh, statsQuery]);

  const onFiltersChange = useCallback((patch: Partial<StatsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const onPeriodChange = useCallback(
    (period: StatsFilterState["period"]) => {
      setFilters((prev) => {
        if (period !== "custom") {
          return { ...prev, period };
        }

        return {
          ...prev,
          period,
          startDate: prev.startDate || todayValue,
          endDate: prev.endDate || todayValue,
        };
      });
    },
    [todayValue],
  );

  const onResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const formatPercent = useCallback((value: number) => {
    const normalized =
      Math.abs(value) <= 1 && value !== 0 ? value * 100 : value;
    return `${new Intl.NumberFormat("es-ES", {
      maximumFractionDigits: 2,
    }).format(normalized)}%`;
  }, []);

  const formatNumber = useCallback(
    (value: number) =>
      new Intl.NumberFormat("es-ES", {
        maximumFractionDigits: 2,
      }).format(value),
    [],
  );

  const isEmptyState = useMemo(() => {
    if (!stats) return false;
    return (
      stats.summary.totalScans === 0 &&
      Object.values(stats.rankings).every((items) => items.length === 0)
    );
  }, [stats]);

  const catalogItems = useMemo(
    () =>
      stats
        ? [
            { label: "Usuarios totales", value: stats.catalog.totalUsers },
            { label: "Admins", value: stats.catalog.totalAdmins },
            { label: "Scanners", value: stats.catalog.totalScanners },
            { label: "Doctores", value: stats.catalog.totalDoctors },
            { label: "Clínicas", value: stats.catalog.totalClinics },
            {
              label: "Promedio de escaneos por doctor",
              value: formatNumber(stats.catalog.averageScansPerDoctor),
            },
            {
              label: "Promedio de escaneos por clínica",
              value: formatNumber(stats.catalog.averageScansPerClinic),
            },
          ]
        : [],
    [formatNumber, stats],
  );

  if (!auth || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isStatsLoading} message="Cargando estadísticas..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <StatsFilters
        filters={filters}
        disabled={isStatsLoading}
        validationMessage={statsQuery.validationMessage}
        onChange={onFiltersChange}
        onPeriodChange={onPeriodChange}
        onReset={onResetFilters}
      />

      {stats && (
        <>
          {isEmptyState && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              No hay datos disponibles para el rango seleccionado.
            </div>
          )}

          <StatsSummaryCards summary={stats.summary} formatPercent={formatPercent} />

          <StatsLeaders leaders={stats.leaders} formatPercent={formatPercent} />

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">Catálogo</h3>
              <p className="text-sm text-slate-500">
                Vista global de entidades y promedios del sistema.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {catalogItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <StatsRankingTable
              title="Ranking de doctores por completados"
              subtitle="Doctores con más escaneos completados en el histórico."
              items={stats.rankings.doctorsByCompleted}
              formatPercent={formatPercent}
            />
            <StatsRankingTable
              title="Ranking de doctores por cancelados"
              subtitle="Doctores con mayor cantidad de escaneos cancelados."
              items={stats.rankings.doctorsByCancelled}
              formatPercent={formatPercent}
            />
            <StatsRankingTable
              title="Ranking de admins por creados"
              subtitle="Administradores que más escaneos han registrado."
              items={stats.rankings.adminsByCreated}
              formatPercent={formatPercent}
            />
            <StatsRankingTable
              title="Ranking de scanners por completados"
              subtitle="Scanners con mayor número de escaneos completados."
              items={stats.rankings.scannersByCompleted}
              formatPercent={formatPercent}
            />
          </div>
        </>
      )}
    </div>
  );
}
