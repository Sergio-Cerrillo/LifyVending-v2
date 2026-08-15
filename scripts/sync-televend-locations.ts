import { supabaseAdmin } from '../lib/supabase-helpers';
import { getTelevendStockMachines } from '../lib/televend';

type TelevendLocationMachine = {
  id: string;
  name: string | null;
  location: string | null;
  televend_machine_id: string | null;
};

type TelevendStock = Awaited<ReturnType<typeof getTelevendStockMachines>>[number];
type LocationUpdateRow = {
  id: string;
  location: string;
  updated_at: string;
};

function isLikelyAddress(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 8) return false;

  return /(\d|c\.|c\/|carrer|calle|avinguda|avenida|av\.|plaça|plaza|palma|inca|alcudia|alcúdia|mallorca|balear|illes|santany|pobla|cala|manacor|llucmajor)/i.test(value);
}

function normalizeKey(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findStockForMachine(
  machine: { name: string | null; televend_machine_id: string | null },
  stockById: Map<string, TelevendStock>,
  stocks: TelevendStock[],
) {
  const byId = stockById.get(String(machine.televend_machine_id));
  if (byId) return byId;

  const machineKey = normalizeKey(machine.name || machine.televend_machine_id);
  if (!machineKey) return null;

  return stocks.find((stock) => {
    const labelKey = normalizeKey(stock.label);
    const locationKey = normalizeKey(stock.location);
    return machineKey.includes(labelKey) || labelKey.includes(machineKey) || machineKey.includes(locationKey);
  }) || null;
}

async function main() {
  const { data: machines, error } = await supabaseAdmin
    .from('machines')
    .select('id,name,location,televend_machine_id')
    .not('televend_machine_id', 'is', null);

  if (error) throw error;

  const machineRows = (machines || []) as TelevendLocationMachine[];
  const ids = machineRows
    .map((machine: TelevendLocationMachine) => Number(machine.televend_machine_id))
    .filter((id: number) => Number.isInteger(id) && id > 0);
  const stocks = await getTelevendStockMachines(ids);
  const stockById = new Map(stocks.map((stock) => [String(stock.machineId), stock]));

  const rows = machineRows
    .map((machine: TelevendLocationMachine) => {
      const stock = findStockForMachine(machine, stockById, stocks);
      const location = stock?.location?.trim();
      if (!location || location === machine.location || !isLikelyAddress(location)) return null;

      return {
        id: machine.id,
        location,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is LocationUpdateRow => Boolean(row));

  if (rows.length > 0) {
    for (const row of rows) {
      const { error: updateError } = await supabaseAdmin
        .from('machines')
        .update({ location: row.location, updated_at: row.updated_at } as any)
        .eq('id', row.id);

      if (updateError) throw updateError;
    }
  }

  console.log(JSON.stringify({
    televendMachines: machineRows.length,
    liveStocks: stocks.length,
    updated: rows.length,
    liveLocationSample: stocks.slice(0, 5).map((stock) => ({
      machineId: stock.machineId,
      label: stock.label,
      location: stock.location,
    })),
    storedLocationSample: machineRows.slice(0, 5).map((machine: TelevendLocationMachine) => ({
      machineId: machine.televend_machine_id,
      name: machine.name,
      location: machine.location,
    })),
    sample: rows.slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
