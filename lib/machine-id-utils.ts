/**
 * Utilidades para normalización de IDs de máquinas
 * 
 * Este archivo centraliza la lógica de normalización de nombres
 * para prevenir duplicados en la base de datos.
 */

/**
 * Normaliza un nombre de máquina para usarlo como ID único
 * 
 * Proceso:
 * 1. Convierte a minúsculas
 * 2. Elimina acentos y diacríticos
 * 3. Reemplaza caracteres especiales por guiones bajos
 * 4. Elimina guiones bajos múltiples
 * 5. Elimina guiones bajos al inicio y final
 * 
 * Ejemplos:
 * - "Máquina Norte" → "maquina_norte"
 * - "MÁQUINA NORTE" → "maquina_norte"
 * - "Maquina   Norte!!" → "maquina_norte"
 * - "Café Bar 123" → "cafe_bar_123"
 * 
 * @param name - Nombre original de la máquina
 * @returns Nombre normalizado para usar como ID
 */
export function normalizeMachineName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    .toLowerCase() // minúsculas
    .normalize('NFD') // Descomponer caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos (acentos)
    .replace(/[^a-z0-9]+/g, '_') // Reemplazar no-alfanuméricos por _
    .replace(/_+/g, '_') // Reemplazar múltiples _ por uno solo
    .replace(/^_|_$/g, '') // Eliminar _ al inicio y final
    .trim();
}

/**
 * Genera un ID de Frekuent normalizado
 * 
 * @param machineName - Nombre de la máquina
 * @returns ID normalizado para Frekuent/Orain
 */
export function generateFrekuentId(machineName: string): string {
  return normalizeMachineName(machineName);
}

/**
 * Genera un ID de Televend normalizado
 * 
 * @param machineName - Nombre de la máquina
 * @returns ID normalizado para Televend con prefijo
 */
export function generateTelevendId(machineName: string): string {
  const normalized = normalizeMachineName(machineName);
  return `televend_${normalized}`;
}

/**
 * Busca una máquina existente por nombre normalizado
 * 
 * Busca en ambos campos (frekuent_machine_id y televend_machine_id)
 * usando la normalización para encontrar coincidencias.
 * 
 * @param supabaseClient - Cliente de Supabase (con permisos admin)
 * @param machineName - Nombre de la máquina a buscar
 * @param source - Fuente de la máquina ('frekuent' | 'televend')
 * @returns ID de la máquina si existe, null si no
 */
export async function findMachineByNormalizedName(
  supabaseClient: any,
  machineName: string,
  source: 'frekuent' | 'televend'
): Promise<string | null> {
  const normalizedId = source === 'frekuent' 
    ? generateFrekuentId(machineName)
    : generateTelevendId(machineName);

  const field = source === 'frekuent' ? 'frekuent_machine_id' : 'televend_machine_id';

  // Buscar por el ID normalizado
  const { data } = await supabaseClient
    .from('machines')
    .select('id')
    .eq(field, normalizedId)
    .maybeSingle();

  if (data) {
    return data.id;
  }

  // Fallback: buscar por nombre (case-insensitive)
  const { data: nameMatch } = await supabaseClient
    .from('machines')
    .select('id')
    .ilike('name', machineName)
    .maybeSingle();

  return nameMatch?.id || null;
}
