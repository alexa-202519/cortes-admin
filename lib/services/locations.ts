import { supabase } from "@/lib/supabase-client";

export type Location = {
  id: string;
  codigo: string;
};

/**
 * Obtiene todas las ubicaciones disponibles desde la base de datos
 * ordenadas alfabéticamente por código
 */
export async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from("ubicaciones")
    .select("id, codigo")
    .order("codigo", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar las ubicaciones: ${error.message}`);
  }

  return (data ?? []).filter((location) => location.codigo !== null) as Location[];
}
