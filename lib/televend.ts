import type { FrekuentStockMachine, FrekuentStockProduct } from '@/lib/frekuent';

const TELEVEND_AUTH_BASE = 'https://auth.televendcloud.com/auth/realms/televend/protocol/openid-connect';
const TELEVEND_PLANOGRAMS_BASE = 'https://api-cloud.televendcloud.com/planograms/v1';
const TELEVEND_MACHINIST_BASE = 'https://api-cloud.televendcloud.com/machinist/api/v1';
const TELEVEND_LEGACY_BASE = 'https://televendcloud.com';

interface CachedTelevendToken {
  accessToken: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  idToken?: string;
  sid?: string;
  expiresAt: number;
}

interface TelevendLoginResponse {
  access_token?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  id_token?: string;
}

interface TelevendListResponse<T> {
  meta?: {
    code?: number;
    message?: string;
    page?: number;
    page_size?: number;
    has_next_page?: boolean;
    number_of_items?: number;
  };
  content?: T[];
}

interface TelevendSingleResponse<T> {
  meta?: {
    code?: number;
    message?: string;
  };
  content?: T;
}

interface TelevendMachineRow {
  id?: unknown;
  caption?: unknown;
  external_id?: unknown;
  location?: {
    caption?: unknown;
    city?: unknown;
    region?: {
      caption?: unknown;
    };
  } | null;
  client?: {
    caption?: unknown;
  } | null;
  brand?: {
    caption?: unknown;
  } | null;
  model?: {
    caption?: unknown;
  } | null;
}

interface TelevendColumnRow {
  id?: unknown;
  product_id?: unknown;
  capacity?: unknown;
  fill_quantity?: unknown;
  current_quantity?: unknown;
  minimum_route_pickup?: unknown;
  warning_quantity?: unknown;
  price_1?: unknown;
  state?: unknown;
  column?: unknown;
  view_column?: unknown;
}

interface TelevendProductRow {
  id?: unknown;
  caption?: unknown;
  external_id?: unknown;
  price?: unknown;
  image_url?: unknown;
}

interface TelevendRevenueAggregateRow {
  total_revenue?: unknown;
  number_of_sale_vends?: unknown;
  total_quantity?: unknown;
}

interface TelevendVendRow {
  vend_id?: unknown;
  machine_id?: unknown;
  machine_caption?: unknown;
  location_caption?: unknown;
  timestamp?: unknown;
  product_caption?: unknown;
  value?: unknown;
  quantity?: unknown;
  payment_type?: unknown;
  payment_type_caption?: unknown;
}

interface TelevendPaymentBreakdown {
  totalCard: number;
  totalCash: number;
  detailTotal: number;
}

export interface TelevendQuantityUpdateRow {
  columnId: number;
  quantity: number;
}

export interface TelevendRevenueMachine {
  machineId: number;
  machineName: string;
  externalId?: string;
  location?: string;
  totalRevenue: number;
  totalSales: number;
  totalQuantity: number;
  totalCard: number;
  totalCash: number;
}

export interface TelevendLatestSale {
  id: string;
  machineId: number;
  machineName?: string;
  location?: string;
  productName: string;
  datetime: string;
  paymentMethod: string;
  amount: number;
  quantity: number;
}

let cachedToken: CachedTelevendToken | null = null;
let loginPromise: Promise<CachedTelevendToken> | null = null;

export class TelevendApiError extends Error {
  status: number;
  userMessage: string;

  constructor(status: number, userMessage: string, message?: string) {
    super(message || userMessage);
    this.name = 'TelevendApiError';
    this.status = status;
    this.userMessage = userMessage;
  }
}

function getTelevendCredentials(): { username: string; password: string } | null {
  const username = process.env.TELEVEND_USERNAME?.trim();
  const password = process.env.TELEVEND_PASSWORD?.trim();
  if (!username || !password) return null;
  return { username, password };
}

function getTelevendTenantId() {
  return process.env.TELEVEND_TENANT_ID?.trim() || '5';
}

