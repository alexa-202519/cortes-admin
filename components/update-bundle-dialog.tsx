"use client";

import { useId, useMemo, useState, useEffect } from "react";
import { Bundle } from "@/types/cut-order";
import { fetchLocations, type Location } from "@/lib/services/locations";
import { LocationSelect } from "@/components/location-select";

type Props = {
  bundle: Bundle;
  title?: string;
  initialAction?: string;
  onCancel: () => void;
  onConfirm: (payload: {
    action: string;
    destination: string;
    orderNumber: string;
  }) => void;
  isConfirming?: boolean;
  disabledActions?: string[];
};

const ACTION_OPTIONS = ["Mover", "Asignar", "Utilizar"];

export function UpdateBundleDialog({
  bundle,
  title = "Actualizar Bulto",
  initialAction = "",
  onCancel,
  onConfirm,
  isConfirming = false,
  disabledActions = [],
}: Props) {
  const [action, setAction] = useState(initialAction);
  const [destination, setDestination] = useState(bundle.currentLocation ?? "");
  const [orderNumber, setOrderNumber] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const dropdownId = useId();

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

  const normalizedDisabled = useMemo(() => {
    return new Set(disabledActions.map((value) => value.toLowerCase()));
  }, [disabledActions]);

  const actionLabel = useMemo(() => {
    if (action) return action;
    return "Selecciona una acción";
  }, [action]);

  const handleSubmit = () => {
    if (!action) return;
    onConfirm({ action, destination, orderNumber });
  };

  const handleActionSelect = (nextAction: string) => {
    const normalized = nextAction.toLowerCase();
    if (normalizedDisabled.has(normalized)) {
      return;
    }
    setAction(nextAction);
    setActionMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-md border border-[var(--primary-muted)] bg-white p-6 shadow-2xl">
        <h3 className="text-2xl font-semibold text-[var(--primary-dark)]">
          {title} • <span className="text-[var(--primary)]">{bundle.name}</span>
        </h3>
        <div className="mt-5 space-y-4 text-sm text-[var(--primary)]">
          <div className="relative">
            <label
              htmlFor={dropdownId}
              className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]"
            >
              Acción
            </label>
            <button
              type="button"
              id={dropdownId}
              onClick={() => setActionMenuOpen((prev) => !prev)}
              className="mt-2 flex w-full items-center justify-between rounded-md border border-[var(--primary-muted)] px-4 py-2 text-left text-sm font-medium text-[var(--primary-dark)] focus:outline-none"
            >
              {actionLabel}
              <span className="text-[var(--primary)]">
                {actionMenuOpen ? "▴" : "▾"}
              </span>
            </button>
            {actionMenuOpen ? (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-md border border-[var(--primary-muted)] bg-[var(--primary-soft)] p-3 shadow-lg">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                  ACCIONES
                </p>
                <div className="mt-2 flex flex-col">
                  {ACTION_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleActionSelect(option)}
                      disabled={normalizedDisabled.has(option.toLowerCase())}
                      className={`rounded-md px-3 py-2 text-left text-sm font-medium transition hover:bg-white ${
                        action === option
                          ? "bg-white text-[var(--primary-dark)] shadow-sm"
                          : "text-[var(--primary)]"
                      } ${
                        normalizedDisabled.has(option.toLowerCase())
                          ? "cursor-not-allowed text-[var(--primary-muted)] hover:bg-transparent"
                          : ""
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {action === "Mover" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Lugar destino
              </label>
              <LocationSelect
                value={destination}
                onChange={setDestination}
                locations={locations}
                disabled={isLoadingLocations}
                placeholder="Selecciona una ubicación"
                className="mt-2"
              />
            </div>
          ) : null}
          {action === "Asignar" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                # de orden
              </label>
              <input
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="Ej: 1541515155"
                className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          ) : null}
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
            onClick={handleSubmit}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--primary-muted)]"
            disabled={
              !action
              || (action === "Mover" && !destination)
              || (action === "Asignar" && !orderNumber)
              || isConfirming
            }
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
