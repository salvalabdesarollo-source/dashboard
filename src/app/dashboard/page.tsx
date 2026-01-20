"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Modal from "@/components/Modal";
import SearchableSelect from "@/components/SearchableSelect";
import { apiRequest, extractList } from "@/lib/api";
import { getStoredAuth } from "@/lib/auth";
import io from "socket.io-client";
import { SOCKET_URL, SOCKET_PATH } from "@/lib/config";

type Doctor = {
  id: number;
  name: string;
  clinic?: {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
  } | null;
};

type Scan = {
  id: number;
  dateTime: string;
  detail?: string | null;
  requestedByDoctor?: Doctor | null;
  assignedTo?: { id: number; username: string } | null;
  isScanned?: boolean;
  status?: "unconfirmed" | "confirmed" | "cancelled";
};

type CreateScanForm = {
  doctorId: string;
  detail: string;
  assignedToId: string;
};

const defaultForm: CreateScanForm = {
  doctorId: "",
  detail: "",
  assignedToId: "",
};

const buildWorkingSlots = (dateValue: string) => {
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
    return {
      label: `${hour12}:${minute} ${period}`,
      value: `${hour24.toString().padStart(2, "0")}:${minute}`,
    };
  });
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const toLocalDate = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return {
    dateValue: local.toISOString().slice(0, 10),
    timeValue: local.toISOString().slice(11, 16),
  };
};

