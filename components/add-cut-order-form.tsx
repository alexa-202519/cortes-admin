"use client";

import { FormEvent, useState, useEffect } from "react";
import { createCutOrder } from "@/lib/services/cut-orders";
import { fetchLocations, type Location } from "@/lib/services/locations";
import { LocationSelect } from "@/components/location-select";

type BundleInput = {
  id: string;
  name: string;
  location: string;
  sheets: string;
  selected: boolean;
  sscc: string;
  luid: string;
  num_bobina?: string;
};

type Props = {
  onCancel?: () => void;
  onCreated?: () => void;
};

const createBundles = (count: number, previous: BundleInput[] = []) => {
  return Array.from({ length: count }, (_, index) => {
    const existing = previous[index];
    return {
      id: existing?.id ?? `temp-${index + 1}`,
      name: `Bulto #${index + 1}`,
      location: existing?.location ?? "",
      sheets: existing?.sheets ?? "",
      selected: existing?.selected ?? false,
      sscc: existing?.sscc ?? "",
      luid: existing?.luid ?? "",
      num_bobina: existing?.num_bobina ?? "",
    };
  });
};

export function AddCutOrderForm({ onCancel, onCreated }: Props) {
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [bundleCount, setBundleCount] = useState(5);
  const [bundles, setBundles] = useState<BundleInput[]>(() =>
    createBundles(5),
  );
  const [allLocation, setAllLocation] = useState("");
  const [selectionLocation, setSelectionLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setIsLoadingLocations(true);
        const data = await fetchLocations();
        setLocations(data);
      } catch (error) {
        console.error("Error al cargar ubicaciones:", error);
        setSubmitFeedback({
          type: "error",
          text: "No se pudieron cargar las ubicaciones. Intenta recargar la página.",
        });
      } finally {
        setIsLoadingLocations(false);
      }
    };
    loadLocations();
  }, []);

  const handleBundleCountChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setBundleCount(normalized);
    setBundles((prev) => createBundles(normalized, prev));
  };

  const handleAssignAll = (value: string) => {
    setAllLocation(value);
    setBundles((prev) =>
      prev.map((bundle) => ({
        ...bundle,
        location: value,
        selected: Boolean(value),
      })),
    );
  };

  const handleAssignToSelection = () => {
    if (!selectionLocation) {
      return;
    }

    setBundles((prev) =>
      prev.map((bundle) =>
        bundle.selected
          ? {
              ...bundle,
              location: selectionLocation,
            }
          : bundle,
      ),
    );
    setSelectionLocation("");
  };

  const resetForm = () => {
    setOrderNumber("");
    setOrderDate("");
    setBundleCount(5);
    setBundles(createBundles(5));
    setAllLocation("");
    setSelectionLocation("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitFeedback(null);

    if (!orderNumber || !orderDate) {
      setSubmitFeedback({
        type: "error",
        text: "Completa el número de orden y la fecha.",
      });
      return;
    }

    const normalizedBundles = bundles.map((bundle, index) => ({
      name: bundle.name || `Bulto #${index + 1}`,
      currentLocation: bundle.location || allLocation || undefined,
      sheets: bundle.sheets ? Number(bundle.sheets) : undefined,
      sscc: bundle.sscc,
      luid: bundle.luid,
      num_bobina: bundle.num_bobina,
    }));

    // Validar que hay al menos un bulto con información completa
    const validBundles = normalizedBundles.filter(
      (bundle) => bundle.currentLocation && bundle.sheets && bundle.sheets > 0
    );

    if (validBundles.length === 0) {
      setSubmitFeedback({
        type: "error",
        text: "Debes agregar al menos un bulto con ubicación y cantidad de láminas.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createCutOrder({
        code: orderNumber,
        date: orderDate,
        locationFilter: allLocation || undefined,
        bundles: validBundles,
      });
      setSubmitFeedback({
        type: "success",
        text: "Orden creada correctamente.",
      });
      resetForm();
      onCreated?.();
    } catch (submitError) {
      setSubmitFeedback({
        type: "error",
        text:
          submitError instanceof Error
            ? submitError.message
            : "No se pudo crear la orden.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-md border border-[var(--primary-muted)] bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[var(--primary-dark)]">
          Añadir Orden de Corte
        </h2>
        {onCancel ? (
          <button
            onClick={onCancel}
            className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:text-[var(--primary-dark)] hover:underline"
          >
            Cerrar
          </button>
        ) : null}
      </div>
      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
              # Orden
            </label>
            <input
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Fecha
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Cant. de bultos
              </label>
              <input
                type="number"
                min={0}
                value={bundleCount}
                onChange={(event) => handleBundleCountChange(event.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {submitFeedback ? (
          <p
            className={`rounded-md border px-4 py-3 text-sm ${
              submitFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {submitFeedback.text}
          </p>
        ) : null}

        <div className="rounded-md border border-[var(--primary-muted)] bg-[var(--primary-soft)] p-4">
          <h3 className="text-lg font-semibold text-[var(--primary-dark)]">
            Asignar Ubicación de Bulto
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Todos
              </label>
              <LocationSelect
                value={allLocation}
                onChange={handleAssignAll}
                locations={locations}
                disabled={isLoadingLocations}
                placeholder="Selecciona una ubicación"
                className="mt-2"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                  Solo selección
                </label>
                <LocationSelect
                  value={selectionLocation}
                  onChange={setSelectionLocation}
                  locations={locations}
                  disabled={isLoadingLocations}
                  placeholder="Selecciona una ubicación"
                  className="mt-2"
                />
              </div>
              <button
                type="button"
                onClick={handleAssignToSelection}
                className="mt-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed"
                disabled={!selectionLocation}
              >
                Asignar selección
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {bundles.length === 0 && (
              <p className="rounded-md border border-dashed border-[var(--primary-muted)] bg-white px-4 py-3 text-sm text-[var(--primary)]">
                Agrega la cantidad de bultos para asignar ubicaciones.
              </p>
            )}

            {bundles.map((bundle, index) => (
              <div
                key={bundle.id}
                className="flex flex-col gap-3 rounded-md border border-[var(--primary-muted)] bg-white px-4 py-3 text-sm text-[var(--primary-dark)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex flex-1 items-center gap-3">
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={bundle.selected}
                        onChange={() =>
                          setBundles((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, selected: !item.selected }
                                : item,
                            ),
                          )
                        }
                        className="h-4 w-4 rounded border-[var(--primary)] text-[var(--primary-dark)] focus:ring-[var(--primary)]"
                      />
                      {bundle.name}
                    </label>
                    <LocationSelect
                      value={bundle.location}
                      onChange={(value) =>
                        setBundles((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, location: value }
                              : item,
                          ),
                        )
                      }
                      locations={locations}
                      disabled={isLoadingLocations}
                      placeholder="Selecciona una ubicación"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--primary)] sm:flex-1">
                    <span className="font-semibold uppercase tracking-wide">Láminas: </span>
                    <input
                      type="number"
                      min={0}
                      value={bundle.sheets}
                      onChange={(event) =>
                        setBundles((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, sheets: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="flex-1 rounded-md border border-[var(--primary-muted)] px-3 py-1.5 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                      SSCC
                    </label>
                    <input
                      value={bundle.sscc}
                      onChange={(event) =>
                        setBundles((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, sscc: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-[var(--primary-muted)] px-3 py-1.5 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                      LUID
                    </label>
                    <input
                      value={bundle.luid}
                      onChange={(event) =>
                        setBundles((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, luid: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-[var(--primary-muted)] px-3 py-1.5 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                      NUM BOBINA
                    </label>
                    <input
                      value={bundle.num_bobina}
                      onChange={(event) =>
                        setBundles((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, num_bobina: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-[var(--primary-muted)] px-3 py-1.5 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
         </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm font-semibold text-[var(--primary-dark)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[var(--primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--primary-muted)]"
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </section>
  );
}
