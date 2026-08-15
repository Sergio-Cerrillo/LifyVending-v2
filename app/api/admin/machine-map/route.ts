import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import { getFrekuentStockMachines, type FrekuentStockMachine } from '@/lib/frekuent';
import { getTelevendStockMachines } from '@/lib/televend';

export const dynamic = 'force-dynamic';

type Provider = 'frekuent' | 'televend';
type Urgency = 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';

interface MachineRow {
  id: string;
  name: string | null;
  location: string | null;
  status: string | null;
  frekuent_machine_id: string | null;
  orain_machine_id: string | null;
  televend_machine_id: string | null;
  daily_total: number | null;
  monthly_total: number | null;
  last_scraped_at: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
}

interface StockRow {
  machine_id: string;
  machine_name: string | null;
  machine_location: string | null;
  scraped_at: string | null;
  total_capacity: number | null;
  total_available: number | null;
  total_to_replenish: number | null;
  machines?: {
    id: string | null;
    frekuent_machine_id: string | null;
    orain_machine_id: string | null;
    televend_machine_id: string | null;
  } | null;
}

const MALLORCA_BOUNDS = {
  minLat: 39.25,
  maxLat: 40.1,
  minLng: 2.2,
  maxLng: 3.55,
};

const LOCALITY_COORDINATES: Array<{ pattern: RegExp; lat: number; lng: number }> = [
  { pattern: /\bpalma\b|\b070\d{2}\b|\bplatja de palma\b|\bsant agusti\b|\bponent\b|\bnord\b|\bcentre\b/i, lat: 39.5696, lng: 2.6502 },
  { pattern: /\binca\b|\b07300\b/i, lat: 39.7211, lng: 2.9116 },
  { pattern: /\bcanyamel\b|\b07589\b/i, lat: 39.6566, lng: 3.4382 },
  { pattern: /\bcala rajada\b|\b07590\b/i, lat: 39.7119, lng: 3.4631 },
  { pattern: /\bsantanyi\b|\bsantanyí\b|\b07650\b|\b07660\b/i, lat: 39.3546, lng: 3.1291 },
  { pattern: /\bsa pobla\b|\b07420\b/i, lat: 39.7699, lng: 3.0235 },
  { pattern: /\bllucmajor\b|\b07620\b/i, lat: 39.4909, lng: 2.8911 },
  { pattern: /\bmanacor\b|\b07500\b/i, lat: 39.5695, lng: 3.2095 },
  { pattern: /\bfelanitx\b|\b07200\b/i, lat: 39.4696, lng: 3.1483 },
  { pattern: /\balcudia\b|\balcúdia\b|\b07400\b/i, lat: 39.8532, lng: 3.1214 },
  { pattern: /\bport d'alcudia\b|\bport d’alcudia\b|\bport d'alcúdia\b|\bport d’alcúdia\b/i, lat: 39.8420, lng: 3.1327 },
  { pattern: /\bsoller\b|\bsóller\b|\b07100\b/i, lat: 39.7662, lng: 2.7152 },
  { pattern: /\bsanta ponca\b|\bsanta ponça\b|\b07180\b/i, lat: 39.5165, lng: 2.4816 },
  { pattern: /\bmarratxi\b|\bmarratxí\b|\b07141\b/i, lat: 39.6217, lng: 2.7254 },
];

async function requireDashboardUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !user) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Error obteniendo perfil', status: 500 as const };
  }

  if (!['admin', 'operador'].includes(profile.role)) {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile };
}

function getProvider(machine: MachineRow): Provider {
  return machine.televend_machine_id ? 'televend' : 'frekuent';
}

function getMachineUniqueKey(machine: MachineRow) {
  const provider = getProvider(machine);
  return `${provider}:${machine.televend_machine_id || machine.frekuent_machine_id || machine.orain_machine_id || machine.id}`;
}

function getMachineStockKeys(machine: MachineRow) {
  return [
    machine.id,
    machine.televend_machine_id,
    machine.frekuent_machine_id,
    machine.orain_machine_id,
  ].filter(Boolean) as string[];
}

