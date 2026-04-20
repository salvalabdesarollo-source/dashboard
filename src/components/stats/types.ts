"use client";

export type StatsPeriodOption = "all" | "today" | "week" | "month" | "custom";
export type StatsApiPeriod = Exclude<StatsPeriodOption, "custom">;

export type StatsFilterState = {
  period: StatsPeriodOption;
  startDate: string;
  endDate: string;
  clinicId: string;
  doctorId: string;
  createdById: string;
  assignedToId: string;
};

export type StatsSelectOption = {
  value: string;
  label: string;
};

export type StatsResolvedRange = {
  startDate: string;
  endDate: string;
};

export type StatsSummary = {
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  cancelledScans: number;
  confirmedScans: number;
  unconfirmedScans: number;
  assignedScans: number;
  unassignedScans: number;
  pendingUnassignedScans: number;
  completionRate: number;
  cancellationRate: number;
  assignmentRate: number;
  confirmationRate: number;
};

export type StatsLeader = {
  id?: number | string | null;
  name: string;
  clinicName?: string | null;
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  cancelledScans: number;
  completionRate: number;
};

export type StatsRankingItem = {
  id?: number | string | null;
  name: string;
  clinicName?: string | null;
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  cancelledScans: number;
  completionRate: number;
};

export type StatsCatalog = {
  totalUsers: number;
  totalAdmins: number;
  totalScanners: number;
  totalDoctors: number;
  totalClinics: number;
  averageScansPerDoctor: number;
  averageScansPerClinic: number;
};

export type StatsResponse = {
  filters: {
    period?: StatsApiPeriod | null;
    startDate?: string | null;
    endDate?: string | null;
    clinicId?: number | string | null;
    doctorId?: number | string | null;
    createdById?: number | string | null;
    assignedToId?: number | string | null;
    resolvedRange: StatsResolvedRange | null;
  };
  summary: StatsSummary;
  leaders: {
    doctorByCompleted: StatsLeader | null;
    doctorByCancelled: StatsLeader | null;
    clinicByCompleted: StatsLeader | null;
    adminByCreated: StatsLeader | null;
    scannerByCompleted: StatsLeader | null;
  };
  rankings: {
    doctorsByCompleted: StatsRankingItem[];
    doctorsByCancelled: StatsRankingItem[];
    clinicsByCompleted: StatsRankingItem[];
    adminsByCreated: StatsRankingItem[];
    scannersByCompleted: StatsRankingItem[];
  };
  catalog: StatsCatalog;
};
