"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Modal from "@/components/Modal";
import SearchableSelect from "@/components/SearchableSelect";
import { apiRequest, extractList, extractPagination } from "@/lib/api";
import { getStoredAuth } from "@/lib/auth";
import io from "socket.io-client";
import { SOCKET_URL, SOCKET_PATH } from "@/lib/config";
import { useRefresh } from "@/contexts/RefreshContext";

type User = {
  id: number;
  username: string;
};

type Doctor = {
  id: number;
  name: string;
  clinic?: Clinic | null;
};

type Clinic = {
  id: number;
  name: string;
};

type Scan = {
  id: number;
  dateTime: string;
  detail?: string | null;
  createdBy?: User | null;
  assignedTo?: User | null;
  requestedByDoctor?: Doctor | null;
  isScanned?: boolean;
  status?: "unconfirmed" | "confirmed" | "cancelled";
};

type ScanFormState = {
  dateValue: string;
  timeValue: string;
  detail: string;
  createdById: string;
  assignedToId: string;
  requestedByDoctorId: string;
};

const defaultFormState: ScanFormState = {
  dateValue: "",
  timeValue: "",
  detail: "",
  createdById: "",
  assignedToId: "",
  requestedByDoctorId: "",
};

const toLocalDateTimeParts = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  const isoLocal = local.toISOString();
  return {
    dateValue: isoLocal.slice(0, 10),
    timeValue: isoLocal.slice(11, 16),
  };
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hour24 = date.getHours();
  const minute = date.getMinutes();
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const formattedHour = hour12.toString().padStart(2, "0");
  const formattedMinute = minute.toString().padStart(2, "0");
  return `${day}/${month}/${year}, ${formattedHour}:${formattedMinute}`;
};

const toIsoFromDateTimeParts = (dateValue: string, timeValue: string) => {
  return `${dateValue}T${timeValue}:00`;
};

const buildWorkingTimeOptions = (dateValue: string) => {
  if (!dateValue) return [];
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  if (day === 0) return [];
  const isSaturday = day === 6;
  const startMinutes = 8 * 60;
  const endMinutes = isSaturday ? 13 * 60 + 30 : 19 * 60 + 30;
  const totalSlots = Math.floor((endMinutes - startMinutes) / 30) + 1;
  return Array.from({ length: totalSlots }, (_, index) => {
    const totalMinutes = startMinutes + index * 30;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60 === 0 ? "00" : "30";
    const hour12 = ((hour24 + 11) % 12) + 1;
    const period = hour24 < 12 ? "AM" : "PM";
    const label = `${hour12}:${minute} ${period}`;
    const value = `${hour24.toString().padStart(2, "0")}:${minute}`;
    return { label, value };
  });
};