function getExternalMachineIds(machine: MachineRow) {
  return [
    machine.televend_machine_id,
    machine.frekuent_machine_id,
    machine.orain_machine_id,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function getStockKeys(stock: StockRow) {
  return [
    stock.machine_id,
    stock.machines?.id,
    stock.machines?.televend_machine_id,
    stock.machines?.frekuent_machine_id,
    stock.machines?.orain_machine_id,
  ].filter(Boolean) as string[];
}

function getLiveStockKeys(stock: FrekuentStockMachine) {
  return [stock.machineId].filter((value) => Number.isInteger(value) && value > 0).map(String);
}

function getFillRate(stock?: StockRow) {
  const capacity = Number(stock?.total_capacity || 0);
  const available = Number(stock?.total_available || 0);
  if (capacity <= 0) return null;
  return Math.round((available / capacity) * 100);
}

function getLiveStockMap(stocks: FrekuentStockMachine[]) {
  const map = new Map<string, FrekuentStockMachine>();

  for (const stock of stocks) {
    for (const key of getLiveStockKeys(stock)) {
      map.set(key, stock);
    }
  }

  return map;
}

function normalizeMachineKey(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findLiveStockForMachine(
  machine: MachineRow,
  liveStocks: {
    frekuent: Map<string, FrekuentStockMachine>;
    televend: Map<string, FrekuentStockMachine>;
    frekuentList: FrekuentStockMachine[];
    televendList: FrekuentStockMachine[];
  },
) {
  const provider = getProvider(machine);
  const map = provider === 'televend' ? liveStocks.televend : liveStocks.frekuent;
  const list = provider === 'televend' ? liveStocks.televendList : liveStocks.frekuentList;
  const byExternalId = getExternalMachineIds(machine)
    .map((key) => map.get(String(key)))
    .find(Boolean);

  if (byExternalId) return byExternalId;
  if (provider !== 'televend') return null;

  const machineKey = normalizeMachineKey(machine.name || machine.televend_machine_id);
  if (!machineKey) return null;

  return list.find((stock) => {
    const labelKey = normalizeMachineKey(stock.label);
    const locationKey = normalizeMachineKey(stock.location);
    return machineKey.includes(labelKey) || labelKey.includes(machineKey) || machineKey.includes(locationKey);
  }) || null;
}

async function cacheLiveStocks(machines: MachineRow[], liveStocks: {
  frekuent: Map<string, FrekuentStockMachine>;
  televend: Map<string, FrekuentStockMachine>;
  frekuentList: FrekuentStockMachine[];
  televendList: FrekuentStockMachine[];
}) {
  const rows = machines
    .map((machine) => {
      const liveStock = findLiveStockForMachine(machine, liveStocks);

      if (!liveStock) return null;

      return {
        machine_id: machine.id,
        machine_name: machine.name || liveStock.label || 'Máquina',
        machine_location: liveStock.location || machine.location || null,
        scraped_at: new Date().toISOString(),
        total_products: liveStock.totalProducts,
        total_capacity: liveStock.totalCapacity,
        total_available: liveStock.totalAvailable,
        total_to_replenish: liveStock.totalToReplenish,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('machine_stock_current')
    .upsert(rows as any[], { onConflict: 'machine_id' });

  if (error) {
    console.warn('[ADMIN-MACHINE-MAP] No se pudo cachear stock live:', error.message);
    return 0;
  }

  return rows.length;
}

async function syncLiveMachineLocations(machines: MachineRow[], liveStocks: {
  frekuent: Map<string, FrekuentStockMachine>;
  televend: Map<string, FrekuentStockMachine>;
  frekuentList: FrekuentStockMachine[];
  televendList: FrekuentStockMachine[];
}) {
  const rows = machines
    .map((machine) => {
      const liveStock = findLiveStockForMachine(machine, liveStocks);
      const liveLocation = liveStock?.location?.trim();

      if (!liveLocation || liveLocation === machine.location || !isLikelyAddress(liveLocation)) return null;

      return {
        id: machine.id,
        location: liveLocation,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return 0;

  let updated = 0;
  for (const row of rows as Array<{ id: string; location: string; updated_at: string }>) {
    const { error } = await supabaseAdmin
      .from('machines')
      .update({ location: row.location, updated_at: row.updated_at } as any)
      .eq('id', row.id);

    if (error) {
      console.warn('[ADMIN-MACHINE-MAP] No se pudo sincronizar ubicación live:', error.message);
      continue;
    }
    updated += 1;
  }

  return updated;
}

async function getLiveStocksForMachines(machines: MachineRow[]) {
  const frekuentIds = new Set<number>();
  const televendIds = new Set<number>();

  for (const machine of machines) {
    const ids = getExternalMachineIds(machine);
    if (getProvider(machine) === 'televend') {
      ids.forEach((id) => televendIds.add(id));
    } else {
      ids.forEach((id) => frekuentIds.add(id));
    }
  }

  const [frekuentResult, televendResult] = await Promise.allSettled([
    frekuentIds.size > 0 ? getFrekuentStockMachines(Array.from(frekuentIds)) : Promise.resolve([]),
    televendIds.size > 0 ? getTelevendStockMachines(Array.from(televendIds)) : Promise.resolve([]),
  ]);

  return {
    frekuent: frekuentResult.status === 'fulfilled' ? getLiveStockMap(frekuentResult.value) : new Map<string, FrekuentStockMachine>(),
    televend: televendResult.status === 'fulfilled' ? getLiveStockMap(televendResult.value) : new Map<string, FrekuentStockMachine>(),
    frekuentList: frekuentResult.status === 'fulfilled' ? frekuentResult.value : [],
    televendList: televendResult.status === 'fulfilled' ? televendResult.value : [],
  };
}

function getUrgency(fillRate: number | null, stock?: StockRow): Urgency {
  if (fillRate === null && Number(stock?.total_to_replenish || 0) > 0) return 'critical';
  if (fillRate === null) return 'unknown';
  if (fillRate <= 0) return 'empty';
  if (fillRate < 65) return 'critical';
  if (fillRate < 75) return 'normal';
  return 'ok';
}

function isLikelyAddress(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 12) return false;
  if (['taller', 'tienda', 'gdrink'].includes(normalized)) return false;
  return /(\d|carrer|calle|avinguda|avenida|av\.|plaça|plaza|mallorca|balear|illes|palma|inca|santany|pobla|cala|manacor|alcudia|llucmajor)/i.test(value);
}

function isMallorcaCoordinate(lat: number, lng: number) {
  return (
    lat >= MALLORCA_BOUNDS.minLat
    && lat <= MALLORCA_BOUNDS.maxLat
    && lng >= MALLORCA_BOUNDS.minLng
    && lng <= MALLORCA_BOUNDS.maxLng
  );
}

function buildGeocodeQuery(location: string) {
  const hasBalearicContext = /balear|illes|mallorca|palma/i.test(location);
  return hasBalearicContext ? location : `${location}, Mallorca, Illes Balears, España`;
}

async function geocodeLocation(location: string) {
  if (process.env.MACHINE_MAP_ENABLE_EXTERNAL_GEOCODING !== 'true') {
    return null;
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', buildGeocodeQuery(location));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('countrycodes', 'es');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'LifyVendingAdminMap/1.0 (info@lifyvending.com)',
      'Accept-Language': 'es',
    },
  });

  if (!response.ok) return null;

  const results = await response.json() as Array<{
    lat?: string;
    lon?: string;
    importance?: number;
  }>;
  const first = results[0];
  if (!first?.lat || !first.lon) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isMallorcaCoordinate(lat, lng)) return null;

  return {
    lat,
    lng,
    confidence: Number(first.importance || 0),
  };
}

function geocodeLocationLocally(location: string) {
  const match = LOCALITY_COORDINATES.find((entry) => entry.pattern.test(location));
  if (!match) return null;

  return {
    lat: match.lat,
    lng: match.lng,
    confidence: 0.35,
  };
}

async function geocodeMissingMachines(machines: MachineRow[]) {
  const candidates = machines
    .filter((machine) => !machine.latitude || !machine.longitude)
    .filter((machine) => isLikelyAddress(machine.location));

  const geocoded = new Map<string, { lat: number; lng: number; confidence: number }>();
  let externalAttempts = 0;

  for (const machine of candidates) {
    const location = machine.location?.trim();
    if (!location) continue;

    const localResult = geocodeLocationLocally(location);
    if (!localResult && externalAttempts >= 4) continue;

    const result = localResult || await geocodeLocation(location).catch(() => null);
    if (!localResult) externalAttempts += 1;
    if (!result) continue;

    await supabaseAdmin
      .from('machines')
      .update({
        latitude: result.lat,
        longitude: result.lng,
        geocoded_at: new Date().toISOString(),
        geocode_source: localResult ? 'local_approx' : 'nominatim',
        geocode_confidence: result.confidence,
      })
      .eq('id', machine.id);

    geocoded.set(machine.id, result);

    if (!localResult) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return geocoded;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [machinesResult, stockResult] = await Promise.all([
      supabaseAdmin
        .from('machines')
        .select('id, name, location, status, frekuent_machine_id, orain_machine_id, televend_machine_id, daily_total, monthly_total, last_scraped_at, latitude, longitude, geocoded_at')
        .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null,televend_machine_id.not.is.null')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('machine_stock_current')
        .select('machine_id, machine_name, machine_location, scraped_at, total_capacity, total_available, total_to_replenish, machines(id, frekuent_machine_id, orain_machine_id, televend_machine_id)'),
    ]);

    if (machinesResult.error) {
      throw new Error(`No se pudieron cargar máquinas: ${machinesResult.error.message}`);
    }
    if (stockResult.error) {
      throw new Error(`No se pudo cargar stock: ${stockResult.error.message}`);
    }

    const allMachines = (machinesResult.data || []) as MachineRow[];
    const geocodedNow = await geocodeMissingMachines(allMachines);

    const latestByMachine = allMachines.reduce((acc, machine) => {
      const key = getMachineUniqueKey(machine);
      const timestamp = machine.last_scraped_at ? new Date(machine.last_scraped_at).getTime() : 0;
      const currentTimestamp = acc.get(key)?.last_scraped_at
        ? new Date(acc.get(key)!.last_scraped_at as string).getTime()
        : -1;
      if (!acc.has(key) || timestamp >= currentTimestamp) acc.set(key, machine);
      return acc;
    }, new Map<string, MachineRow>());

    const currentMachines = Array.from(latestByMachine.values());
    const liveStocks = await getLiveStocksForMachines(currentMachines);
    const [cachedLiveStocks, syncedLiveLocations] = await Promise.all([
      cacheLiveStocks(currentMachines, liveStocks),
      syncLiveMachineLocations(currentMachines, liveStocks),
    ]);

    const stockByMachine = new Map<string, StockRow>();
    for (const row of (stockResult.data || []) as StockRow[]) {
      for (const key of getStockKeys(row)) {
        stockByMachine.set(String(key), row);
      }
    }

    const points = currentMachines.map((machine) => {
      const stock = getMachineStockKeys(machine)
        .map((key) => stockByMachine.get(String(key)))
        .find(Boolean);
      const liveStock = findLiveStockForMachine(machine, liveStocks);
      const geocoded = geocodedNow.get(machine.id);
      const lat = geocoded?.lat ?? machine.latitude;
      const lng = geocoded?.lng ?? machine.longitude;
      const fillRate = typeof liveStock?.fillRate === 'number' ? liveStock.fillRate : getFillRate(stock);
      const location = liveStock?.location || machine.location || stock?.machine_location || null;

      return {
        id: machine.id,
        name: machine.name || liveStock?.label || stock?.machine_name || 'Máquina',
        location,
        provider: getProvider(machine),
        latitude: lat,
        longitude: lng,
        hasCoordinates: typeof lat === 'number' && typeof lng === 'number',
        fillRate,
        urgency: liveStock?.urgency || getUrgency(fillRate, stock),
        totalToReplenish: Number(liveStock?.totalToReplenish ?? stock?.total_to_replenish ?? 0),
        dailyTotal: Number(machine.daily_total || 0),
        monthlyTotal: Number(machine.monthly_total || 0),
        stockUpdatedAt: stock?.scraped_at || null,
        geocodedAt: geocoded ? new Date().toISOString() : machine.geocoded_at,
      };
    });

    const mappedPoints = points.filter((point) => point.hasCoordinates);
    const pointsWithStock = points.filter((point) => point.fillRate !== null).length;

    return NextResponse.json({
      success: true,
      requestedAt: new Date().toISOString(),
      geocodedThisRequest: geocodedNow.size,
      cachedLiveStocks,
      syncedLiveLocations,
      pointsWithStock,
      total: points.length,
      mapped: mappedPoints.length,
      pending: points.length - mappedPoints.length,
      points,
    });
  } catch (error) {
    console.error('[ADMIN-MACHINE-MAP] Error:', error);
    const message = error instanceof Error ? error.message : 'Error cargando mapa de máquinas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
