const FREKUENT_API_BASE = 'https://frekuent.io/dashboard/v1';

export interface FrekuentMachineOption {
  label: string;
  value: number;
}

export interface FrekuentPointOfSalesActivityParams {
  startDate: string;
  endDate: string;
  machineIds?: number[];
}

export interface FrekuentRevenueMachine {
  machineId: number;
  machineName: string;
  machineNumber?: string;
  clientName?: string;
  location?: string;
  serialNumber?: string;
  totalMoney: number;
  totalSales: number;
  totalCard: number;
  totalCash: number;
  totalCashless: number;
  numberTransactions: number;
}

export interface FrekuentStockProduct {
  line: string;
  mdbCode?: string;
  productId?: number;
  railId?: number;
  productName: string;
  image?: string;
  category?: string;
  price?: number;
  quantity: number;
  capacity: number;
  unitsToReplenish: number;
  min: number;
  stockLabel?: string;
  stockPercent: number;
  status?: string;
}

export interface FrekuentStockMachine {
  machineId: number;
  label: string;
  machineNumber?: string;
  clientName?: string;
  location?: string;
  route?: string;
  serialNumber?: string;
  machineStatus?: string[];
  products: FrekuentStockProduct[];
  totalProducts: number;
  totalCapacity: number;
  totalAvailable: number;
  totalToReplenish: number;
  fillRate: number;
  outOfStockCount: number;
  lowStockCount: number;
  urgency: 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';
}

export interface FrekuentProductOption {
  id: number;
  name: string;
  category?: string;
  image?: string;
}

export interface FrekuentRailUpdateRow {
  rail: number | string | null;
  machine_id?: number;
  number: number;
  number_mdb: number | null;
  product_id: number;
  quantity: number;
  capacity: number;
  price: number;
  min: number;
}

interface CachedFrekuentToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface FrekuentLoginResponse {
  access_token?: string;
  refresh_token?: string;
}

interface FrekuentMachineTableRow {
  main_id?: unknown;
  id_machine?: unknown;
  name_machine?: unknown;
  number_machine?: unknown;
  client_name?: unknown;
  route?: unknown;
  location?: unknown;
  serial_number?: unknown;
  status?: unknown;
  total_money?: unknown;
  total_sales?: unknown;
  total_card?: unknown;
  total_cash?: unknown;
  total_cashless?: unknown;
  number_transactions?: unknown;
}

interface FrekuentProductTableRow {
  id?: unknown;
  name?: unknown;
  product_category?: unknown;
  url?: unknown;
}

let cachedToken: CachedFrekuentToken | null = null;
let loginPromise: Promise<CachedFrekuentToken> | null = null;

export class FrekuentApiError extends Error {
  status: number;
  userMessage: string;

  constructor(status: number, userMessage: string, message?: string) {
    super(message || userMessage);
    this.name = 'FrekuentApiError';
    this.status = status;
    this.userMessage = userMessage;
  }
}

function getFrekuentCredentials(): { user: string; password: string } | null {
  const user = process.env.FREKUENT_USERNAME?.trim() || process.env.ORAIN_USERNAME?.trim();
  const password = process.env.FREKUENT_PASSWORD?.trim() || process.env.ORAIN_PASSWORD?.trim();

  if (!user || !password) return null;

  return { user, password };
}

function decodeJwtExpiresAt(token: string): number | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenUsable(token: CachedFrekuentToken): boolean {
  return Date.now() < token.expiresAt - 60_000;
}

