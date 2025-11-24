import { supabase } from "@/lib/supabase-client";
import { Bundle, BundleHistoryEntry, CutOrder } from "@/types/cut-order";
import { isValidLocationCode, type LocationCode } from "@/constants/locations";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

type SupabaseLocation = {
  id: string;
  codigo: string | null;
};

type BundleActionEnum = "mover" | "asignar" | "utilizar" | "dividir";
type BundleStatusEnum = "disponible" | "asignado" | "usado";

const bundleActionLabels: Record<BundleActionEnum, string> = {
  mover: "Mover",
  asignar: "Asignar",
  utilizar: "Utilizar",
  dividir: "Dividir",
};

const bundleStatusLabels: Record<BundleStatusEnum, { badge: string; availability: string }> = {
  disponible: { badge: "Disponible", availability: "Disponible" },
  asignado: { badge: "Asignado", availability: "Asignado" },
  usado: { badge: "Utilizado", availability: "Utilizado" },
};

const bundleStatusByAction: Partial<Record<BundleActionEnum, BundleStatusEnum>> = {
  asignar: "asignado",
  utilizar: "usado",
};

type SupabaseBundleHistory = {
  id: string;
  accion: BundleActionEnum | null;
  numero_trabajo: string | null;
  fecha_hora: string | null;
  ubicacion_destino: SupabaseLocation | null;
};

type SupabaseBundle = {
  id: string;
  numero_bulto: number | null;
  cantidad_laminas: number | null;
  estado: BundleStatusEnum | null;
  ubicacion: SupabaseLocation | null;
  historial: SupabaseBundleHistory[] | null;
  creado_en?: string | null;
  SSCC?: string | null;
  LUID?: string | null;
  num_bobina?: string | null;
};

type SupabaseCutOrder = {
  id: string;
  numero_orden: string;
  fecha: string | null;
  cantidad_bultos: number | null;
  activo: boolean | null;
  bultos: SupabaseBundle[] | null;
};

const BUNDLE_SPLIT_NUMBER_FACTOR = 1000;

type BundleNumberInfo = {
  base: number | null;
  variant: number | null;
};

const decodeBundleNumber = (value: number | null): BundleNumberInfo => {
  if (value === null || Number.isNaN(value)) {
    return { base: null, variant: null };
  }

  if (value >= BUNDLE_SPLIT_NUMBER_FACTOR) {
    const base = Math.floor(value / BUNDLE_SPLIT_NUMBER_FACTOR);
    const variant = value % BUNDLE_SPLIT_NUMBER_FACTOR || 1;
    return { base, variant };
  }

  return { base: value, variant: 1 };
};

const encodeBundleNumber = (base: number, variant: number) => {
  return base * BUNDLE_SPLIT_NUMBER_FACTOR + variant;
};

const formatDate = (value: string | null) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_FORMATTER.format(parsed);
};

const formatDateTime = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATETIME_FORMATTER.format(parsed);
};

const normalizeHistory = (
  history: SupabaseBundleHistory[] | null,
): BundleHistoryEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .sort((a, b) => {
      const dateA = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
      const dateB = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
      return dateA - dateB;
    })
    .map((entry) => {
      const actionLabel = entry.accion
        ? bundleActionLabels[entry.accion]
        : "Actualización";
      const displayLocation =
        entry.accion === "asignar"
          ? entry.numero_trabajo ?? "-"
          : entry.ubicacion_destino?.codigo ?? "-";
      return {
        action: actionLabel,
        location: displayLocation,
        date: formatDateTime(entry.fecha_hora),
      };
    });
};

const mapBundle = (bundle: SupabaseBundle): Bundle => {
  const numberInfo = decodeBundleNumber(bundle.numero_bulto);
  const baseNumber = numberInfo.base;
  const rawHistory = Array.isArray(bundle.historial) ? [...bundle.historial] : [];
  const history = normalizeHistory(rawHistory);
  const lastWorkOrderEntry = [...rawHistory]
    .reverse()
    .find((entry) => entry.numero_trabajo && entry.numero_trabajo.trim().length > 0);
  const latestWorkOrder =
    bundle.estado === "disponible"
      ? "Sin orden"
      : lastWorkOrderEntry?.numero_trabajo ?? "Sin orden";
  const statusInfo = bundle.estado ? bundleStatusLabels[bundle.estado] : null;
  const baseName = baseNumber ? `Bulto #${baseNumber}` : "Bulto sin número";
  return {
    id: String(bundle.id),
    name: baseName,
    baseName,
    rawNumber: baseNumber,
    createdAt: bundle.creado_en ?? "",
    currentLocation: bundle.ubicacion?.codigo ?? "Sin ubicación",
    sheets: bundle.cantidad_laminas ?? 0,
    workOrder: latestWorkOrder,
    availability: statusInfo?.availability ?? "Sin estado",
    status: statusInfo?.badge ?? "Sin estado",
    sscc: bundle.SSCC ?? "",
    luid: bundle.LUID ?? "",
    num_bobina: bundle.num_bobina ?? "",
    history,
  };
};

