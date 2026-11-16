import { generateTelevendId } from '@/lib/machine-id-utils';

export interface TelevendMachineOption {
  value: number;
  label: string;
  clientName?: string;
}

export function resolveLegacyTelevendMachineId(machine: { name?: string | null; televend_machine_id?: string | null }, options: TelevendMachineOption[]): number | null {
  const names = [machine.name || ''];
  // El importador antiguo anteponía «cliente : nombre de máquina».
  // Usar ese separador explícito evita buscar por coincidencias parciales o por
  // el número comercial (p. ej. 5133), que no es el ID de Televend (203591).
  const separator = names[0].indexOf(' : ');
  if (separator >= 0) names.push(names[0].slice(separator + 3).trim());
  const keys = new Set(names.filter(Boolean).map(generateTelevendId));
  if (machine.televend_machine_id) keys.add(machine.televend_machine_id);
  const ids = new Set(options.filter(option => {
    if (!Number.isInteger(option.value) || option.value <= 0) return false;
    const aliases = [option.label];
    if (option.clientName) aliases.push(`${option.clientName} : ${option.label}`);
    return aliases.some(label => label && keys.has(generateTelevendId(label)));
  }).map(option => option.value));
  // Rechazar ambigüedades: no mostrar el stock de otra máquina por accidente.
  return ids.size === 1 ? [...ids][0] : null;
}