async function loginFrekuent(): Promise<CachedFrekuentToken> {
  const credentials = getFrekuentCredentials();
  if (!credentials) {
    throw new FrekuentApiError(
      500,
      'Falta configurar la conexión con Frekuent',
      'FREKUENT_USERNAME/FREKUENT_PASSWORD u ORAIN_USERNAME/ORAIN_PASSWORD no están configurados'
    );
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.FREKUENT_API_TIMEOUT_MS || 12000);
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, timeoutMs));

  try {
    const response = await fetch(`${FREKUENT_API_BASE}/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        timezone: 'Europe/Madrid',
        language: 'spanish',
        language_abbreviation: 'es',
        'x-platform': 'web',
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new FrekuentApiError(response.status, 'Credenciales de Frekuent no válidas');
      }
      throw await buildFrekuentError(response);
    }

    const data = await response.json() as FrekuentLoginResponse;
    if (!data.access_token) {
      throw new FrekuentApiError(502, 'Frekuent no devolvió un token de sesión válido');
    }

    const expiresAt = decodeJwtExpiresAt(data.access_token) || Date.now() + 23 * 60 * 60 * 1000;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof FrekuentApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FrekuentApiError(504, 'Frekuent ha tardado demasiado en iniciar sesión');
    }

    throw new FrekuentApiError(502, 'No se pudo iniciar sesión en Frekuent');
  } finally {
    clearTimeout(timeout);
  }
}

async function getFreshFrekuentToken(): Promise<CachedFrekuentToken> {
  if (cachedToken && isTokenUsable(cachedToken)) return cachedToken;

  if (!loginPromise) {
    loginPromise = loginFrekuent()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        loginPromise = null;
      });
  }

  return loginPromise;
}

export async function getFrekuentAccessToken(): Promise<string> {
  const credentials = getFrekuentCredentials();
  if (credentials) {
    return (await getFreshFrekuentToken()).accessToken;
  }

  const token = process.env.FREKUENT_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new FrekuentApiError(
      500,
      'Falta configurar la conexión con Frekuent',
      'FREKUENT_ACCESS_TOKEN no está configurado'
    );
  }

  return token;
}

async function getFrekuentHeaders(): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${await getFrekuentAccessToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    timezone: 'Europe/Madrid',
    language: 'spanish',
    language_abbreviation: 'es',
    'x-platform': 'web',
  };
}

async function frekuentFetch<T>(
  path: '/forms/machines' | '/pos/chart/point-of-sales-activity',
  init: RequestInit = {},
): Promise<T> {
  return frekuentFetchWithRetry<T>(path, init, true);
}

async function frekuentPlanogramFetch<T>(
  machineId: number,
  init: RequestInit = {},
): Promise<T> {
  if (!Number.isInteger(machineId) || machineId <= 0) {
    throw new FrekuentApiError(400, 'ID de máquina no válido');
  }

  return frekuentFetchWithRetry<T>(
    `/pos/pos/planogram/table?machine=${machineId}`,
    init,
    true,
  );
}

async function frekuentFetchWithRetry<T>(
  path: string,
  init: RequestInit,
  allowAuthRetry: boolean,
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.FREKUENT_API_TIMEOUT_MS || 12000);
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, timeoutMs));

  try {
    const response = await fetch(`${FREKUENT_API_BASE}${path}`, {
      ...init,
      headers: {
        ...await getFrekuentHeaders(),
        ...init.headers,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401 && allowAuthRetry && getFrekuentCredentials()) {
        cachedToken = null;
        return frekuentFetchWithRetry<T>(path, init, false);
      }

      throw await buildFrekuentError(response);
    }

    const text = await response.text();
    if (!text.trim()) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  } catch (error) {
    if (error instanceof FrekuentApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FrekuentApiError(504, 'Frekuent ha tardado demasiado en responder');
    }

    throw new FrekuentApiError(502, 'No se pudo conectar con Frekuent');
  } finally {
    clearTimeout(timeout);
  }
}

async function buildFrekuentError(response: Response): Promise<FrekuentApiError> {
  const status = response.status;
  let detail = '';

  try {
    const text = await response.text();
    detail = text.slice(0, 500);
  } catch {
    detail = '';
  }

  if (status === 401) {
    return new FrekuentApiError(401, 'La sesión con Frekuent ha caducado', detail);
  }
  if (status === 403) {
    return new FrekuentApiError(403, 'Frekuent ha denegado el acceso a estos datos', detail);
  }
  if (status === 429) {
    return new FrekuentApiError(429, 'Frekuent está limitando las peticiones. Inténtalo de nuevo en unos minutos', detail);
  }
  if (status >= 500) {
    return new FrekuentApiError(status, 'Frekuent no está disponible temporalmente', detail);
  }

  return new FrekuentApiError(status, 'Frekuent no pudo completar la petición', detail);
}

export async function getFrekuentMachines(): Promise<FrekuentMachineOption[]> {
  const data = await frekuentFetch<unknown>('/forms/machines', { method: 'GET' });

  if (!Array.isArray(data)) {
    throw new FrekuentApiError(502, 'Frekuent devolvió una lista de máquinas no válida');
  }

  return data
    .map((item) => {
      const row = item as { label?: unknown; value?: unknown };
      return {
        label: typeof row.label === 'string' ? row.label : '',
        value: typeof row.value === 'number' ? row.value : Number(row.value),
      };
    })
    .filter((item) => item.label && Number.isFinite(item.value));
}

export async function getFrekuentPointOfSalesActivity({
  startDate,
  endDate,
  machineIds = [],
}: FrekuentPointOfSalesActivityParams): Promise<unknown> {
  return frekuentFetch<unknown>('/pos/chart/point-of-sales-activity', {
    method: 'POST',
    body: JSON.stringify({
      start_date: startDate,
      end_date: endDate,
      filters: {
        client_ids: [],
        machines_ids: machineIds,
      },
    }),
  });
}

function centsToEuros(value: unknown): number {
  return Math.round((numberFromUnknown(value) / 100) * 100) / 100;
}

function normalizeRevenueMachine(row: FrekuentMachineTableRow): FrekuentRevenueMachine | null {
  const machineId = numberFromUnknown(row.id_machine ?? row.main_id);
  const machineName = typeof row.name_machine === 'string' ? row.name_machine.trim() : '';

  if (!machineId || !machineName) return null;

  return {
    machineId,
    machineName,
    machineNumber: typeof row.number_machine === 'string' && row.number_machine.trim() ? row.number_machine.trim() : undefined,
    clientName: typeof row.client_name === 'string' && row.client_name.trim() ? row.client_name.trim() : undefined,
    location: typeof row.location === 'string' && row.location.trim() ? row.location.trim() : undefined,
    serialNumber: typeof row.serial_number === 'string' && row.serial_number.trim() ? row.serial_number.trim() : undefined,
    totalMoney: centsToEuros(row.total_money),
    totalSales: centsToEuros(row.total_sales),
    totalCard: centsToEuros(row.total_card),
    totalCash: centsToEuros(row.total_cash),
    totalCashless: centsToEuros(row.total_cashless),
    numberTransactions: Math.round(numberFromUnknown(row.number_transactions)),
  };
}

export async function getFrekuentRevenueMachines({
  startDate,
  endDate,
  datesLogic = 'custom',
  pageSize = 200,
}: {
  startDate: string;
  endDate: string;
  datesLogic?: 'today' | 'current_month' | 'custom';
  pageSize?: number;
}): Promise<FrekuentRevenueMachine[]> {
  const firstPayload = await frekuentFetchWithRetry<{ data?: FrekuentMachineTableRow[]; total?: number; recordsTotal?: number }>(
    '/pos/table/pos',
    {
      method: 'POST',
      body: JSON.stringify({
        page: 1,
        pageSize,
        sort_by: 'name_machine',
        direction: 'asc',
        filters: {},
        start_date: startDate,
        end_date: endDate,
        dates_logic: datesLogic,
        search: '',
        use_cache: false,
        query_filters: {},
      }),
    },
    true,
  );

  const rows = [...(firstPayload.data || [])];
  const total = numberFromUnknown(firstPayload.total ?? firstPayload.recordsTotal);
  const totalPages = total > pageSize ? Math.ceil(total / pageSize) : 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await frekuentFetchWithRetry<{ data?: FrekuentMachineTableRow[] }>(
      '/pos/table/pos',
      {
        method: 'POST',
        body: JSON.stringify({
          page,
          pageSize,
          sort_by: 'name_machine',
          direction: 'asc',
          filters: {},
          start_date: startDate,
          end_date: endDate,
          dates_logic: datesLogic,
          search: '',
          use_cache: false,
          query_filters: {},
        }),
      },
      true,
    );

    rows.push(...(payload.data || []));
  }

  return rows
    .map(normalizeRevenueMachine)
    .filter(Boolean) as FrekuentRevenueMachine[];
}

export async function getFrekuentMachineMetadataMap(machineIds: number[] = []): Promise<Map<number, Partial<FrekuentStockMachine>>> {
  const { startDate, endDate } = getMadridTodayRange();
  const selectedIds = new Set(machineIds);
  const metadata = new Map<number, Partial<FrekuentStockMachine>>();

  const payload = await frekuentFetchWithRetry<{ data?: FrekuentMachineTableRow[] }>('/pos/table/pos', {
    method: 'POST',
    body: JSON.stringify({
      page: 1,
      pageSize: 100,
      sort_by: 'name_machine',
      direction: 'asc',
      filters: {},
      start_date: startDate,
      end_date: endDate,
      dates_logic: 'today',
      search: '',
      use_cache: true,
      query_filters: {},
    }),
  }, true);

  for (const row of payload.data || []) {
    const machineId = numberFromUnknown(row.id_machine);
    if (!machineId || (selectedIds.size > 0 && !selectedIds.has(machineId))) continue;

    metadata.set(machineId, {
      machineNumber: typeof row.number_machine === 'string' && row.number_machine.trim() ? row.number_machine.trim() : undefined,
      clientName: typeof row.client_name === 'string' && row.client_name.trim() ? row.client_name.trim() : undefined,
      location: typeof row.location === 'string' && row.location.trim() ? row.location.trim() : undefined,
      route: typeof row.route === 'string' && row.route.trim() ? row.route.trim() : undefined,
      serialNumber: row.serial_number == null ? undefined : String(row.serial_number),
      machineStatus: Array.isArray(row.status) ? row.status.filter((item): item is string => typeof item === 'string') : undefined,
    });
  }

  return metadata;
}

export async function refillFrekuentMachineStock(machineId: number): Promise<void> {
  if (!Number.isInteger(machineId) || machineId <= 0) {
    throw new FrekuentApiError(400, 'ID de máquina no válido');
  }

  await frekuentFetchWithRetry<unknown>(
    `/pos/refill/stock?id_machine=${machineId}`,
    { method: 'POST' },
    true,
  );

  await frekuentFetchWithRetry<unknown>(
    `/pos/sync/planogram?id_machine=${machineId}`,
    { method: 'POST' },
    true,
  );
}

export async function getFrekuentProductOptions(): Promise<FrekuentProductOption[]> {
  const payload = await frekuentFetchWithRetry<{ data?: FrekuentProductTableRow[] }>(
    '/pos/products/table',
    {
      method: 'POST',
      body: JSON.stringify({
        page: 1,
        pageSize: 1000,
        sort_by: 'name',
        direction: 'asc',
        filters: {},
        search: '',
        query_filters: {},
      }),
    },
    true,
  );

  return (payload.data || [])
    .map((row) => ({
      id: numberFromUnknown(row.id),
      name: typeof row.name === 'string' ? row.name.trim() : '',
      category: typeof row.product_category === 'string' && row.product_category.trim() ? row.product_category.trim() : undefined,
      image: typeof row.url === 'string' && row.url.trim() ? row.url.trim() : undefined,
    }))
    .filter((product) => product.id > 0 && product.name);
}

export async function updateFrekuentMachineRails(machineId: number, rows: FrekuentRailUpdateRow[]): Promise<void> {
  if (!Number.isInteger(machineId) || machineId <= 0) {
    throw new FrekuentApiError(400, 'ID de máquina no válido');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new FrekuentApiError(400, 'El planograma debe tener al menos un raíl');
  }

  await frekuentFetchWithRetry<unknown>(
    `/pos/machine/rail?id_machine=${machineId}`,
    {
      method: 'PUT',
      headers: {
        'x-action-id': 'points-of-sale.planogram.update',
      },
      body: JSON.stringify({
        service: 'vending',
        with_mdb: 0,
        rows: rows.map((row) => ({
          ...row,
          machine_id: machineId,
        })),
      }),
    },
    true,
  );

  await frekuentFetchWithRetry<unknown>(
    `/pos/sync/planogram?id_machine=${machineId}`,
    { method: 'POST' },
    true,
  );
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizePlanogramProduct(row: Record<string, unknown>): FrekuentStockProduct | null {
  const productName = typeof row.product_name === 'string' ? row.product_name.trim() : '';
  const quantity = numberFromUnknown(row.quantity);
  const capacity = numberFromUnknown(row.capacity);
  const stockPercent = numberFromUnknown(row.percentage_stock_value);

  if (!productName && capacity <= 0) return null;

  return {
    line: String(row.number ?? ''),
    mdbCode: row.number_mdb == null ? undefined : String(row.number_mdb),
    productId: numberFromUnknown(row.id_product) || undefined,
    railId: numberFromUnknown(row.id_rail) || undefined,
    productName: productName || 'Producto sin nombre',
    image: typeof row.image === 'string' && row.image.trim() ? row.image.trim() : undefined,
    category: typeof row.category === 'string' ? row.category : undefined,
    price: row.price == null ? undefined : numberFromUnknown(row.price),
    quantity,
    capacity,
    unitsToReplenish: Math.max(0, capacity - quantity),
    min: numberFromUnknown(row.min),
    stockLabel: typeof row.percentage_stock === 'string' ? row.percentage_stock : undefined,
    stockPercent: stockPercent || (capacity > 0 ? Math.round((quantity / capacity) * 100) : 0),
    status: typeof row.status === 'string' ? row.status : undefined,
  };
}

function getMachineUrgency(params: {
  fillRate: number;
  totalProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalCapacity: number;
  totalAvailable: number;
}): FrekuentStockMachine['urgency'] {
  if (params.totalProducts === 0) return 'unknown';
  if (params.totalCapacity > 0 && params.totalAvailable === 0) return 'empty';

  if (params.fillRate < 65) return 'critical';
  if (params.fillRate < 75) return 'normal';
  return 'ok';
}

export async function getFrekuentMachinePlanogram(
  machine: FrekuentMachineOption,
): Promise<FrekuentStockMachine> {
  const { startDate, endDate } = getMadridTodayRange();
  const payload = await frekuentPlanogramFetch<{ data?: unknown[] }>(machine.value, {
    method: 'POST',
    body: JSON.stringify({
      page: 1,
      pageSize: 100,
      sort_by: 'number',
      direction: 'asc',
      filters: {},
      start_date: startDate,
      end_date: endDate,
      dates_logic: 'today',
      search: '',
      use_cache: true,
      query_filters: {},
    }),
  });

  const products = (Array.isArray(payload.data) ? payload.data : [])
    .map((row) => normalizePlanogramProduct(row as Record<string, unknown>))
    .filter(Boolean) as FrekuentStockProduct[];

  const totalProducts = products.length;
  const totalCapacity = products.reduce((sum, product) => sum + product.capacity, 0);
  const totalAvailable = products.reduce((sum, product) => sum + product.quantity, 0);
  const totalToReplenish = products.reduce((sum, product) => sum + product.unitsToReplenish, 0);
  const outOfStockCount = products.filter((product) => product.capacity > 0 && product.quantity === 0).length;
  const lowStockCount = products.filter((product) => (
    product.capacity > 0
    && product.quantity > 0
    && (product.quantity <= product.min || (product.quantity / product.capacity) * 100 < 30)
  )).length;
  const fillRate = totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 100) : 0;

  return {
    machineId: machine.value,
    label: machine.label,
    products,
    totalProducts,
    totalCapacity,
    totalAvailable,
    totalToReplenish,
    fillRate,
    outOfStockCount,
    lowStockCount,
    urgency: getMachineUrgency({
      fillRate,
      totalProducts,
      outOfStockCount,
      lowStockCount,
      totalCapacity,
      totalAvailable,
    }),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function getFrekuentStockMachines(machineIds: number[] = []): Promise<FrekuentStockMachine[]> {
  const machines = await getFrekuentMachines();
  const selectedIds = new Set(machineIds);
  const selectedMachines = selectedIds.size > 0
    ? machines.filter((machine) => selectedIds.has(machine.value))
    : machines;

  const [stockMachines, metadataMap] = await Promise.all([
    mapWithConcurrency(
      selectedMachines,
      Number(process.env.FREKUENT_STOCK_CONCURRENCY || 6),
      getFrekuentMachinePlanogram,
    ),
    getFrekuentMachineMetadataMap(machineIds).catch(() => new Map<number, Partial<FrekuentStockMachine>>()),
  ]);

  const enrichedMachines = stockMachines.map((machine) => ({
    ...machine,
    ...metadataMap.get(machine.machineId),
  }));

  const urgencyOrder: Record<FrekuentStockMachine['urgency'], number> = {
    empty: 0,
    critical: 1,
    normal: 2,
    unknown: 3,
    ok: 4,
  };

  return enrichedMachines.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    if (b.totalToReplenish !== a.totalToReplenish) return b.totalToReplenish - a.totalToReplenish;
    return a.label.localeCompare(b.label);
  });
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const localAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );

  return Math.round((localAsUtc - date.getTime()) / 60000);
}

export function formatDateForFrekuent(date: Date, timeZone = 'Europe/Madrid'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMins = String(absOffset % 60).padStart(2, '0');

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${sign}${offsetHours}:${offsetMins}`;
}

export function getMadridTodayRange(now = new Date()): { startDate: string; endDate: string } {
  const madridParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string) => madridParts.find((part) => part.type === type)?.value || '00';
  const offsetMinutes = getTimeZoneOffsetMinutes(now, 'Europe/Madrid');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMins = String(absOffset % 60).padStart(2, '0');

  return {
    startDate: `${get('year')}-${get('month')}-${get('day')}T00:00:00${sign}${offsetHours}:${offsetMins}`,
    endDate: formatDateForFrekuent(now),
  };
}