const mapCutOrder = (order: SupabaseCutOrder): CutOrder => {
  const bundles = (order.bultos ?? []).map(mapBundle);
  applyBundleDisplayNames(bundles);
  const bundleCount = order.cantidad_bultos ?? bundles.length;
  const completedBundles = Math.min(bundleCount, bundles.length);
  const usedBundles = bundles.filter((bundle) => bundle.status === "Utilizado").length;
  const pendingBundles = Math.max(0, bundleCount - usedBundles);
  const defaultLocation = bundles[0]?.currentLocation ?? "Sin ubicación";
  const code = order.numero_orden ?? "SIN-CODIGO";
  return {
    id: String(order.id),
    code,
    label: `Orden de corte #${code}`,
    date: formatDate(order.fecha),
    status: order.activo ? "Activo" : "Inactivo",
    workflowStatus: order.activo ? "Operativa" : "Pausada",
    locationFilter: defaultLocation,
    completedBundles,
    pendingBundles,
    bundles,
  };
};

const applyBundleDisplayNames = (bundles: Bundle[]) => {
  const groups = new Map<string, Bundle[]>();
  bundles.forEach((bundle) => {
    const key = bundle.rawNumber !== null ? String(bundle.rawNumber) : bundle.id;
    const list = groups.get(key);
    if (list) {
      list.push(bundle);
    } else {
      groups.set(key, [bundle]);
    }
  });

  groups.forEach((group) => {
    if (group.length <= 1) return;
    group
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      })
      .forEach((bundle, index) => {
        bundle.name = `${bundle.baseName} - ${index + 1}`;
      });
  });
};

