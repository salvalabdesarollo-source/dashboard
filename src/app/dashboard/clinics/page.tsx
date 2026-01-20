"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Modal from "@/components/Modal";
import { apiRequest, extractList, extractPagination } from "@/lib/api";
import { useRefresh } from "@/contexts/RefreshContext";

type Clinic = {
  id: number;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
};

type ClinicFormState = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

const defaultFormState: ClinicFormState = {
  name: "",
  address: "",
  latitude: null,
  longitude: null,
};

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyAfXQwzgnfuV4iZlK3xrMHUSqJ6v63KJig";

const loadGoogleMapsScript = (apiKey: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-google-maps="true"]',
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      if ((window as typeof window & { google?: unknown }).google) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
    document.head.appendChild(script);
  });

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formState, setFormState] = useState<ClinicFormState>(defaultFormState);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [isMapsLoading, setIsMapsLoading] = useState(false);
  const [mapSearch, setMapSearch] = useState("");
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const isActionBusy = isBusy;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<{ map?: any; marker?: any; listener?: any }>({});

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (search) {
      params.append("filter", `name||$contL||${search}`);
    }
    return params.toString();
  };

  const { registerRefresh } = useRefresh();

  const loadClinics = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(`/clinics?${buildQuery()}`);
      setClinics(extractList<Clinic>(payload));
      const pagination = extractPagination(payload);
      if (pagination) {
        setPage(pagination.page);
        setPageCount(pagination.pageCount);
        setTotal(pagination.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar clínicas.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void loadClinics();
  }, [page, limit, search]);

  useEffect(() => {
    const unregister = registerRefresh(async () => {
      await loadClinics();
    });
    return unregister;
  }, [registerRefresh, page, limit, search]);

  const onOpenCreate = () => {
    setEditingClinic(null);
    setFormState(defaultFormState);
    setMapsError(null);
    setMapSearch("");
    setShowForm(true);
  };

  const onEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormState({
      name: clinic.name,
      address: clinic.address,
      latitude: clinic.latitude ?? null,
      longitude: clinic.longitude ?? null,
    });
    setMapsError(null);
    setMapSearch(clinic.address ?? "");
    setShowForm(true);
  };

  const onCancel = () => {
    setEditingClinic(null);
    setFormState(defaultFormState);
    setShowForm(false);
    setMapsError(null);
    setMapSearch("");
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      if (formState.latitude == null || formState.longitude == null) {
        throw new Error("Selecciona la ubicación en el mapa.");
      }
      const payload = {
        name: formState.name,
        address: formState.address,
        latitude: formState.latitude,
        longitude: formState.longitude,
      };

      if (editingClinic) {
        await apiRequest(`/clinics/${editingClinic.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/clinics", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setFormState(defaultFormState);
      setEditingClinic(null);
      setShowForm(false);
      await loadClinics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const isEditing = useMemo(() => Boolean(editingClinic), [editingClinic]);

  const onMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      mapContainerRef.current = null;
      return;
    }
    if (mapContainerRef.current === node) return;
    mapContainerRef.current = node;
    setMapReadyTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!showForm) {
      if (mapInstanceRef.current.listener) {
        mapInstanceRef.current.listener.remove();
      }
      mapInstanceRef.current.map = undefined;
      mapInstanceRef.current.marker = undefined;
      mapInstanceRef.current.listener = undefined;
      setMapsError(null);
      return;
    }
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsError("Falta configurar la llave de Google Maps.");
      return;
    }
    if (mapInstanceRef.current.map || !mapContainerRef.current) return;
    setIsMapsLoading(true);
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        const maps = (window as typeof window & { google?: any }).google;
        if (!maps?.maps) throw new Error("Google Maps no está disponible.");
        const latValue =
          typeof formState.latitude === "number"
            ? formState.latitude
            : formState.latitude != null
              ? Number(formState.latitude)
              : NaN;
        const lngValue =
          typeof formState.longitude === "number"
            ? formState.longitude
            : formState.longitude != null
              ? Number(formState.longitude)
              : NaN;
        const hasLocation = Number.isFinite(latValue) && Number.isFinite(lngValue);
        const defaultCenter = { lat: 31.6904, lng: -106.4245 };
        const center = hasLocation
          ? {
              lat: latValue,
              lng: lngValue,
            }
          : defaultCenter;
        const map = new maps.maps.Map(mapContainerRef.current, {
          center,
          zoom: hasLocation ? 15 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new maps.maps.Marker({
          map,
          position: hasLocation ? center : undefined,
        });
        const listener = map.addListener("click", (event: any) => {
          const lat = event?.latLng?.lat?.();
          const lng = event?.latLng?.lng?.();
          if (typeof lat !== "number" || typeof lng !== "number") return;
          setFormState((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng,
          }));
          const geocoder = new maps.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
            if (status !== "OK" || !results?.[0]?.formatted_address) return;
            const address = results[0].formatted_address as string;
            setFormState((prev) => ({
              ...prev,
              address,
            }));
            setMapSearch(address);
          });
        });
        mapInstanceRef.current.map = map;
        mapInstanceRef.current.marker = marker;
        mapInstanceRef.current.listener = listener;
        setMapsError(null);

        if (!hasLocation && formState.address) {
          const geocoder = new maps.maps.Geocoder();
          geocoder.geocode({ address: formState.address }, (results: any, status: string) => {
            if (status !== "OK" || !results?.[0]?.geometry?.location) return;
            const location = results[0].geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            const address = results[0].formatted_address as string | undefined;
            setFormState((prev) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              address: address ?? prev.address,
            }));
            if (address) setMapSearch(address);
          });
        }
      })
      .catch((err: unknown) => {
        setMapsError(
          err instanceof Error ? err.message : "No se pudo cargar Google Maps.",
        );
      })
      .finally(() => setIsMapsLoading(false));
  }, [showForm, formState.latitude, formState.longitude, mapReadyTick]);

  useEffect(() => {
    const marker = mapInstanceRef.current.marker;
    const map = mapInstanceRef.current.map;
    if (!marker || !map) return;
    if (formState.latitude == null || formState.longitude == null) {
      marker.setMap(null);
      return;
    }
    const position = { lat: formState.latitude, lng: formState.longitude };
    marker.setMap(map);
    marker.setPosition(position);
    map.setCenter(position);
  }, [formState.latitude, formState.longitude]);

  const onSearchLocation = () => {
    const map = mapInstanceRef.current.map;
    if (!map) return;
    const maps = (window as typeof window & { google?: any }).google;
    if (!maps?.maps) return;
    if (!mapSearch.trim()) {
      setMapsError("Escribe una ubicación para buscar.");
      return;
    }
    setMapsError(null);
    const geocoder = new maps.maps.Geocoder();
    geocoder.geocode({ address: mapSearch.trim() }, (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setMapsError("No se encontró la ubicación.");
        return;
      }
      const location = results[0].geometry.location;
      const lat = location.lat();
      const lng = location.lng();
      const address = results[0].formatted_address as string | undefined;
      setFormState((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        address: address ?? prev.address,
      }));
      if (address) setMapSearch(address);
    });
  };

  return (
    <div className="space-y-6">
      <LoadingOverlay show={isBusy} message="Actualizando clínicas..." />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Lista de clínicas
            </h3>
            <p className="text-sm text-slate-500">
              Total: {total} clínicas
            </p>
          </div>
          <button
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onOpenCreate}
            type="button"
            disabled={isActionBusy}
          >
            Nueva clínica
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {clinic.name}
                  </p>
                  <p className="text-xs text-slate-600">{clinic.address}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onEdit(clinic)}
                    type="button"
                    disabled={isActionBusy}
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {clinics.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              No hay clínicas registradas.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3">Clínica</th>
                <th>Dirección</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((clinic) => (
                <tr key={clinic.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-900">
                    {clinic.name}
                  </td>
                  <td className="text-slate-600">{clinic.address}</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onEdit(clinic)}
                        type="button"
                        disabled={isActionBusy}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clinics.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-400" colSpan={3}>
                    No hay clínicas registradas.
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
        title={isEditing ? "Editar clínica" : "Crear clínica"}
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
            Dirección
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-sky-400 focus:outline-none"
              value={formState.address}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              required
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                Ubicación en el mapa
              </p>
              {isMapsLoading && (
                <span className="text-xs text-slate-500">Cargando mapa...</span>
              )}
            </div>
            {mapsError && (
              <p className="text-xs text-rose-600">{mapsError}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
                placeholder="Buscar ubicación (dirección, ciudad)"
                value={mapSearch}
                onChange={(event) => setMapSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSearchLocation();
                  }
                }}
                disabled={isActionBusy}
              />
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onSearchLocation}
                disabled={isActionBusy || isMapsLoading}
              >
                Buscar
              </button>
            </div>
            <div
              ref={onMapContainerRef}
              className="h-56 w-full overflow-hidden rounded-2xl border border-slate-200"
            />
            <p className="text-xs text-slate-500">
              Toca el mapa para seleccionar la ubicación exacta de la clínica.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isActionBusy}
            >
              {isActionBusy ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear clínica"}
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