export default function ScansPage() {
  const auth = getStoredAuth();
  const isAdmin = auth?.role === "Administrator";
  const isScanner = auth?.role === "Scanner";
  const [scans, setScans] = useState<Scan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formState, setFormState] = useState<ScanFormState>(defaultFormState);
  const [editingScan, setEditingScan] = useState<Scan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [occupiedError, setOccupiedError] = useState<string | null>(null);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [scannedFilter, setScannedFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const doctorOptions = useMemo(
    () =>
      doctors.map((doctor) => ({
        value: doctor.id.toString(),
        label: doctor.name,
      })),
    [doctors],
  );
  const assigneeOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id.toString(),
        label: user.username,
      })),
    [users],
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isActionBusy = isBusy;
  const timeOptions = useMemo(
    () => buildWorkingTimeOptions(formState.dateValue),
    [formState.dateValue],
  );

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (isScanner && auth?.id) {
      params.append("filter", `assignedTo.id||$eq||${auth.id}`);
    }
    if (creatorFilter) {
      params.append("filter", `createdBy.id||$eq||${creatorFilter}`);
    }
    if (assigneeFilter) {
      params.append("filter", `assignedTo.id||$eq||${assigneeFilter}`);
    }
    if (doctorFilter) {
      params.append("filter", `requestedByDoctor.id||$eq||${doctorFilter}`);
    }
    if (clinicFilter) {
      params.append("filter", `requestedByDoctor.clinic.id||$eq||${clinicFilter}`);
    }
    if (dateFilter) {
      params.append("filter", `dateTime||$gte||${dateFilter}T00:00:00.000Z`);
      params.append("filter", `dateTime||$lte||${dateFilter}T23:59:59.999Z`);
    }
    if (scannedFilter) {
      params.append("filter", `isScanned||$eq||${scannedFilter}`);
    }
    if (statusFilter) {
      params.append("filter", `status||$eq||${statusFilter}`);
    }
    return params.toString();
  };

  const loadUsers = async () => {
    const payload = await apiRequest<unknown>("/users");
    const list = extractList<User>(payload);
    setUsers(list);
    const auth = getStoredAuth();
    if (!formState.createdById && auth?.id) {
      setFormState((prev) => ({ ...prev, createdById: auth.id.toString() }));
    }
  };

  const loadDoctors = async () => {
    const payload = await apiRequest<unknown>("/doctors");
    setDoctors(extractList<Doctor>(payload));
  };

  const loadClinics = async () => {
    const payload = await apiRequest<unknown>("/clinics");
    setClinics(extractList<Clinic>(payload));
  };

  const loadScans = async () => {
    const payload = await apiRequest<unknown>(`/scans?${buildQuery()}`);
    setScans(extractList<Scan>(payload));
    const pagination = extractPagination(payload);
    if (pagination) {
      setPage(pagination.page);
      setPageCount(pagination.pageCount);
      setTotal(pagination.total);
    }
  };

  const { registerRefresh } = useRefresh();

  useEffect(() => {
    void loadUsers();
    void loadDoctors();
    void loadClinics();
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsBusy(true);
      setError(null);
      try {
        await loadScans();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar.");
      } finally {
        setIsBusy(false);
      }
    };
    void run();
  }, [
    page,
    limit,
    creatorFilter,
    assigneeFilter,
    doctorFilter,
    clinicFilter,
    dateFilter,
    scannedFilter,
    statusFilter,
  ]);

  useEffect(() => {
    const unregister = registerRefresh(async () => {
      await Promise.all([
        loadUsers(),
        loadDoctors(),
        loadClinics(),
        loadScans(),
      ]);
    });
    return unregister;
  }, [registerRefresh, page, limit, creatorFilter, assigneeFilter, doctorFilter, clinicFilter, dateFilter, scannedFilter, statusFilter]);

  const onOpenCreate = () => {
    setEditingScan(null);
    const auth = getStoredAuth();
    setFormState((prev) => ({
      ...defaultFormState,
      createdById: auth?.id ? auth.id.toString() : "",
    }));
    setShowForm(true);
    setShowTimePicker(false);
    setOccupiedSlots([]);
    setOccupiedError(null);
    setIsSlotsLoading(false);
  };

  const onEdit = (scan: Scan) => {
    if (scan.isScanned || scan.status === "cancelled") return;
    setEditingScan(scan);
    const { dateValue, timeValue } = scan.dateTime
      ? toLocalDateTimeParts(scan.dateTime)
      : { dateValue: "", timeValue: "" };
    setFormState({
      dateValue,
      timeValue,
      detail: scan.detail ?? "",
      createdById: scan.createdBy?.id?.toString() ?? "",
      assignedToId: scan.assignedTo?.id?.toString() ?? "",
      requestedByDoctorId: scan.requestedByDoctor?.id?.toString() ?? "",
    });
    setShowForm(true);
    setShowTimePicker(false);
    setOccupiedError(null);
    setIsSlotsLoading(false);
  };

  const onCancel = () => {
    setEditingScan(null);
    setFormState(defaultFormState);
    setShowForm(false);
    setShowTimePicker(false);
    setShowFilters(false);
    setOccupiedSlots([]);
    setOccupiedError(null);
    setIsSlotsLoading(false);
  };

  const mapUtcSlotsToLocal = (slots: string[], dateValue: string) => {
    const [year, month, day] = dateValue.split("-").map(Number);
    return slots
      .map((slot) => {
        const [hour, minute] = slot.split(":").map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        const localHour = utcDate.getHours().toString().padStart(2, "0");
        const localMinute = utcDate.getMinutes().toString().padStart(2, "0");
        return `${localHour}:${localMinute}`;
      })
      .filter((slot) => slot.length === 5);
  };

  const fetchOccupiedSlots = async () => {
    if (!formState.dateValue) {
      setOccupiedSlots([]);
      setOccupiedError(null);
      return;
    }
    setOccupiedError(null);
    setIsSlotsLoading(true);
    try {
      const params = new URLSearchParams({ date: formState.dateValue });
      if (editingScan?.id) {
        params.set("excludeScanId", editingScan.id.toString());
      }
      const payload = await apiRequest<string[]>(
        `/scans/occupied-slots?${params.toString()}`,
      );
      const mapped = mapUtcSlotsToLocal(payload, formState.dateValue);
      setOccupiedSlots(mapped);
    } catch (err) {
      setOccupiedError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar horarios ocupados.",
      );
      setOccupiedSlots([]);
    } finally {
      setIsSlotsLoading(false);
    }
  };

  useEffect(() => {
    void fetchOccupiedSlots();
  }, [formState.dateValue, editingScan?.id]);

  useEffect(() => {
    if (formState.timeValue && occupiedSlots.includes(formState.timeValue)) {
      setFormState((prev) => ({ ...prev, timeValue: "" }));
    }
  }, [occupiedSlots, formState.timeValue]);

  useEffect(() => {
    if (!formState.timeValue) return;
    const exists = timeOptions.some((option) => option.value === formState.timeValue);
    if (!exists) {
      setFormState((prev) => ({ ...prev, timeValue: "" }));
    }
  }, [formState.timeValue, timeOptions]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      if (!formState.dateValue || !formState.timeValue) {
        throw new Error("La fecha y hora son obligatorias.");
      }
      let createdById = formState.createdById;
      if (!createdById) {
        const auth = getStoredAuth();
        createdById = auth?.id ? auth.id.toString() : "";
      }
      if (!createdById) {
        throw new Error("No se detectó el usuario creador.");
      }
      if (!formState.requestedByDoctorId) {
        throw new Error("Selecciona el doctor solicitante.");
      }

      const payload: Record<string, unknown> = {
        dateTime: toIsoFromDateTimeParts(
          formState.dateValue,
          formState.timeValue,
        ),
        createdBy: { id: Number(createdById) },
        requestedByDoctor: { id: Number(formState.requestedByDoctorId) },
      };
      if (formState.detail) payload.detail = formState.detail;
      if (formState.assignedToId) {
        payload.assignedTo = { id: Number(formState.assignedToId) };
      } else if (editingScan) {
        payload.assignedTo = null;
      }

      if (editingScan) {
        await apiRequest(`/scans/${editingScan.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/scans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setFormState(defaultFormState);
      setEditingScan(null);
      setShowForm(false);
      await loadScans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const onUpdateStatus = async (nextStatus: "confirmed" | "cancelled") => {
    if (!editingScan) return;
    if (nextStatus === "cancelled" && editingScan.isScanned) {
      setError("No se puede cancelar un escaneo que ya está escaneado.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await apiRequest(`/scans/${editingScan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setEditingScan(null);
      setShowForm(false);
      await loadScans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setIsBusy(false);
    }
  };

  const isEditing = useMemo(() => Boolean(editingScan), [editingScan]);
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
    });

    const matchesFilters = (scan: Scan) => {
      if (isScanner && auth?.id) {
        if (scan.assignedTo?.id !== auth.id) return false;
      }
      if (creatorFilter && scan.createdBy?.id?.toString() !== creatorFilter) {
        return false;
      }
      if (assigneeFilter && scan.assignedTo?.id?.toString() !== assigneeFilter) {
        return false;
      }
      if (
        doctorFilter &&
        scan.requestedByDoctor?.id?.toString() !== doctorFilter
      ) {
        return false;
      }
      if (
        clinicFilter &&
        scan.requestedByDoctor?.clinic?.id?.toString() !== clinicFilter
      ) {
        return false;
      }
      if (dateFilter) {
        const { dateValue } = toLocalDateTimeParts(scan.dateTime);
        if (dateValue !== dateFilter) return false;
      }
      if (scannedFilter) {
        if (String(Boolean(scan.isScanned)) !== scannedFilter) return false;
      }
      if (statusFilter) {
        if (scan.status !== statusFilter) return false;
      }
      return true;
    };

    const applyScanUpdate = (scan: Scan) => {
      setScans((prev) => {
        const index = prev.findIndex((item) => item.id === scan.id);
        const shouldInclude = matchesFilters(scan);

        if (!shouldInclude) {
          if (index === -1) return prev;
          return prev.filter((item) => item.id !== scan.id);
        }

        if (index === -1) {
          const next = [scan, ...prev];
          return next
            .sort(
              (a, b) =>
                new Date(b.dateTime).getTime() -
                new Date(a.dateTime).getTime(),
            )
            .slice(0, limit);
        }

        const next = [...prev];
        next[index] = scan;
        return next.sort(
          (a, b) =>
            new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
        );
      });
    };

    const normalizeScan = (action: string | undefined, scan: Scan) => {
      if (action === "unassigned") {
        return { ...scan, assignedTo: null };
      }
      return scan;
    };

    const handler = ({ action, scan }: { action: string; scan: Scan }) => {
      applyScanUpdate(normalizeScan(action, scan));
    };

    socket.on("scans.event", handler);
    socket.on("scans.created", (scan: Scan) => applyScanUpdate(scan));
    socket.on("scans.updated", (scan: Scan) => applyScanUpdate(scan));
    socket.on("scans.assigned", (scan: Scan) => applyScanUpdate(scan));
    socket.on("scans.unassigned", (scan: Scan) =>
      applyScanUpdate({ ...scan, assignedTo: null }),
    );
    socket.on("scans.scanned", (scan: Scan) => applyScanUpdate(scan));

    return () => {
      socket.off("scans.event", handler);
      socket.off("scans.created", applyScanUpdate);
      socket.off("scans.updated", applyScanUpdate);
      socket.off("scans.assigned", applyScanUpdate);
      socket.off("scans.unassigned", applyScanUpdate);
      socket.off("scans.scanned", applyScanUpdate);
      socket.disconnect();
    };
  }, [
    creatorFilter,
    assigneeFilter,
    doctorFilter,
    clinicFilter,
    dateFilter,
    scannedFilter,
    statusFilter,
    limit,
  ]);

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isBusy} message="Actualizando escaneos..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Lista de escaneos
            </h3>
            <p className="text-sm text-slate-500">
              Total: {total} escaneos
            </p>
          </div>
          {isAdmin && (
            <button
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onOpenCreate}
              type="button"
              disabled={isActionBusy}
            >
              Nuevo escaneo
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:grid md:grid-cols-8">
          <div className="flex gap-2 md:col-span-1">
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
              value={scannedFilter}
              onChange={(event) => {
                setScannedFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Escaneados</option>
              <option value="false">Pendientes</option>
            </select>
            <button
              type="button"
              className="whitespace-nowrap rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 md:hidden disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setShowFilters(true)}
              disabled={isActionBusy}
            >
              Filtros
            </button>
          </div>
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="unconfirmed">Sin confirmar</option>
            <option value="confirmed">Confirmado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <input
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={creatorFilter}
            onChange={(event) => {
              setCreatorFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los creadores</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={assigneeFilter}
            onChange={(event) => {
              setAssigneeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los asignados</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={doctorFilter}
            onChange={(event) => {
              setDoctorFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los doctores</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={clinicFilter}
            onChange={(event) => {
              setClinicFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las clínicas</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
          <select
            className="hidden w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none md:block"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={5}>5 por página</option>
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
          </select>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="relative rounded-2xl border border-slate-200 p-4"
            >
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-900">
                  {scan.dateTime ? formatDateTime(scan.dateTime) : "-"}
                </p>
                {scan.detail && (
                  <p className="text-xs text-slate-600">{scan.detail}</p>
                )}
                <p className="text-xs text-slate-600">
                  Creador: {scan.createdBy?.username ?? "-"}
                </p>
                {isAdmin && scan.assignedTo?.username && (
                  <p className="text-xs text-slate-600">
                    Asignado: {scan.assignedTo.username}
                  </p>
                )}
                <p className="text-xs text-slate-600">
                  Doctor: {scan.requestedByDoctor?.name ?? "-"}
                </p>
                <div className="absolute right-3 top-3 flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      scan.status === "confirmed"
                        ? "bg-emerald-500"
                        : scan.status === "cancelled"
                          ? "bg-rose-500"
                          : "bg-orange-400"
                    }`}
                  />
                  <span>
                    {scan.status === "confirmed"
                      ? "Confirmado"
                      : scan.status === "cancelled"
                        ? "Cancelado"
                        : "Sin confirmar"}
                    {scan.isScanned && " - Escaneado"}
                  </span>
                </div>
                {isAdmin && !scan.isScanned && scan.status !== "cancelled" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onEdit(scan)}
                      type="button"
                      disabled={isActionBusy}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {scans.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              No hay escaneos registrados.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3">Fecha</th>
                <th>Detalle</th>
                <th>Creador</th>
                {isAdmin && <th>Asignado</th>}
                <th>Doctor</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-900">
                    {scan.dateTime ? formatDateTime(scan.dateTime) : "-"}
                  </td>
                  <td className="text-slate-600">{scan.detail ?? "-"}</td>
                  <td className="text-slate-600">
                    {scan.createdBy?.username ?? "-"}
                  </td>
                  {isAdmin && (
                    <td className="text-slate-600">
                      {scan.assignedTo?.username ?? "-"}
                    </td>
                  )}
                  <td className="text-slate-600">
                    {scan.requestedByDoctor?.name ?? "-"}
                  </td>
                  <td className="text-slate-600">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          scan.status === "confirmed"
                            ? "bg-emerald-500"
                            : scan.status === "cancelled"
                              ? "bg-rose-500"
                              : "bg-orange-400"
                        }`}
                      />
                      <span>
                        {scan.status === "confirmed"
                          ? "Confirmado"
                          : scan.status === "cancelled"
                            ? "Cancelado"
                            : "Sin confirmar"}
                        {scan.isScanned && " - Escaneado"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    {isAdmin && !scan.isScanned && scan.status !== "cancelled" && (
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => onEdit(scan)}
                          type="button"
                          disabled={isActionBusy}
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td
                    className="py-6 text-center text-slate-400"
                    colSpan={isAdmin ? 7 : 6}
                  >
                    No hay escaneos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>
            Página {page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={page <= 1 || isActionBusy}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Anterior
            </button>
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={page >= pageCount || isActionBusy}
              onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <Modal
          open={showForm}
          title={isEditing ? "Editar escaneo" : "Crear escaneo"}
          onClose={onCancel}
        >
          <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Fecha
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
                type="date"
                value={formState.dateValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    dateValue: nextValue,
                  }));
                  if (nextValue) {
                    setShowTimePicker(true);
                    void fetchOccupiedSlots();
                  }
                }}
                required
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Hora</p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    setShowTimePicker(true);
                    void fetchOccupiedSlots();
                  }}
                  disabled={!formState.dateValue || isActionBusy}
                >
                  {formState.timeValue ? "Cambiar hora" : "Seleccionar hora"}
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {formState.timeValue
                  ? `Hora seleccionada: ${
                      timeOptions.find(
                        (option) => option.value === formState.timeValue,
                      )?.label ?? formState.timeValue
                    }`
                  : !formState.dateValue
                    ? "Selecciona un día para ver horarios."
                    : timeOptions.length === 0
                      ? "No hay horarios disponibles para este día."
                      : "Aún no has elegido una hora."}
              </p>
              {occupiedError && (
                <p className="mt-2 text-xs text-rose-600">{occupiedError}</p>
              )}
            </div>
          </div>

          {showTimePicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4 py-8">
              <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Seleccionar horario
                  </h3>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setShowTimePicker(false)}
                    disabled={isActionBusy}
                  >
                    Cerrar
                  </button>
                </div>
                <div className="px-6 py-5">
                  {isSlotsLoading ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-slate-600">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                      <p className="text-sm">
                        Cargando disponibilidad...
                      </p>
                    </div>
                  ) : (
                    <>
                      {timeOptions.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No hay horarios disponibles para este día.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {timeOptions.map((option) => {
                            const isSelected =
                              formState.timeValue === option.value;
                            const isOccupied = occupiedSlots.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                disabled={isOccupied || isActionBusy}
                                onClick={() => {
                                  if (isOccupied) return;
                                  setFormState((prev) => ({
                                    ...prev,
                                    timeValue: option.value,
                                  }));
                                  setShowTimePicker(false);
                                }}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-sky-500 bg-sky-50 text-sky-700"
                                    : isOccupied
                                      ? "border-rose-200 bg-rose-50 text-rose-600"
                                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="mt-4 text-xs text-slate-500">
                        Horarios ocupados están deshabilitados.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Detalle (opcional)
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.detail}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  detail: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Usuario asignado (opcional)
            <div className="mt-1">
              <SearchableSelect
                options={assigneeOptions}
                value={formState.assignedToId}
                onChange={(nextValue) =>
                  setFormState((prev) => ({
                    ...prev,
                    assignedToId: nextValue,
                  }))
                }
                placeholder="Buscar usuario"
                emptyLabel="Sin asignar"
                disabled={isActionBusy}
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Doctor solicitante
            <div className="mt-1">
              <SearchableSelect
                options={doctorOptions}
                value={formState.requestedByDoctorId}
                onChange={(nextValue) =>
                  setFormState((prev) => ({
                    ...prev,
                    requestedByDoctorId: nextValue,
                  }))
                }
                placeholder="Buscar doctor"
                emptyLabel="Selecciona un doctor"
                disabled={isActionBusy}
              />
            </div>
          </label>

          {isEditing && isAdmin && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-700">Estado</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onUpdateStatus("confirmed")}
                  disabled={isActionBusy || editingScan?.status === "confirmed"}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onUpdateStatus("cancelled")}
                  disabled={isActionBusy || editingScan?.status === "cancelled" || editingScan?.isScanned}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isActionBusy}
            >
              {isActionBusy ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear escaneo"}
            </button>
            {isEditing && (
              <button
                className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onCancel}
                disabled={isActionBusy}
              >
                Cancelar edición
              </button>
            )}
          </div>
          </form>
        </Modal>
      )}

      <Modal
        open={showFilters}
        title="Filtros"
        onClose={() => setShowFilters(false)}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Estado
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={scannedFilter}
              onChange={(event) => {
                setScannedFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Escaneados</option>
              <option value="false">Pendientes</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Estado de confirmación
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="unconfirmed">Sin confirmar</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Fecha
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Creador
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={creatorFilter}
              onChange={(event) => {
                setCreatorFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los creadores</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Asignado
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={assigneeFilter}
              onChange={(event) => {
                setAssigneeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los asignados</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Doctor
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={doctorFilter}
              onChange={(event) => {
                setDoctorFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los doctores</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Clínica
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={clinicFilter}
              onChange={(event) => {
                setClinicFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las clínicas</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Resultados por página
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