export async function fetchCutOrders(): Promise<CutOrder[]> {
  const { data, error } = await supabase
    .from("ordenes_corte")
    .select(
      `
        id,
        numero_orden,
        fecha,
        cantidad_bultos,
        activo,
        bultos:bultos (
          id,
          numero_bulto,
          cantidad_laminas,
          estado,
          creado_en,
          SSCC,
          LUID,
          num_bobina,
          ubicacion:ubicaciones ( id, codigo ),
          historial:historial_bultos (
            id,
            accion,
            numero_trabajo,
            fecha_hora,
            ubicacion_destino:ubicaciones ( id, codigo )
          )
        )
      `,
    )
    .returns<SupabaseCutOrder[]>()
    .order("creado_en", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar las órdenes: ${error.message}`);
  }

  const orders = (data ?? []) as SupabaseCutOrder[];
  return orders.map(mapCutOrder);
}

export type CreateBundleInput = {
  name: string;
  currentLocation?: string;
  sheets?: number;
  workOrder?: string;
  availability?: string;
  status?: string;
  history?: BundleHistoryEntry[];
  sscc?: string;
  luid?: string;
  num_bobina?: string;
};

export type CreateCutOrderInput = {
  code: string;
  date: string;
  label?: string;
  status?: "Activo" | "Inactivo";
  workflowStatus?: string;
  locationFilter?: string;
  bundles: CreateBundleInput[];
};

const normalizeLocationCode = (value?: string): LocationCode | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized.length) return null;
  if (isValidLocationCode(normalized)) {
    return normalized;
  }
  return null;
};

const ensureLocationMap = async (codes: string[]): Promise<Record<string, string>> => {
  if (codes.length === 0) return {};
  const uniqueCodes = Array.from(new Set(codes));
  const map = new Map<string, string>();

  const { data: existing, error: fetchError } = await supabase
    .from("ubicaciones")
    .select("id, codigo")
    .in("codigo", uniqueCodes);

  if (fetchError) {
    throw new Error(`No se pudieron leer las ubicaciones: ${fetchError.message}`);
  }

  (existing ?? []).forEach((location) => {
    if (location.codigo) {
      map.set(location.codigo, location.id);
    }
  });

  const missing = uniqueCodes.filter((code) => !map.has(code));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("ubicaciones")
      .insert(missing.map((code) => ({ codigo: code })))
      .select("id, codigo");

    if (insertError) {
      throw new Error(`No se pudieron crear ubicaciones: ${insertError.message}`);
    }

    (inserted ?? []).forEach((location) => {
      if (location.codigo) {
        map.set(location.codigo, location.id);
      }
    });
  }

  return Object.fromEntries(map);
};

const DEFAULT_BUNDLE_STATUS: BundleStatusEnum = "disponible";
const bundleStatusFromInput = (value?: string): BundleStatusEnum => {
  if (!value) return DEFAULT_BUNDLE_STATUS;
  const normalized = value.toLowerCase().trim();
  if (normalized && normalized in bundleStatusLabels) {
    return normalized as BundleStatusEnum;
  }
  return DEFAULT_BUNDLE_STATUS;
};

export async function createCutOrder(input: CreateCutOrderInput) {
  const isActive = input.status !== "Inactivo";
  const defaultLocationCode = normalizeLocationCode(
    input.locationFilter || input.bundles[0]?.currentLocation,
  );

  const locationCodes = input.bundles
    .map((bundle) => normalizeLocationCode(bundle.currentLocation))
    .filter((code): code is LocationCode => Boolean(code));

  if (defaultLocationCode) {
    locationCodes.push(defaultLocationCode);
  }

  const locationsMap = await ensureLocationMap(locationCodes);

  const { data, error } = await supabase
    .from("ordenes_corte")
    .insert({
      numero_orden: input.code,
      fecha: input.date,
      cantidad_bultos: input.bundles.length,
      activo: isActive,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo crear la orden: ${error.message}`);
  }

  const orderId = data?.id;

  if (!orderId) {
    throw new Error("La respuesta de Supabase no incluyó el id de la orden.");
  }

  if (input.bundles.length === 0) {
    return orderId;
  }

  const bundlesPayload = input.bundles.map((bundle, index) => {
    const fallbackCode = normalizeLocationCode(bundle.currentLocation) || defaultLocationCode;
    const locationId = fallbackCode ? locationsMap[fallbackCode] ?? null : null;
    return {
      orden_corte_id: orderId,
      numero_bulto: index + 1,
      ubicacion_id: locationId,
      cantidad_laminas: bundle.sheets ?? 0,
      estado: bundleStatusFromInput(bundle.status),
      SSCC: bundle.sscc || null,
      LUID: bundle.luid || null,
      num_bobina: bundle.num_bobina || null,
    };
  });

  const { data: createdBundles, error: bundlesError } = await supabase
    .from("bultos")
    .insert(bundlesPayload)
    .select("id, ubicacion_id");

  if (bundlesError) {
    throw new Error(`No se pudieron guardar los bultos: ${bundlesError.message}`);
  }

  const historyPayload =
    createdBundles?.map((bundle) => ({
      bulto_id: bundle.id,
      accion: "mover" as BundleActionEnum,
      ubicacion_destino_id: bundle.ubicacion_id,
      numero_trabajo: null,
      fecha_hora: new Date().toISOString(),
    })) ?? [];

  if (historyPayload.length > 0) {
    const { error: historyError } = await supabase
      .from("historial_bultos")
      .insert(historyPayload);

    if (historyError) {
      throw new Error(
        `No se pudo registrar el historial inicial: ${historyError.message}`,
      );
    }
  }

  return orderId;
}

type BundleIdentifiersInput = {
  sscc: string;
  luid: string;
};

