"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Modal from "@/components/Modal";
import { apiRequest, extractList, extractPagination } from "@/lib/api";

type User = {
  id: number;
  username: string;
  role: string;
  phone?: string | null;
  createdAt?: string;
};

type UserFormState = {
  username: string;
  password: string;
  role: string;
  phone: string;
};

const defaultFormState: UserFormState = {
  username: "",
  password: "",
  role: "Administrator",
  phone: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [formState, setFormState] = useState<UserFormState>(defaultFormState);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
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
      params.append("filter", `username||$contL||${search}`);
    }
    if (roleFilter) {
      params.append("filter", `role||$eq||${roleFilter}`);
    }
    return params.toString();
  };

  const loadUsers = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(`/users?${buildQuery()}`);
      setUsers(extractList<User>(payload));
      const pagination = extractPagination(payload);
      if (pagination) {
        setPage(pagination.page);
        setPageCount(pagination.pageCount);
        setTotal(pagination.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar usuarios.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [page, limit, search, roleFilter]);

  const onOpenCreate = () => {
    setEditingUser(null);
    setFormState(defaultFormState);
    setShowForm(true);
  };

  const onEdit = (user: User) => {
    setEditingUser(user);
    setFormState({
      username: user.username,
      password: "",
      role: user.role ?? "Administrator",
      phone: user.phone ?? "",
    });
    setShowForm(true);
  };

  const onCancel = () => {
    setEditingUser(null);
    setFormState(defaultFormState);
    setShowForm(false);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        username: formState.username,
        role: formState.role,
      };
      if (formState.phone) payload.phone = formState.phone;
      if (formState.password) payload.password = formState.password;

      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        if (!formState.password) {
          throw new Error("La contraseña es obligatoria para crear usuarios.");
        }
        await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setFormState(defaultFormState);
      setEditingUser(null);
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const isEditing = useMemo(() => Boolean(editingUser), [editingUser]);

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isBusy} message="Actualizando usuarios..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Lista de usuarios
            </h3>
            <p className="text-sm text-slate-500">
              Total: {total} usuarios
            </p>
          </div>
          <button
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onOpenCreate}
            type="button"
            disabled={isActionBusy}
          >
            Nuevo usuario
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
            placeholder="Buscar por usuario"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Scanner">Scanner</option>
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
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {user.username}
                  </p>
                  <p className="text-xs font-medium text-slate-700">
                    {user.role}
                  </p>
                  <p className="text-xs text-slate-600">
                    {user.phone ?? "Sin teléfono"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onEdit(user)}
                    type="button"
                    disabled={isActionBusy}
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              No hay usuarios registrados.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3">Usuario</th>
                <th>Rol</th>
                <th>Teléfono</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-900">
                    {user.username}
                  </td>
                  <td className="text-slate-700">{user.role}</td>
                  <td className="text-slate-600">{user.phone ?? "-"}</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onEdit(user)}
                        type="button"
                        disabled={isActionBusy}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-400" colSpan={4}>
                    No hay usuarios registrados.
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
        title={isEditing ? "Editar usuario" : "Crear usuario"}
        onClose={onCancel}
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Usuario
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.username}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  username: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Contraseña
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              type="password"
              value={formState.password}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              placeholder={isEditing ? "Dejar vacío para no cambiar" : ""}
              required={!isEditing}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Rol
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.role}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  role: event.target.value,
                }))
              }
            >
              <option value="Administrator">Administrator</option>
              <option value="Scanner">Scanner</option>
            </select>
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
              placeholder="+1 555 123 4567"
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isActionBusy}
            >
              {isActionBusy ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
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
