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

export interface FrekuentStockProduct {
  line: string;
  productName: string;
  category?: string;
  price?: string;
  quantity: number;
  capacity: number;
  unitsToReplenish: number;
  min: number;
  status?: string;
}

export interface FrekuentStockMachine {
  machineId: number;
  label: string;
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

interface CachedFrekuentToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface FrekuentLoginResponse {
  access_token?: string;
  refresh_token?: string;
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

    return await response.json() as T;
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

  if (!productName && capacity <= 0) return null;

  return {
    line: String(row.number ?? ''),
    productName: productName || 'Producto sin nombre',
    category: typeof row.category === 'string' ? row.category : undefined,
    price: typeof row.price === 'string' ? row.price : undefined,
    quantity,
    capacity,
    unitsToReplenish: Math.max(0, capacity - quantity),
    min: numberFromUnknown(row.min),
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

  const emptyLaneRate = params.outOfStockCount / params.totalProducts;
  if (params.fillRate < 30 || params.outOfStockCount >= 4 || emptyLaneRate >= 0.2) return 'critical';
  if (params.fillRate < 70 || params.lowStockCount > 0 || params.outOfStockCount > 0) return 'normal';
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

  const stockMachines = await mapWithConcurrency(
    selectedMachines,
    Number(process.env.FREKUENT_STOCK_CONCURRENCY || 6),
    getFrekuentMachinePlanogram,
  );

  const urgencyOrder: Record<FrekuentStockMachine['urgency'], number> = {
    empty: 0,
    critical: 1,
    normal: 2,
    unknown: 3,
    ok: 4,
  };

  return stockMachines.sort((a, b) => {
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
