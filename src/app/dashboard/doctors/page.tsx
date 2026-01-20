"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Modal from "@/components/Modal";
import { apiRequest, extractList, extractPagination } from "@/lib/api";

type Clinic = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name: string;
  phone: string;
  clinic: Clinic;
};

type DoctorFormState = {
  name: string;
  phone: string;
  clinicId: string;
};

const defaultFormState: DoctorFormState = {
  name: "",
  phone: "",
  clinicId: "",
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formState, setFormState] = useState<DoctorFormState>(defaultFormState);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isActionBusy = isBusy;

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (search) {
      params.append("filter", `name||$contL||${search}`);
    }
    if (clinicFilter) {
      params.append("filter", `clinic.id||$eq||${clinicFilter}`);
    }
    return params.toString();
  };

  const loadClinics = async () => {
    const payload = await apiRequest<unknown>("/clinics");
    setClinics(extractList<Clinic>(payload));
  };

  const loadDoctors = async () => {
    const payload = await apiRequest<unknown>(`/doctors?${buildQuery()}`);
    setDoctors(extractList<Doctor>(payload));
    const pagination = extractPagination(payload);
    if (pagination) {
      setPage(pagination.page);
      setPageCount(pagination.pageCount);
      setTotal(pagination.total);
    }
  };

  useEffect(() => {
    void loadClinics();
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsBusy(true);
      setError(null);
      try {
        await loadDoctors();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar.");
      } finally {
        setIsBusy(false);
      }
    };
    void run();
  }, [page, limit, search, clinicFilter]);

  const onOpenCreate = () => {
    setEditingDoctor(null);
    setFormState(defaultFormState);
    setShowForm(true);
  };

  const onEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormState({
      name: doctor.name,
      phone: doctor.phone,
      clinicId: doctor.clinic?.id?.toString() ?? "",
    });
    setShowForm(true);
  };

  const onCancel = () => {
    setEditingDoctor(null);
    setFormState(defaultFormState);
    setShowForm(false);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      if (!formState.clinicId) {
        throw new Error("Selecciona una clínica.");
      }
      const payload = {
        name: formState.name,
        phone: formState.phone,
        clinic: { id: Number(formState.clinicId) },
      };

      if (editingDoctor) {
        await apiRequest(`/doctors/${editingDoctor.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/doctors", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setFormState(defaultFormState);
      setEditingDoctor(null);
      setShowForm(false);
      await loadDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const isEditing = useMemo(() => Boolean(editingDoctor), [editingDoctor]);

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isBusy} message="Actualizando doctores..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Lista de doctores
            </h3>
            <p className="text-sm text-slate-500">
              Total: {total} doctores
            </p>
          </div>
          <button
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onOpenCreate}
            type="button"
            disabled={isActionBusy}
          >
            Nuevo doctor
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
            placeholder="Buscar por nombre"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
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
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {doctor.name}
                  </p>
                  <p className="text-xs text-slate-600">{doctor.phone}</p>
                  <p className="text-xs text-slate-600">
                    {doctor.clinic?.name ?? "Sin clínica"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onEdit(doctor)}
                    type="button"
                    disabled={isActionBusy}
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {doctors.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              No hay doctores registrados.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3">Doctor</th>
                <th>Teléfono</th>
                <th>Clínica</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-900">
                    {doctor.name}
                  </td>
                  <td className="text-slate-600">{doctor.phone}</td>
                  <td className="text-slate-600">
                    {doctor.clinic?.name ?? "-"}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onEdit(doctor)}
                        type="button"
                        disabled={isActionBusy}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-400" colSpan={4}>
                    No hay doctores registrados.
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

      <Modal
        open={showForm}
        title={isEditing ? "Editar doctor" : "Crear doctor"}
        onClose={onCancel}
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Teléfono
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.phone}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Clínica
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.clinicId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  clinicId: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecciona una clínica</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isActionBusy}
            >
              {isActionBusy ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear doctor"}
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
    </div>
  );
}