function getTelevendCompanyId() {
  return process.env.TELEVEND_COMPANY_ID?.trim() || '4949';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function decodeJwtExpiresAt(token: string): number | null {
  const json = decodeJwtPayload(token);
  return typeof json?.exp === 'number' ? json.exp * 1000 : null;
}

function isTokenUsable(token: CachedTelevendToken): boolean {
  return Date.now() < token.expiresAt - 60_000;
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((value) => value.trim()).filter(Boolean);
}

class TelevendCookieJar {
  private cookies = new Map<string, string>();

  addFrom(headers: Headers) {
    for (const header of getSetCookieHeaders(headers)) {
      const [pair] = header.split(';');
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) continue;
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  header() {
    return Array.from(this.cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name: string) {
    return this.cookies.get(name);
  }
}

function resolveLegacyUrl(location: string, baseUrl: string) {
  return new URL(location, baseUrl).toString();
}

function extractLoginAction(html: string) {
  const formMatch = html.match(/<form[^>]+id=["']kc-form-login["'][\s\S]*?>/i)
    || html.match(/<form[^>]+action=["'][^"']*login-actions\/authenticate[^"']*["'][\s\S]*?>/i);
  const form = formMatch?.[0];
  const actionMatch = form?.match(/\saction=["']([^"']+)["']/i);
  return actionMatch?.[1]?.replace(/&amp;/g, '&');
}

async function legacyFetch(
  jar: TelevendCookieJar,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookieHeader = jar.header();
  if (cookieHeader) headers.set('Cookie', cookieHeader);

  const response = await fetch(url, {
    ...init,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  });
  jar.addFrom(response.headers);
  return response;
}

async function followLegacyRedirects(
  jar: TelevendCookieJar,
  initialUrl: string,
  init: RequestInit = {},
  maxRedirects = 12,
): Promise<{ response: Response; url: string }> {
  let url = initialUrl;
  let requestInit = init;

  for (let index = 0; index <= maxRedirects; index += 1) {
    const response = await legacyFetch(jar, url, requestInit);
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, url };
    }

    const location = response.headers.get('location');
    if (!location) return { response, url };

    url = resolveLegacyUrl(location, url);
    requestInit = {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    };
  }

  throw new TelevendApiError(508, 'Televend ha devuelto demasiadas redirecciones');
}

async function loginTelevendLegacy(machineId: number): Promise<TelevendCookieJar> {
  const credentials = getTelevendCredentials();
  if (!credentials) {
    throw new TelevendApiError(
      500,
      'Falta configurar la conexión con Televend',
      'TELEVEND_USERNAME/TELEVEND_PASSWORD no están configurados',
    );
  }

  const jar = new TelevendCookieJar();
  const companyId = getTelevendCompanyId();
  const machineUrl = `${TELEVEND_LEGACY_BASE}/es/c/${companyId}/administration/machine_detail/overview/${machineId}/?editable=1&show_current_quantity=true`;
  const landing = await followLegacyRedirects(jar, machineUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  let html = await landing.response.text();
  if (landing.response.ok && html.includes('Editar Cant.')) {
    await syncTelevendLegacyKeycloakCache(jar, machineUrl);
    return jar;
  }

  const action = extractLoginAction(html);
  if (!action) {
    throw new TelevendApiError(502, 'No se pudo abrir el formulario de sesión de Televend');
  }

  const loginBody = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
    credentialId: '',
    login: 'Login',
  });

  const login = await followLegacyRedirects(jar, resolveLegacyUrl(action, landing.url), {
    method: 'POST',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: loginBody,
  });

  html = await login.response.text();
  if (!login.response.ok) {
    throw new TelevendApiError(login.response.status, 'Televend no pudo iniciar sesión para guardar cantidades');
  }
  if (html.includes('kc-form-login') || html.includes('login-actions/authenticate')) {
    throw new TelevendApiError(401, 'Credenciales de Televend no válidas');
  }

  await syncTelevendLegacyKeycloakCache(jar, machineUrl);
  return jar;
}

async function syncTelevendLegacyKeycloakCache(jar: TelevendCookieJar, referer: string): Promise<void> {
  const token = await getFreshTelevendToken();
  const csrfToken = jar.get('csrftoken');
  if (!csrfToken) return;

  const response = await legacyFetch(jar, `${TELEVEND_LEGACY_BASE}/es/keycloak/cache-sync`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Origin: TELEVEND_LEGACY_BASE,
      Referer: referer,
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      refresh_expires_in: token.refreshExpiresIn,
      id_token: token.idToken,
      sid: token.sid,
    }),
  });

  if (!response.ok) {
    throw new TelevendApiError(response.status, 'Televend no pudo sincronizar la sesión antes de guardar stock');
  }
}

async function buildTelevendError(response: Response): Promise<TelevendApiError> {
  const text = await response.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const detail = parsed?.detail || parsed?.meta?.message || parsed?.message || text;
  if (response.status === 401 || response.status === 403) {
    return new TelevendApiError(response.status, 'Televend ha denegado la sesión o los permisos', detail);
  }
  if (response.status === 429) {
    return new TelevendApiError(response.status, 'Televend está limitando las peticiones', detail);
  }
  if (response.status >= 500) {
    return new TelevendApiError(response.status, 'Televend no está disponible temporalmente', detail);
  }
  return new TelevendApiError(response.status, 'Televend no pudo completar la petición', detail);
}

async function loginTelevend(): Promise<CachedTelevendToken> {
  const credentials = getTelevendCredentials();
  if (!credentials) {
    throw new TelevendApiError(
      500,
      'Falta configurar la conexión con Televend',
      'TELEVEND_USERNAME/TELEVEND_PASSWORD no están configurados'
    );
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.TELEVEND_API_TIMEOUT_MS || 12000);
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, timeoutMs));

  try {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: 'televendcloud',
      username: credentials.username,
      password: credentials.password,
      scope: 'openid',
    });

    const response = await fetch(`${TELEVEND_AUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new TelevendApiError(response.status, 'Credenciales de Televend no válidas');
      }
      throw await buildTelevendError(response);
    }

    const data = await response.json() as TelevendLoginResponse;
    if (!data.access_token) {
      throw new TelevendApiError(502, 'Televend no devolvió un token de sesión válido');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      refreshExpiresIn: data.refresh_expires_in,
      idToken: data.id_token,
      sid: stringFromUnknown(decodeJwtPayload(data.access_token)?.sid),
      expiresAt: decodeJwtExpiresAt(data.access_token) || Date.now() + 4 * 60 * 1000,
    };
  } catch (error) {
    if (error instanceof TelevendApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TelevendApiError(504, 'Televend ha tardado demasiado en iniciar sesión');
    }
    throw new TelevendApiError(502, 'No se pudo iniciar sesión en Televend');
  } finally {
    clearTimeout(timeout);
  }
}

async function getFreshTelevendToken(): Promise<CachedTelevendToken> {
  if (cachedToken && isTokenUsable(cachedToken)) return cachedToken;

  if (!loginPromise) {
    loginPromise = loginTelevend()
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

async function televendFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getFreshTelevendToken();
  const response = await fetch(`${TELEVEND_PLANOGRAMS_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token.accessToken}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry) {
    cachedToken = null;
    return televendFetch<T>(path, init, false);
  }

  if (!response.ok) {
    throw await buildTelevendError(response);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function televendMachinistFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getFreshTelevendToken();
  const response = await fetch(`${TELEVEND_MACHINIST_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token.accessToken}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry) {
    cachedToken = null;
    return televendMachinistFetch<T>(path, init, false);
  }

  if (!response.ok) {
    throw await buildTelevendError(response);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      results.push(await mapper(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getTelevendMachines(): Promise<TelevendMachineRow[]> {
  const payload = await televendFetch<TelevendListResponse<TelevendMachineRow>>(
    `/tenants/${getTelevendTenantId()}/companies/${getTelevendCompanyId()}/machines?page=1&page_size=200`,
  );
  return Array.isArray(payload.content) ? payload.content : [];
}

async function getTelevendMachineRevenueAggregate({
  machineId,
  fromTimestamp,
  toTimestamp,
}: {
  machineId: number;
  fromTimestamp: string;
  toTimestamp: string;
}): Promise<TelevendRevenueAggregateRow> {
  const params = new URLSearchParams({
    from_timestamp: fromTimestamp,
    to_timestamp: toTimestamp,
    machine_detail_id: String(machineId),
    machine_mode: 'live',
  });

  return televendMachinistFetch<TelevendRevenueAggregateRow>(
    `/tenants/${getTelevendTenantId()}/companies/${getTelevendCompanyId()}/vends/aggregates?${params.toString()}`,
  );
}

async function getTelevendMachineVendsPage({
  machineId,
  fromTimestamp,
  toTimestamp,
  page,
  pageSize,
}: {
  machineId: number;
  fromTimestamp: string;
  toTimestamp: string;
  page: number;
  pageSize: number;
}): Promise<TelevendListResponse<TelevendVendRow>> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    from_timestamp: fromTimestamp,
    to_timestamp: toTimestamp,
    order_by: '-timestamp',
    machine_detail_id: String(machineId),
    machine_mode: 'live',
  });

  return televendMachinistFetch<TelevendListResponse<TelevendVendRow>>(
    `/tenants/${getTelevendTenantId()}/companies/${getTelevendCompanyId()}/vends?${params.toString()}`,
  );
}

function isCashTelevendPayment(vend: TelevendVendRow) {
  const caption = stringFromUnknown(vend.payment_type_caption)?.toLowerCase() || '';
  const paymentType = String(vend.payment_type ?? '').toLowerCase();
  return /cash|efectivo|moneda|coin|billete|bill/.test(caption) || ['1', 'cash'].includes(paymentType);
}

async function getTelevendMachinePaymentBreakdown({
  machineId,
  fromTimestamp,
  toTimestamp,
}: {
  machineId: number;
  fromTimestamp: string;
  toTimestamp: string;
}): Promise<TelevendPaymentBreakdown> {
  const pageSize = Number(process.env.TELEVEND_VENDS_PAGE_SIZE || 100);
  const maxPages = Number(process.env.TELEVEND_VENDS_MAX_PAGES || 200);
  let page = 1;
  let totalCard = 0;
  let totalCash = 0;

  while (page <= maxPages) {
    const payload = await getTelevendMachineVendsPage({
      machineId,
      fromTimestamp,
      toTimestamp,
      page,
      pageSize,
    });
    const rows = Array.isArray(payload.content) ? payload.content : [];

    for (const vend of rows) {
      const amount = numberFromUnknown(vend.value);
      if (isCashTelevendPayment(vend)) {
        totalCash += amount;
      } else {
        totalCard += amount;
      }
    }

    if (!payload.meta?.has_next_page || rows.length === 0) break;
    page += 1;
  }

  return {
    totalCard: Math.round(totalCard * 100) / 100,
    totalCash: Math.round(totalCash * 100) / 100,
    detailTotal: Math.round((totalCard + totalCash) * 100) / 100,
  };
}

function normalizeTelevendRevenueMachine(
  machine: TelevendMachineRow,
  aggregate: TelevendRevenueAggregateRow,
  breakdown: TelevendPaymentBreakdown,
): TelevendRevenueMachine | null {
  const machineId = Math.round(numberFromUnknown(machine.id));
  if (machineId <= 0) return null;

  return {
    machineId,
    machineName: stringFromUnknown(machine.caption) || `Televend ${machineId}`,
    externalId: stringFromUnknown(machine.external_id),
    location: machineLocation(machine),
    totalRevenue: Math.round(numberFromUnknown(aggregate.total_revenue) * 100) / 100,
    totalSales: Math.round(numberFromUnknown(aggregate.number_of_sale_vends)),
    totalQuantity: Math.round(numberFromUnknown(aggregate.total_quantity)),
    totalCard: breakdown.totalCard,
    totalCash: breakdown.totalCash,
  };
}

export async function getTelevendRevenueMachines({
  fromTimestamp,
  toTimestamp,
  machineIds = [],
}: {
  fromTimestamp: string;
  toTimestamp: string;
  machineIds?: number[];
}): Promise<TelevendRevenueMachine[]> {
  const machines = await getTelevendMachines();
  const selectedIds = new Set(machineIds);
  const selectedMachines = selectedIds.size > 0
    ? machines.filter((machine) => selectedIds.has(Math.round(numberFromUnknown(machine.id))))
    : machines;

  const revenues = await mapLimited(
    selectedMachines.filter((machine) => Math.round(numberFromUnknown(machine.id)) > 0),
    Number(process.env.TELEVEND_REVENUE_CONCURRENCY || 6),
    async (machine) => {
      const machineId = Math.round(numberFromUnknown(machine.id));
      const aggregate = await getTelevendMachineRevenueAggregate({
        machineId,
        fromTimestamp,
        toTimestamp,
      });
      const breakdown = await getTelevendMachinePaymentBreakdown({
        machineId,
        fromTimestamp,
        toTimestamp,
      }).catch(() => ({ totalCard: 0, totalCash: 0, detailTotal: 0 }));

      if (breakdown.detailTotal <= 0 && numberFromUnknown(aggregate.total_revenue) > 0) {
        breakdown.totalCard = Math.round(numberFromUnknown(aggregate.total_revenue) * 100) / 100;
      }

      return normalizeTelevendRevenueMachine(machine, aggregate, breakdown);
    },
  );

  return revenues.filter(Boolean) as TelevendRevenueMachine[];
}

function normalizeTelevendLatestSale(row: TelevendVendRow): TelevendLatestSale | null {
  const machineId = Math.round(numberFromUnknown(row.machine_id));
  const id = String(row.vend_id ?? '');
  const productName = stringFromUnknown(row.product_caption) || '';
  const datetime = stringFromUnknown(row.timestamp) || '';

  if (!id || !machineId || !productName || !datetime) return null;

  return {
    id,
    machineId,
    machineName: stringFromUnknown(row.machine_caption),
    location: stringFromUnknown(row.location_caption),
    productName,
    datetime,
    paymentMethod: stringFromUnknown(row.payment_type_caption) || 'Pago',
    amount: Math.round(numberFromUnknown(row.value) * 100) / 100,
    quantity: Math.round(numberFromUnknown(row.quantity)),
  };
}

export async function getTelevendLatestSales({
  fromTimestamp,
  toTimestamp,
  machineIds = [],
  limit = 20,
}: {
  fromTimestamp: string;
  toTimestamp: string;
  machineIds?: number[];
  limit?: number;
}): Promise<TelevendLatestSale[]> {
  const selectedIds = machineIds.filter((id) => Number.isInteger(id) && id > 0).slice(0, 24);
  const perMachineLimit = Math.max(1, Math.min(20, limit));

  const results = await Promise.allSettled(
    selectedIds.map(async (machineId) => {
      const payload = await getTelevendMachineVendsPage({
        machineId,
        fromTimestamp,
        toTimestamp,
        page: 1,
        pageSize: perMachineLimit,
      });

      return (payload.content || [])
        .map(normalizeTelevendLatestSale)
        .filter(Boolean) as TelevendLatestSale[];
    }),
  );

  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

async function getTelevendProductsMap(): Promise<Map<number, TelevendProductRow>> {
  const payload = await televendFetch<TelevendListResponse<TelevendProductRow>>(
    `/tenants/${getTelevendTenantId()}/companies/${getTelevendCompanyId()}/products?page=1&page_size=500`,
  );
  const products = Array.isArray(payload.content) ? payload.content : [];
  return new Map(
    products
      .map((product) => [numberFromUnknown(product.id), product] as const)
      .filter(([id]) => id > 0)
  );
}

async function getTelevendMachineColumns(machineId: number): Promise<TelevendColumnRow[]> {
  const payload = await televendFetch<TelevendListResponse<TelevendColumnRow>>(
    `/tenants/${getTelevendTenantId()}/companies/${getTelevendCompanyId()}/machines/${machineId}/columns`,
  );
  return Array.isArray(payload.content) ? payload.content : [];
}

function getProductName(column: TelevendColumnRow, productMap: Map<number, TelevendProductRow>) {
  const productId = numberFromUnknown(column.product_id);
  const product = productMap.get(productId);
  return stringFromUnknown(product?.caption) || `Producto ${productId || 'sin asignar'}`;
}

function normalizeTelevendProduct(
  column: TelevendColumnRow,
  productMap: Map<number, TelevendProductRow>,
): FrekuentStockProduct | null {
  const capacity = Math.round(numberFromUnknown(column.capacity || column.fill_quantity));
  const quantity = Math.round(numberFromUnknown(column.current_quantity));
  const productId = Math.round(numberFromUnknown(column.product_id));
  const line = String(Math.round(numberFromUnknown(column.view_column || column.column)) || '');

  if (capacity <= 0 && quantity <= 0 && !productId) return null;

  const product = productMap.get(productId);
  const stockPercent = capacity > 0 ? Math.round((quantity / capacity) * 100) : 0;
  const unitsToReplenish = Math.max(0, capacity - quantity);
  const min = Math.round(numberFromUnknown(column.warning_quantity || column.minimum_route_pickup));
  const price = numberFromUnknown(column.price_1 || product?.price);

  return {
    line,
    productId,
    railId: Math.round(numberFromUnknown(column.id)) || undefined,
    productName: getProductName(column, productMap),
    image: stringFromUnknown(product?.image_url),
    price: Number.isFinite(price) ? Math.round(price * 100) : undefined,
    quantity,
    capacity,
    unitsToReplenish,
    min,
    stockLabel: capacity > 0 ? `${quantity}/${capacity}` : undefined,
    stockPercent,
    status: stringFromUnknown(column.state),
  };
}

function computeUrgency(values: {
  totalCapacity: number;
  totalAvailable: number;
  outOfStockCount: number;
  lowStockCount: number;
}): FrekuentStockMachine['urgency'] {
  if (values.totalCapacity <= 0) return 'unknown';
  if (values.totalAvailable <= 0 || values.outOfStockCount > 0) return 'empty';

  const fillRate = values.totalCapacity > 0
    ? Math.round((values.totalAvailable / values.totalCapacity) * 100)
    : 0;

  if (fillRate < 65) return 'critical';
  if (fillRate < 75) return 'normal';
  return 'ok';
}

function machineLocation(machine: TelevendMachineRow) {
  return [
    stringFromUnknown(machine.location?.caption),
    stringFromUnknown(machine.location?.city),
    stringFromUnknown(machine.location?.region?.caption),
  ].filter(Boolean).join(' · ');
}

async function getTelevendStockMachine(
  machine: TelevendMachineRow,
  productMap: Map<number, TelevendProductRow>,
): Promise<FrekuentStockMachine> {
  const machineId = Math.round(numberFromUnknown(machine.id));
  const columns = await getTelevendMachineColumns(machineId);
  const products = columns
    .map((column) => normalizeTelevendProduct(column, productMap))
    .filter(Boolean) as FrekuentStockProduct[];

  const totalCapacity = products.reduce((sum, product) => sum + product.capacity, 0);
  const totalAvailable = products.reduce((sum, product) => sum + product.quantity, 0);
  const totalToReplenish = products.reduce((sum, product) => sum + product.unitsToReplenish, 0);
  const outOfStockCount = products.filter((product) => product.capacity > 0 && product.quantity <= 0).length;
  const lowStockCount = products.filter((product) => {
    if (product.capacity <= 0) return false;
    if (product.quantity <= 0) return false;
    return product.stockPercent < 35 || (product.min > 0 && product.quantity <= product.min);
  }).length;

  return {
    machineId,
    label: stringFromUnknown(machine.caption) || `Televend ${machineId}`,
    machineNumber: stringFromUnknown(machine.external_id),
    clientName: stringFromUnknown(machine.client?.caption),
    location: machineLocation(machine),
    machineStatus: ['Televend'],
    products,
    totalProducts: products.length,
    totalCapacity,
    totalAvailable,
    totalToReplenish,
    fillRate: totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 100) : 0,
    outOfStockCount,
    lowStockCount,
    urgency: computeUrgency({ totalCapacity, totalAvailable, outOfStockCount, lowStockCount }),
  };
}

export async function getTelevendStockMachines(machineIds: number[] = []): Promise<FrekuentStockMachine[]> {
  const [machines, productMap] = await Promise.all([
    getTelevendMachines(),
    getTelevendProductsMap(),
  ]);

  const selectedMachines = machineIds.length > 0
    ? machines.filter((machine) => machineIds.includes(Math.round(numberFromUnknown(machine.id))))
    : machines;

  const validMachines = selectedMachines.filter((machine) => Math.round(numberFromUnknown(machine.id)) > 0);
  const stockMachines = await mapLimited(
    validMachines,
    Number(process.env.TELEVEND_STOCK_CONCURRENCY || 6),
    (machine) => getTelevendStockMachine(machine, productMap),
  );

  const urgencyOrder: Record<FrekuentStockMachine['urgency'], number> = {
    critical: 0,
    empty: 1,
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

export async function updateTelevendMachineQuantities(
  machineId: number,
  rows: TelevendQuantityUpdateRow[],
): Promise<void> {
  if (!Number.isInteger(machineId) || machineId <= 0) {
    throw new TelevendApiError(400, 'ID de máquina de Televend no válido');
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TelevendApiError(400, 'No hay cantidades de Televend para guardar');
  }

  const normalizedRows = rows.map((row, index) => {
    const columnId = Math.round(numberFromUnknown(row.columnId));
    const quantity = Math.round(numberFromUnknown(row.quantity));
    if (!Number.isInteger(columnId) || columnId <= 0) {
      throw new TelevendApiError(400, `La columna ${index + 1} no es válida`);
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new TelevendApiError(400, `La cantidad de la columna ${index + 1} no es válida`);
    }
    return { columnId, quantity };
  });

  const jar = await loginTelevendLegacy(machineId);
  const csrfToken = jar.get('csrftoken');
  if (!csrfToken) {
    throw new TelevendApiError(502, 'Televend no devolvió token CSRF para guardar cantidades');
  }

  const companyId = getTelevendCompanyId();
  const form = new FormData();
  for (const row of normalizedRows) {
    form.set(String(row.columnId), String(row.quantity));
  }

  const saveUrl = `${TELEVEND_LEGACY_BASE}/es/c/${companyId}/service/machine_detail/save_product_quantity/${machineId}/`;
  const referer = `${TELEVEND_LEGACY_BASE}/es/c/${companyId}/administration/machine_detail/overview/${machineId}/?editable=0&show_current_quantity=true`;
  const response = await legacyFetch(jar, saveUrl, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      Origin: TELEVEND_LEGACY_BASE,
      Referer: referer,
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: form,
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new TelevendApiError(response.status, 'Televend no pudo guardar las cantidades', text);
  }
  if (text.includes('kc-form-login') || text.includes('login-actions/authenticate')) {
    throw new TelevendApiError(401, 'La sesión de Televend ha caducado al guardar cantidades');
  }
  if (text.trim() !== '1') {
    throw new TelevendApiError(
      502,
      'Televend no confirmó el guardado de stock',
      text || 'Respuesta vacía al guardar cantidades',
    );
  }

  await verifyTelevendQuantityUpdate(machineId, normalizedRows);
}

async function verifyTelevendQuantityUpdate(
  machineId: number,
  rows: TelevendQuantityUpdateRow[],
): Promise<void> {
  const expectedByColumn = new Map(rows.map((row) => [row.columnId, row.quantity]));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }

    const columns = await getTelevendMachineColumns(machineId);
    const mismatches = columns
      .map((column) => {
        const columnId = Math.round(numberFromUnknown(column.id));
        if (!expectedByColumn.has(columnId)) return null;
        const expected = expectedByColumn.get(columnId);
        const actual = Math.round(numberFromUnknown(column.current_quantity));
        return actual === expected ? null : { columnId, expected, actual };
      })
      .filter(Boolean) as Array<{ columnId: number; expected: number; actual: number }>;

    if (mismatches.length === 0) return;
  }

  throw new TelevendApiError(
    502,
    'Televend respondió correctamente, pero no confirmó el cambio de stock',
    'La lectura posterior no coincide con las cantidades enviadas',
  );
}

export async function refillTelevendMachineStock(machineId: number): Promise<void> {
  if (!Number.isInteger(machineId) || machineId <= 0) {
    throw new TelevendApiError(400, 'ID de máquina de Televend no válido');
  }

  const columns = await getTelevendMachineColumns(machineId);
  const rows = columns
    .map((column) => {
      const columnId = Math.round(numberFromUnknown(column.id));
      const capacity = Math.round(numberFromUnknown(column.capacity || column.fill_quantity));
      return { columnId, quantity: capacity };
    })
    .filter((row) => row.columnId > 0 && row.quantity >= 0);

  await updateTelevendMachineQuantities(machineId, rows);
}