export async function splitBundle({
  bundleId,
  orderId,
  sheets,
  originalIdentifiers,
  newBundleIdentifiers,
}: {
  bundleId: string;
  orderId: string;
  sheets: number;
  originalIdentifiers: BundleIdentifiersInput;
  newBundleIdentifiers: BundleIdentifiersInput;
}) {
  if (sheets <= 0) {
    throw new Error("La cantidad debe ser mayor a cero.");
  }

  const normalizeIdentifier = (value: string) => value.trim();
  const normalizedOriginalSSCC = normalizeIdentifier(originalIdentifiers.sscc ?? "");
  const normalizedOriginalLUID = normalizeIdentifier(originalIdentifiers.luid ?? "");
  const normalizedSplitSSCC = normalizeIdentifier(newBundleIdentifiers.sscc ?? "");
  const normalizedSplitLUID = normalizeIdentifier(newBundleIdentifiers.luid ?? "");

  if (
    !normalizedOriginalSSCC ||
    !normalizedOriginalLUID ||
    !normalizedSplitSSCC ||
    !normalizedSplitLUID
  ) {
    throw new Error("Debes ingresar el SSCC y LUID para ambos bultos.");
  }

  const { data: bundle, error: fetchError } = await supabase
    .from("bultos")
    .select(
      "id, orden_corte_id, numero_bulto, cantidad_laminas, ubicacion_id, estado, SSCC, LUID",
    )
    .eq("id", bundleId)
    .single();

  if (fetchError || !bundle) {
    throw new Error(fetchError?.message ?? "No se pudo leer el bulto seleccionado.");
  }

  if (String(bundle.orden_corte_id) !== String(orderId)) {
    throw new Error("El bulto no pertenece a la orden actual.");
  }

  const currentSheets = bundle.cantidad_laminas ?? 0;
  if (sheets >= currentSheets) {
    throw new Error("La cantidad a dividir debe ser menor a la del bulto original.");
  }

  const { base: bundleBaseNumber } = decodeBundleNumber(bundle.numero_bulto);
  if (!bundleBaseNumber) {
    throw new Error("El bulto no tiene un número asignado y no se puede dividir.");
  }

  const { data: orderBundles, error: siblingsError } = await supabase
    .from("bultos")
    .select("id, numero_bulto")
    .eq("orden_corte_id", orderId);

  if (siblingsError) {
    throw new Error(
      `No se pudieron leer los bultos de la orden: ${siblingsError.message}`,
    );
  }

  const relatedBundles = (orderBundles ?? []).filter((item) => {
    const info = decodeBundleNumber(item.numero_bulto);
    return info.base === bundleBaseNumber;
  });

  const usedVariants = relatedBundles
    .map((item) => decodeBundleNumber(item.numero_bulto).variant)
    .filter((variant): variant is number => variant !== null);
  const highestVariant = usedVariants.length ? Math.max(...usedVariants) : 1;
  const nextVariant = highestVariant + 1;
  const shouldNormalizeNumber =
    bundle.numero_bulto === null || bundle.numero_bulto < BUNDLE_SPLIT_NUMBER_FACTOR;

  const remainingSheets = currentSheets - sheets;
  const { error: updateError } = await supabase
    .from("bultos")
    .update({
      cantidad_laminas: remainingSheets,
      SSCC: normalizedOriginalSSCC,
      LUID: normalizedOriginalLUID,
    })
    .eq("id", bundleId);

  if (updateError) {
    throw new Error(`No se pudo actualizar el bulto original: ${updateError.message}`);
  }

  if (shouldNormalizeNumber) {
    const encodedParentNumber = encodeBundleNumber(bundleBaseNumber, 1);
    const { error: numberUpdateError } = await supabase
      .from("bultos")
      .update({ numero_bulto: encodedParentNumber })
      .eq("id", bundleId);

    if (numberUpdateError) {
      throw new Error(
        `No se pudo ajustar el número del bulto original: ${numberUpdateError.message}`,
      );
    }
  }

  const encodedSplitNumber = encodeBundleNumber(bundleBaseNumber, nextVariant);

  const { data: inserted, error: insertError } = await supabase
    .from("bultos")
    .insert({
      orden_corte_id: orderId,
      numero_bulto: encodedSplitNumber,
      cantidad_laminas: sheets,
      ubicacion_id: bundle.ubicacion_id,
      estado: bundle.estado ?? DEFAULT_BUNDLE_STATUS,
      SSCC: normalizedSplitSSCC,
      LUID: normalizedSplitLUID,
    })
    .select("id");

  if (insertError) {
    throw new Error(`No se pudo crear el nuevo bulto: ${insertError.message}`);
  }

  const newBundleId = inserted?.[0]?.id;
  if (!newBundleId) {
    throw new Error("La respuesta de Supabase no incluyó el id del bulto dividido.");
  }

  const splitTimestamp = new Date().toISOString();
  const historyPayload = [
    {
      bulto_id: bundle.id,
      accion: "dividir" as BundleActionEnum,
      ubicacion_destino_id: bundle.ubicacion_id,
      numero_trabajo: null,
      fecha_hora: splitTimestamp,
    },
    {
      bulto_id: newBundleId,
      accion: "dividir" as BundleActionEnum,
      ubicacion_destino_id: bundle.ubicacion_id,
      numero_trabajo: null,
      fecha_hora: splitTimestamp,
    },
  ];

  const { error: historyError } = await supabase
    .from("historial_bultos")
    .insert(historyPayload);

  if (historyError) {
    throw new Error(
      `No se pudo registrar el historial de la división: ${historyError.message}`,
    );
  }
}

export type BundleAction = BundleActionEnum;

export type ApplyBundleActionInput = {
  bundleIds: string[];
  action: BundleActionEnum;
  destinationCode?: string | null;
  orderNumber?: string | null;
};

