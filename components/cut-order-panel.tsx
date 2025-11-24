"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MultiBundleDialog } from "./multi-bundle-dialog";
import { UpdateBundleDialog } from "./update-bundle-dialog";
import { SplitBundleDialog } from "./split-bundle-dialog";
import { CutOrder } from "@/types/cut-order";
import {
  applyBundleAction,
  ApplyBundleActionInput,
  BundleAction,
  splitBundle,
} from "@/lib/services/cut-orders";

type Props = {
  order: CutOrder | null;
  onRequestReload?: () => void;
};

type SplitBundleSubmission = {
  sheets: number;
  originalIdentifiers: {
    sscc: string;
    luid: string;
  };
  newBundleIdentifiers: {
    sscc: string;
    luid: string;
  };
};

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-emerald-400",
  asignado: "bg-amber-400",
  utilizado: "bg-rose-500",
};

type ActionFeedback = { type: "success" | "error"; text: string } | null;

const isBundleAction = (value: string): value is BundleAction => {
  return value === "mover" || value === "asignar" || value === "utilizar";
};

export function CutOrderPanel({ order, onRequestReload }: Props) {
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<"location" | "order" | null>(
    null
  );
  const [bundleDialogConfig, setBundleDialogConfig] = useState<{
    title: string;
    preset?: string;
  } | null>(null);
  const [bundleStatusFilter, setBundleStatusFilter] = useState<
    "todos" | "disponible" | "asignado" | "utilizado"
  >("todos");
  const [bundleLocationFilter, setBundleLocationFilter] =
    useState<string>("todos");
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);

  const bundles = useMemo(() => order?.bundles ?? [], [order]);

  const locationOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        bundles.map((bundle) => bundle.currentLocation || "Sin ubicación")
      )
    );
    return ["todos", ...unique];
  }, [bundles]);

  const filteredBundles = useMemo(() => {
    return bundles.filter((bundle) => {
      const normalizedStatus = bundle.status.toLowerCase();
      const matchesStatus =
        bundleStatusFilter === "todos" ||
        normalizedStatus === bundleStatusFilter;
      const matchesLocation =
        bundleLocationFilter === "todos" ||
        bundle.currentLocation === bundleLocationFilter;
      return matchesStatus && matchesLocation;
    });
  }, [bundleStatusFilter, bundleLocationFilter, bundles]);

  const effectiveBundleId = useMemo(() => {
    if (
      selectedBundleId &&
      filteredBundles.some((bundle) => bundle.id === selectedBundleId)
    ) {
      return selectedBundleId;
    }
    return filteredBundles[0]?.id ?? null;
  }, [filteredBundles, selectedBundleId]);

  const activeBundle =
    filteredBundles.find((bundle) => bundle.id === effectiveBundleId) ?? null;
  const highlightedBundleId = effectiveBundleId;
  const dialogDisabledActions = useMemo(() => {
    if (!activeBundle) return [];
    return activeBundle.status === "Asignado" ? [] : ["Utilizar"];
  }, [activeBundle]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timeout = window.setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  const runBundleAction = async (
    payload: ApplyBundleActionInput,
    successMessage: string
  ) => {
    setActionFeedback(null);
    setIsProcessingAction(true);
    try {
      await applyBundleAction(payload);
      setActionFeedback({ type: "success", text: successMessage });
      onRequestReload?.();
      return true;
    } catch (actionError) {
      console.error(actionError);
      setActionFeedback({
        type: "error",
        text:
          actionError instanceof Error
            ? actionError.message
            : "No se pudo actualizar el bulto.",
      });
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleMultiConfirm = async (payload: {
    value: string;
    bundleIds: string[];
  }) => {
    if (!dialogType) return;
    const action = dialogType === "location" ? "mover" : "asignar";
    const successMessage =
      dialogType === "location"
        ? "Los bultos fueron movidos correctamente."
        : "Los bultos fueron asignados correctamente.";

    const success = await runBundleAction(
      {
        bundleIds: payload.bundleIds,
        action,
        destinationCode: dialogType === "location" ? payload.value : undefined,
        orderNumber: dialogType === "order" ? payload.value : undefined,
      },
      successMessage
    );

    if (success) {
      setDialogType(null);
    }
  };

  const handleBundleUpdateConfirm = async (payload: {
    action: string;
    destination: string;
    orderNumber: string;
  }) => {
    if (!activeBundle) return;
    const normalizedAction = payload.action.toLowerCase();
    if (!isBundleAction(normalizedAction)) {
      setActionFeedback({
        type: "error",
        text: "Acción no soportada.",
      });
      return;
    }

    const successMessage =
      normalizedAction === "mover"
        ? "Bulto movido correctamente."
        : normalizedAction === "asignar"
        ? "Bulto asignado correctamente."
        : "Bulto marcado como utilizado.";

    const success = await runBundleAction(
      {
        bundleIds: [activeBundle.id],
        action: normalizedAction,
        destinationCode:
          normalizedAction === "mover" ? payload.destination : undefined,
        orderNumber:
          normalizedAction === "asignar" ? payload.orderNumber : undefined,
      },
      successMessage
    );

    if (success) {
      setBundleDialogConfig(null);
    }
  };

  const handleSplitConfirm = async (payload: SplitBundleSubmission) => {
    if (!activeBundle || !order) return;
    setIsProcessingAction(true);
    try {
      await splitBundle({
        bundleId: activeBundle.id,
        orderId: order.id,
        sheets: payload.sheets,
        originalIdentifiers: payload.originalIdentifiers,
        newBundleIdentifiers: payload.newBundleIdentifiers,
      });
      setActionFeedback({
        type: "success",
        text: "Bulto dividido correctamente.",
      });
      setIsSplitDialogOpen(false);
      onRequestReload?.();
    } catch (splitError) {
      console.error(splitError);
      setActionFeedback({
        type: "error",
        text:
          splitError instanceof Error
            ? splitError.message
            : "No se pudo dividir el bulto.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (!order) {
    return (
      <section
        className="relative flex h-full items-center justify-center border border-[var(--primary-muted)] bg-white/90 p-6 shadow-sm"
        aria-label="Sin orden seleccionada"
      >
        <div className="pointer-events-none select-none text-center">
          <Image
            src="/logo-Comeca.png"
            alt="Logo de la empresa"
            width={350}
            height={350}
            className="mx-auto opacity-60"
            priority
          />
          <p className="mt-4 text-sm font-semibold text-[var(--primary)]">
            Selecciona una orden de corte para ver los detalles.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col overflow-hidden bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--primary)]">
            Orden de corte
          </p>
          <h2 className="text-2xl font-semibold text-[var(--primary-dark)]">
            {order.label}
          </h2>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--primary)]">
            <div>
              Cant. de bultos:{" "}
              <span className="font-semibold text-[var(--primary-dark)]">
                {order.completedBundles}
              </span>
            </div>
            <div>
              Bultos Actuales:{" "}
              <span className="font-semibold text-amber-600">
                {order.pendingBundles}
              </span>
            </div>
            <div>
              Fecha:{" "}
              <span className="font-medium text-[var(--primary-dark)]">
                {order.date}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <span
            className={`rounded-md px-2 py-1 text-sm font-semibold ${
              order.status === "Activo" ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {order.status}
          </span>
          <div className="flex gap-3">
            <button
              className="rounded-md border border-[var(--primary-muted)] px-2 py-2 text-sm font-medium text-[var(--primary-dark)] shadow-sm transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setDialogType("location")}
              disabled={isProcessingAction}
            >
              Mover Varios
            </button>
            <button
              className="rounded-md bg-[var(--primary)] px-2 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setDialogType("order")}
              disabled={isProcessingAction}
            >
              Asignar Varios
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden pt-4 min-h-0">
        <div className="flex w-72 min-w-[220px] flex-shrink-0 flex-col space-y-4 overflow-hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="sm:flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Estado
              </p>
              <select
                value={bundleStatusFilter}
                onChange={(event) =>
                  setBundleStatusFilter(
                    event.target.value as
                      | "todos"
                      | "disponible"
                      | "asignado"
                      | "utilizado"
                  )
                }
                className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-3 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none sm:h-10"
              >
                <option value="todos">Todos</option>
                <option value="disponible">Disponible</option>
                <option value="asignado">Asignado</option>
                <option value="utilizado">Utilizado</option>
              </select>
            </div>
            <div className="sm:flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Lugar
              </p>
              <select
                value={bundleLocationFilter}
                onChange={(event) =>
                  setBundleLocationFilter(event.target.value)
                }
                className="mt-2 w-full rounded-md border border-[var(--primary-muted)] px-3 py-2 text-sm text-[var(--primary-dark)] focus:border-[var(--primary)] focus:outline-none sm:h-10"
              >
                {locationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "todos" ? "Todos" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
              Bultos
            </p>
            <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredBundles.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--primary-muted)] px-3 py-2 text-xs text-[var(--primary)]">
                  No hay bultos con los filtros seleccionados.
                </p>
              ) : (
                filteredBundles.map((bundle) => {
                  const isSelected = highlightedBundleId === bundle.id;
                  return (
                    <button
                      key={bundle.id}
                      onClick={() => setSelectedBundleId(bundle.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-4 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                          : "border-[var(--primary)]/70 bg-white text-[var(--primary-dark)] hover:bg-[var(--primary-soft)]"
                      }`}
                    >
                      <span>{bundle.name}</span>
                      <span
                        className={`relative flex items-center gap-2 text-xs font-medium uppercase ${
                          isSelected ? "text-white" : "text-[var(--primary)]"
                        }`}
                      >
                        <span className="sr-only">{bundle.status}</span>
                        <span
                          className={`h-3 w-3 rounded-full ${
                            STATUS_COLORS[bundle.status.toLowerCase()] ??
                            "bg-slate-300"
                          }`}
                        />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col rounded-md border border-[var(--primary-muted)] bg-white/90 p-6 shadow-inner min-h-0">
          {activeBundle ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                    Detalle del bulto
                  </p>
                  <h3 className="text-2xl font-semibold text-[var(--primary-dark)]">
                    {activeBundle.name}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-[var(--primary-muted)] px-4 py-2 text-sm font-medium text-[var(--primary-dark)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setIsSplitDialogOpen(true)}
                    disabled={
                      !activeBundle ||
                      isProcessingAction ||
                      (activeBundle?.sheets ?? 0) <= 1
                    }
                  >
                    Dividir
                  </button>
                  <button
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() =>
                      setBundleDialogConfig({ title: "Actualizar Bulto" })
                    }
                    disabled={!activeBundle || isProcessingAction}
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] text-[var(--primary)] sm:grid-cols-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Ubicación actual
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.currentLocation}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Cant. de láminas
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.sheets.toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Orden de trabajo
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.workOrder}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Estado
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.availability}
                  </span>
                </div>
              </div>

              {/* Additional identifiers row: num bobina, LUID, SSCC */}
              <div className="mt-2 grid grid-cols-2 gap-3 text-[13px] text-[var(--primary)] sm:grid-cols-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Num. de bobina
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.num_bobina && activeBundle.num_bobina.trim().length > 0
                      ? activeBundle.num_bobina
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    LUID
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.luid && activeBundle.luid.trim().length > 0
                      ? activeBundle.luid
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    SSCC
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {activeBundle.sscc && activeBundle.sscc.trim().length > 0
                      ? activeBundle.sscc
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col" aria-hidden>
                  {/* empty placeholder for 4th column alignment */}
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    &nbsp;
                  </span>
                  <span className="font-semibold text-[var(--primary-dark)]">&nbsp;</span>
                </div>
              </div>

              <div className="mt-6 flex flex-1 flex-col overflow-hidden">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                  Historial
                </p>
                <div className="mt-3 flex-1 overflow-hidden rounded-md border border-dashed border-[var(--primary-muted)]">
                  <div className="h-full overflow-y-auto p-4 space-y-2 text-xs text-[var(--primary)]">
                    {activeBundle.history.map((entry, index) => (
                      <div
                        key={`${entry.action}-${entry.date}-${entry.location}-${index}`}
                        className="grid grid-cols-[1.5fr_1fr_auto]"
                      >
                        <span className="font-medium text-[var(--primary-dark)]">
                          {entry.action}
                        </span>
                        <span>{entry.location}</span>
                        <span>{entry.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--primary)]">
              Esta orden no tiene bultos asociados.
            </div>
          )}
        </div>
      </div>
      {dialogType ? (
        <MultiBundleDialog
          type={dialogType}
          bundles={order.bundles}
          onCancel={() => setDialogType(null)}
          onConfirm={handleMultiConfirm}
          isConfirming={isProcessingAction}
        />
      ) : null}
      {bundleDialogConfig && activeBundle ? (
        <UpdateBundleDialog
          key={`${bundleDialogConfig.title}-${
            bundleDialogConfig.preset ?? "default"
          }`}
          bundle={activeBundle}
          title={bundleDialogConfig.title}
          initialAction={bundleDialogConfig.preset}
          onCancel={() => setBundleDialogConfig(null)}
          onConfirm={handleBundleUpdateConfirm}
          isConfirming={isProcessingAction}
          disabledActions={dialogDisabledActions}
        />
      ) : null}
      {isSplitDialogOpen && activeBundle ? (
        <SplitBundleDialog
          bundle={activeBundle}
          onCancel={() => setIsSplitDialogOpen(false)}
          onConfirm={handleSplitConfirm}
        />
      ) : null}
      {actionFeedback ? (
        <div
          className="fixed bottom-4 left-4 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg"
          data-test-id="feedback-toast"
          style={{
            borderColor:
              actionFeedback.type === "success" ? "#6ee7b7" : "#fecaca",
            backgroundColor:
              actionFeedback.type === "success" ? "#ecfdf5" : "#fef2f2",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className={`font-semibold ${
                actionFeedback.type === "success"
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {actionFeedback.text}
            </span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-[var(--primary)] transition hover:text-[var(--primary-dark)]"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
