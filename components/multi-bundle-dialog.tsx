"use client";

import { useMemo, useState, useEffect } from "react";
import { Bundle } from "@/types/cut-order";
import { fetchLocations, type Location } from "@/lib/services/locations";
import { LocationSelect } from "@/components/location-select";

type DialogType = "location" | "order";

type Props = {
  type: DialogType;
  bundles: Bundle[];
  onCancel: () => void;
  onConfirm: (payload: { value: string; bundleIds: string[] }) => void;
  isConfirming?: boolean;
};

const dialogCopy: Record<DialogType, { title: string; placeholder?: string }> = {
  location: { title: "Lugar" },
  order: { title: "# de Orden", placeholder: "Ej: 1541515155" },
};

export function MultiBundleDialog({
  type,
  bundles,
  onCancel,
  onConfirm,
  isConfirming = false,
}: Props) {
  const [value, setValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const isLocationDialog = type === "location";

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setIsLoadingLocations(true);
        const data = await fetchLocations();
        setLocations(data);
      } catch (error) {
        console.error("Error al cargar ubicaciones:", error);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    loadLocations();
  }, []);

  const allSelected = useMemo(() => {
    if (bundles.length === 0) return false;
    return selectedIds.length === bundles.length;
  }, [bundles.length, selectedIds]);

  const toggleBundle = (bundleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(bundleId)
        ? prev.filter((id) => id !== bundleId)
        : [...prev, bundleId],
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(bundles.map((bundle) => bundle.id));
    }
  };

  const handleConfirm = () => {
    if (!value || selectedIds.length === 0) {
      return;
    }
    onConfirm({ value, bundleIds: selectedIds });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-md border border-[var(--primary-muted)] bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-2xl font-semibold text-[var(--primary-dark)]">
          {dialogCopy[type].title}
        </h3>
        {isLocationDialog ? (
          <LocationSelect
            value={value}
            onChange={setValue}
            locations={locations}
            disabled={isLoadingLocations}
            placeholder="Selecciona una ubicación"
            className="mt-4"
          />
        ) : (
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={dialogCopy[type].placeholder}
            className="mt-4 w-full rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
          />
        )}

        <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-sm text-[var(--primary)]">
          <label className="flex items-center gap-3 rounded-md border border-[var(--primary-muted)] bg-[var(--primary-soft)] px-4 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-[var(--primary)] text-[var(--primary-dark)] focus:ring-[var(--primary)]"
            />
            Todos
          </label>

          <div className="space-y-2 pb-2">
            {bundles.map((bundle) => (
              <label
                key={bundle.id}
                className="flex items-center gap-3 rounded-md border border-[var(--primary-muted)] bg-white px-4 py-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(bundle.id)}
                  onChange={() => toggleBundle(bundle.id)}
                  className="h-4 w-4 rounded border-[var(--primary)] text-[var(--primary-dark)] focus:ring-[var(--primary)]"
                />
                {bundle.name}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition hover:border-[var(--primary)] hover:text-[var(--primary-dark)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--primary-muted)]"
            disabled={!value || selectedIds.length === 0 || isConfirming}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