async function checkAndUpdateOrderStatus(bundleIds: string[]) {
  // Obtener las órdenes únicas de los bultos afectados
  const { data: bundlesWithOrder, error: fetchError } = await supabase
    .from("bultos")
    .select("orden_corte_id")
    .in("id", bundleIds);

  if (fetchError || !bundlesWithOrder) {
    // No lanzar error para no interrumpir el flujo principal
    console.error("No se pudo verificar las órdenes:", fetchError?.message);
    return;
  }

  const uniqueOrderIds = Array.from(
    new Set(bundlesWithOrder.map((b) => b.orden_corte_id))
  );

  // Para cada orden, verificar si todos los bultos están utilizados
  for (const orderId of uniqueOrderIds) {
    const { data: orderBundles, error: bundlesError } = await supabase
      .from("bultos")
      .select("id, estado")
      .eq("orden_corte_id", orderId);

    if (bundlesError || !orderBundles || orderBundles.length === 0) {
      continue;
    }

    // Verificar si todos los bultos están utilizados
    const allUsed = orderBundles.every((bundle) => bundle.estado === "usado");
    
    // Verificar si hay al menos un bulto disponible o asignado
    const hasAvailableOrAssigned = orderBundles.some(
      (bundle) => bundle.estado === "disponible" || bundle.estado === "asignado"
    );

    // Si todos están utilizados (y no hay ninguno disponible o asignado), marcar orden como inactiva
    if (allUsed && !hasAvailableOrAssigned) {
      const { error: updateOrderError } = await supabase
        .from("ordenes_corte")
        .update({ activo: false })
        .eq("id", orderId);

      if (updateOrderError) {
        console.error(
          `No se pudo actualizar el estado de la orden ${orderId}:`,
          updateOrderError.message
        );
      }
    }
  }
}

export async function applyBundleAction({
  bundleIds,
  action,
  destinationCode,
  orderNumber,
}: ApplyBundleActionInput) {
  if (!bundleIds.length) {
    throw new Error("Selecciona al menos un bulto.");
  }

  if (action === "utilizar") {
    const { data: bundlesInfo, error: bundlesFetchError } = await supabase
      .from("bultos")
      .select("id, estado")
      .in("id", bundleIds);

    if (bundlesFetchError) {
      throw new Error(
        `No se pudieron validar los bultos seleccionados: ${bundlesFetchError.message}`,
      );
    }

    const invalid = (bundlesInfo ?? []).filter((bundle) => bundle.estado !== "asignado");
    if (invalid.length > 0) {
      throw new Error(
        "Solo se pueden marcar como utilizados los bultos que estén asignados.",
      );
    }
  }

  let locationId: string | null = null;
  if (action === "mover") {
    const normalizedDestination = normalizeLocationCode(destinationCode ?? undefined);
    if (!normalizedDestination) {
      throw new Error("Selecciona una ubicación de destino válida.");
    }
    const locationMap = await ensureLocationMap([normalizedDestination]);
    locationId = locationMap[normalizedDestination] ?? null;
    if (!locationId) {
      throw new Error("No se pudo resolver la ubicación seleccionada.");
    }
  }

  const normalizedOrder = orderNumber?.trim() ?? "";
  const historyWorkOrder = normalizedOrder || null;
  if (action === "asignar" && !historyWorkOrder) {
    throw new Error("Ingresa un número de orden válido.");
  }

  const nextStatus = bundleStatusByAction[action];
  const updatePayload: Record<string, unknown> = {};
  if (locationId) {
    updatePayload.ubicacion_id = locationId;
  }
  if (nextStatus) {
    updatePayload.estado = nextStatus;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await supabase
      .from("bultos")
      .update(updatePayload)
      .in("id", bundleIds);

    if (updateError) {
      throw new Error(`No se pudieron actualizar los bultos: ${updateError.message}`);
    }
  }

  const historyPayload = bundleIds.map((bundleId) => ({
    bulto_id: bundleId,
    accion: action,
    ubicacion_destino_id: locationId,
    numero_trabajo: action === "asignar" ? historyWorkOrder : null,
    fecha_hora: new Date().toISOString(),
  }));

  const { error: historyError } = await supabase
    .from("historial_bultos")
    .insert(historyPayload);

  if (historyError) {
    throw new Error(`No se pudo registrar el historial: ${historyError.message}`);
  }

  // Verificar y actualizar el estado de la orden si todos los bultos están utilizados
  await checkAndUpdateOrderStatus(bundleIds);
}