export default function DashboardHome() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [scans, setScans] = useState<Scan[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<
    { id: number; username: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [formState, setFormState] = useState<CreateScanForm>(defaultForm);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      assignedUsers.map((user) => ({
        value: user.id.toString(),
        label: user.username,
      })),
    [assignedUsers],
  );
  const auth = getStoredAuth();
  const currentUserId = auth?.id ?? null;
  const isAdmin = auth?.role === "Administrator";
  const isActionBusy = isLoading;
  const timeSlots = useMemo(
    () => buildWorkingSlots(selectedDate),
    [selectedDate],
  );

  const loadScans = async (dateValue: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(`/scans/by-date?date=${dateValue}`);
      setScans(extractList<Scan>(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar.");
      setScans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDoctors = async () => {
    const payload = await apiRequest<unknown>("/doctors");
    setDoctors(extractList<Doctor>(payload));
  };

  const loadAssignedUsers = async () => {
    const payload = await apiRequest<unknown>("/users");
    setAssignedUsers(extractList<{ id: number; username: string }>(payload));
  };

  useEffect(() => {
    void loadDoctors();
    void loadAssignedUsers();
  }, []);

  useEffect(() => {
    void loadScans(selectedDate);
  }, [selectedDate]);

  const slotsByTime = useMemo(() => {
    const map = new Map<string, Scan[]>();
    scans.forEach((scan) => {
      if (scan.status === "cancelled") return;
      const { dateValue, timeValue } = toLocalDate(scan.dateTime);
      if (dateValue !== selectedDate) return;
      if (!map.has(timeValue)) map.set(timeValue, []);
      map.get(timeValue)?.push(scan);
    });
    return map;
  }, [scans, selectedDate]);

  const onChangeDate = (deltaDays: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const onOpenCreate = (slotValue: string) => {
    if (!isAdmin) return;
    setSelectedSlot(slotValue);
    setFormState(defaultForm);
    setShowCreate(true);
  };

  const onCloseCreate = () => {
    setShowCreate(false);
    setSelectedSlot(null);
    setFormState(defaultForm);
  };

  const onOpenManage = (scan: Scan) => {
    if (!isAdmin && scan.assignedTo?.id !== currentUserId) return;
    setSelectedScan(scan);
    setShowManage(true);
  };

  const onCloseManage = () => {
    setSelectedScan(null);
    setShowManage(false);
  };

  const onAssignToMe = async (scan: Scan) => {
    if (!currentUserId) {
      setError("No se detectó el usuario actual.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest(`/scans/${scan.id}/assign/${currentUserId}`, {
        method: "PATCH",
      });
      await loadScans(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar.");
    } finally {
      setIsLoading(false);
    }
  };

  const onUnassign = async () => {
    if (!selectedScan) return;
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest(`/scans/${selectedScan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedTo: null }),
      });
      onCloseManage();
      await loadScans(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desasignar.");
    } finally {
      setIsLoading(false);
    }
  };

  const onMarkScanned = async () => {
    if (!selectedScan) return;
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest(`/scans/${selectedScan.id}/mark-scanned`, {
        method: "PATCH",
      });
      onCloseManage();
      await loadScans(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar.");
    } finally {
      setIsLoading(false);
    }
  };

  const onUpdateStatus = async (nextStatus: "confirmed" | "cancelled") => {
    if (!selectedScan) return;
    if (nextStatus === "cancelled" && selectedScan.isScanned) {
      setError("No se puede cancelar un escaneo que ya está escaneado.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest(`/scans/${selectedScan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      onCloseManage();
      await loadScans(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot) return;
    setIsLoading(true);
    setError(null);
    try {
      const auth = getStoredAuth();
      const createdById = auth?.id ? auth.id.toString() : "";
      if (!createdById) {
        throw new Error("No se detectó el usuario creador.");
      }
      if (!formState.doctorId) {
        throw new Error("Selecciona el doctor solicitante.");
      }
      const dateTime = new Date(`${selectedDate}T${selectedSlot}:00`).toISOString();
      const payload: Record<string, unknown> = {
        dateTime,
        createdBy: { id: Number(createdById) },
        requestedByDoctor: { id: Number(formState.doctorId) },
      };
      if (formState.detail) payload.detail = formState.detail;
      if (formState.assignedToId) {
        payload.assignedTo = { id: Number(formState.assignedToId) };
      }
      await apiRequest("/scans", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCloseCreate();
      await loadScans(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDateLabel = useMemo(
    () => formatDateLabel(new Date(`${selectedDate}T00:00:00`)),
    [selectedDate],
  );

  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
    });

    const applyScanUpdate = (scan: Scan) => {
      setScans((prev) => {
        const { dateValue } = toLocalDate(scan.dateTime);
        const matchesDate = dateValue === selectedDateRef.current;
        const index = prev.findIndex((item) => item.id === scan.id);

        if (!matchesDate) {
          if (index === -1) return prev;
          return prev.filter((item) => item.id !== scan.id);
        }

        if (index === -1) {
          return [scan, ...prev];
        }

        const next = [...prev];
        next[index] = scan;
        return next;
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
  }, []);

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isLoading} message="Cargando agenda..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => onChangeDate(-1)}
            disabled={isActionBusy}
          >
            ◀
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Agenda
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {selectedDateLabel}
            </h2>
          </div>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => onChangeDate(1)}
            disabled={isActionBusy}
          >
            ▶
          </button>
        </div>

        {timeSlots.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No hay horarios disponibles para este día.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {timeSlots.map((slot) => {
              const slotScans = slotsByTime.get(slot.value) ?? [];
              return (
                <div key={slot.value} className="grid grid-cols-[80px_1fr] gap-4">
                  <div className="flex items-start py-3 text-xs text-slate-400">
                    <span>{slot.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (slotScans.length === 0) {
                        onOpenCreate(slot.value);
                      }
                    }}
                    disabled={isActionBusy}
                    className={`flex min-h-16 w-full items-start rounded-2xl border px-4 py-3 text-left transition md:h-16 md:items-center ${
                      slotScans.length
                        ? "border-sky-200 bg-sky-50"
                        : "border-dashed border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {slotScans.length ? (
                      <div className="space-y-1 text-sm">
                        {slotScans.map((scan) => {
                          const assignedName = scan.assignedTo?.username ?? null;
                          const canManage =
                            !scan.isScanned &&
                            (isAdmin || scan.assignedTo?.id === currentUserId);
                          const statusText =
                            scan.status === "confirmed"
                              ? "Confirmado"
                              : scan.status === "cancelled"
                                ? "Cancelado"
                                : "Sin confirmar";
                          const statusColor =
                            scan.status === "confirmed"
                              ? "bg-emerald-500"
                              : scan.status === "cancelled"
                                ? "bg-rose-500"
                                : "bg-orange-400";
                          return (
                            <div
                              key={scan.id}
                              className="relative flex items-start justify-between gap-3"
                            >
                              <div className="flex-1">
                                <div className="font-semibold text-slate-800">
                                  {scan.requestedByDoctor?.name ?? "Sin doctor"}
                                  {scan.requestedByDoctor?.clinic?.name
                                    ? ` · ${scan.requestedByDoctor.clinic.name}`
                                    : ""}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span
                                    className={`h-2 w-2 rounded-full ${statusColor}`}
                                  />
                                  <span>{statusText}</span>
                                </div>
                                {assignedName && (
                                  <div className="text-xs text-slate-500">
                                    Asignado: {assignedName}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      scan.isScanned
                                        ? "bg-emerald-500"
                                        : "bg-slate-400"
                                    }`}
                                  />
                                  <span>
                                    {scan.isScanned ? "Escaneado" : "No escaneado"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                {!assignedName && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void onAssignToMe(scan);
                                    }}
                                    disabled={isActionBusy}
                                  >
                                    Tomar
                                  </button>
                                )}
                                {assignedName && canManage && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onOpenManage(scan);
                                    }}
                                    disabled={isActionBusy}
                                  >
                                    Gestionar
                                  </button>
                                )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Espacio disponible
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <Modal
        open={showCreate}
        title="Nuevo escaneo"
        onClose={onCloseCreate}
        >
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Fecha y hora: {selectedDate} {selectedSlot}
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Doctor solicitante
            <div className="mt-1">
              <SearchableSelect
                options={doctorOptions}
                value={formState.doctorId}
                onChange={(nextValue) =>
                  setFormState((prev) => ({
                    ...prev,
                    doctorId: nextValue,
                  }))
                }
                placeholder="Buscar doctor"
                emptyLabel="Selecciona un doctor"
                disabled={isActionBusy}
              />
            </div>
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

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isActionBusy}
            >
              {isActionBusy ? "Guardando..." : "Crear escaneo"}
            </button>
          </div>
        </form>
        </Modal>
      )}

      <Modal
        open={showManage}
        title="Gestionar escaneo"
        onClose={onCloseManage}
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Doctor: {selectedScan?.requestedByDoctor?.name ?? "Sin doctor"}
          </p>
          <p>
            Asignado: {selectedScan?.assignedTo?.username ?? "Sin asignar"}
          </p>
          {selectedScan?.detail && (
            <p>
              Detalle: {selectedScan.detail}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {selectedScan?.requestedByDoctor?.clinic?.latitude &&
              selectedScan?.requestedByDoctor?.clinic?.longitude &&
              !selectedScan?.isScanned && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-sky-200 bg-sky-50 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    const lat = selectedScan?.requestedByDoctor?.clinic?.latitude;
                    const lng = selectedScan?.requestedByDoctor?.clinic?.longitude;
                    if (lat && lng) {
                      window.open(
                        `https://www.google.com/maps?q=${lat},${lng}`,
                        "_blank",
                      );
                    }
                  }}
                  disabled={isActionBusy}
                >
                  Ver ubicación
                </button>
              )}
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onUnassign}
              disabled={selectedScan?.isScanned || isActionBusy}
            >
              Desasignar
            </button>
            {selectedScan?.assignedTo?.id === currentUserId &&
              !selectedScan?.isScanned &&
              selectedScan?.status === "confirmed" && (
                <button
                  type="button"
                  className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={onMarkScanned}
                  disabled={isActionBusy}
                >
                  Marcar escaneado
                </button>
              )}
            {isAdmin && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Cambiar estado</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onUpdateStatus("confirmed")}
                    disabled={isActionBusy || selectedScan?.status === "confirmed"}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onUpdateStatus("cancelled")}
                    disabled={isActionBusy || selectedScan?.status === "cancelled" || selectedScan?.isScanned}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
