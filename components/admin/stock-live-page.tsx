'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MoreVertical,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface StockProduct {
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

interface StockMachine {
  machineId: number;
  source?: TelemetryProvider;
  label: string;
  machineNumber?: string;
  clientName?: string;
  location?: string;
  route?: string;
  serialNumber?: string;
  machineStatus?: string[];
  products: StockProduct[];
  totalProducts: number;
  totalCapacity: number;
  totalAvailable: number;
  totalToReplenish: number;
  fillRate: number;
  outOfStockCount: number;
  lowStockCount: number;
  urgency: 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';
}

interface StockLiveResponse {
  success: boolean;
  requestedAt: string;
  selectedMachineIds: number[];
  stockMachines: StockMachine[];
}

type TabKey = 'all' | 'empty' | 'critical' | 'normal' | 'ok';
type TelemetryProvider = 'frekuent' | 'televend';
type ReplenishmentAction = 'full-refill';

interface PendingReplenishmentAction {
  action: ReplenishmentAction;
  machine: StockMachine;
}

interface ProductOption {
  id: number;
  name: string;
  category?: string;
  image?: string;
}

interface RailEditRow {
  key: string;
  railId?: number;
  number: string;
  mdbCode: string;
  productId: string;
  productName: string;
  category?: string;
  price: string;
  quantity: string;
  capacity: string;
  min: string;
  deleted?: boolean;
}

interface RailEditorState {
  machine: StockMachine;
  rows: RailEditRow[];
}

interface QuantityEditRow {
  key: string;
  columnId: number;
  line: string;
  productName: string;
  category?: string;
  quantity: string;
  capacity: number;
  stockLabel?: string;
}

interface QuantityEditorState {
  machine: StockMachine;
  rows: QuantityEditRow[];
}

const tabOptions: Array<{ key: TabKey; label: string; dotClassName: string }> = [
  { key: 'all', label: 'Todas', dotClassName: 'bg-zinc-500' },
  { key: 'critical', label: 'Crítico', dotClassName: 'bg-red-600' },
  { key: 'normal', label: 'Normal', dotClassName: 'bg-yellow-500' },
  { key: 'ok', label: 'Bien', dotClassName: 'bg-green-600' },
  { key: 'empty', label: 'Vacías', dotClassName: 'bg-zinc-950' },
];

function mobileTabClassName(tab: TabKey) {
  const activeClassNames: Record<TabKey, string> = {
    all: 'data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white',
    empty: 'data-[state=active]:border-zinc-950 data-[state=active]:bg-zinc-950 data-[state=active]:text-white',
    critical: 'data-[state=active]:border-red-600 data-[state=active]:bg-red-600 data-[state=active]:text-white',
    normal: 'data-[state=active]:border-yellow-500 data-[state=active]:bg-yellow-500 data-[state=active]:text-white',
    ok: 'data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white',
  };

  return activeClassNames[tab];
}

const telemetryProviders: Array<{ key: TelemetryProvider; label: string; description: string }> = [
  { key: 'frekuent', label: 'Frekuent', description: 'Telemetría activa' },
  { key: 'televend', label: 'Televend', description: 'Telemetría activa' },
];

function getErrorMessage(status: number, fallback: string) {
  if (status === 401) return 'La sesión con el proveedor ha caducado o tu sesión de usuario no es válida.';
  if (status === 403) return 'No tienes permisos para consultar Stock o el proveedor ha denegado el acceso.';
  if (status === 429) return 'El proveedor está limitando las peticiones. Espera unos minutos antes de reintentar.';
  if (status >= 500) return fallback || 'El proveedor no está disponible temporalmente.';
  return fallback || 'No se pudo consultar el proveedor.';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin datos';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function machineSubtitle(machine: StockMachine) {
  return [machine.location, machine.clientName, machine.machineNumber].filter(Boolean).join(' · ');
}

function urgencyMeta(urgency: StockMachine['urgency']) {
  if (urgency === 'empty') {
    return {
      label: 'VACÍA',
      description: 'Sin unidades disponibles',
      icon: XCircle,
      badge: 'bg-zinc-950 text-white border-zinc-950',
      border: 'border-zinc-400',
      bar: 'bg-zinc-950',
      soft: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    };
  }
  if (urgency === 'critical') {
    return {
      label: 'CRÍTICO',
      description: 'Menos del 65%',
      icon: AlertTriangle,
      badge: 'bg-red-600 text-white border-red-600',
      border: 'border-red-300',
      bar: 'bg-red-600',
      soft: 'bg-red-50 text-red-800 border-red-200',
    };
  }
  if (urgency === 'normal') {
    return {
      label: 'NORMAL',
      description: '65% a 74%',
      icon: Zap,
      badge: 'bg-yellow-500 text-white border-yellow-500',
      border: 'border-yellow-300',
      bar: 'bg-yellow-500',
      soft: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    };
  }
  if (urgency === 'unknown') {
    return {
      label: 'SIN DATOS',
      description: 'Sin planograma',
      icon: AlertCircle,
      badge: 'bg-zinc-500 text-white border-zinc-500',
      border: 'border-zinc-300',
      bar: 'bg-zinc-500',
      soft: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    };
  }
  return {
    label: 'BIEN',
    description: '75% o más',
    icon: CheckCircle2,
    badge: 'bg-green-600 text-white border-green-600',
    border: 'border-green-300',
    bar: 'bg-green-600',
    soft: 'bg-green-50 text-green-800 border-green-200',
  };
}

function productStatus(product: StockProduct) {
  if (product.capacity > 0 && product.quantity === 0) {
    return { label: 'Reponer ya', className: 'bg-red-600 text-white border-red-600' };
  }
  if (product.unitsToReplenish > 0 && (product.quantity <= product.min || product.quantity / product.capacity < 0.3)) {
    return { label: 'Bajo', className: 'bg-orange-500 text-white border-orange-500' };
  }
  if (product.unitsToReplenish > 0) {
    return { label: 'Completar', className: 'bg-yellow-500 text-white border-yellow-500' };
  }
  return { label: 'OK', className: 'bg-green-600 text-white border-green-600' };
}

function sortedProducts(products: StockProduct[]) {
  return [...products].sort((a, b) => {
    const statusWeight = (p: StockProduct) => {
      if (p.capacity > 0 && p.quantity === 0) return 0;
      if (p.unitsToReplenish > 0 && (p.quantity <= p.min || p.quantity / p.capacity < 0.3)) return 1;
      if (p.unitsToReplenish > 0) return 2;
      return 3;
    };
    const diff = statusWeight(a) - statusWeight(b);
    if (diff !== 0) return diff;
    if (b.unitsToReplenish !== a.unitsToReplenish) return b.unitsToReplenish - a.unitsToReplenish;
    return Number(a.line || 0) - Number(b.line || 0);
  });
}

function MachineCardSkeleton() {
  return (
    <Card className="border border-zinc-200 bg-white">
      <CardHeader>
        <div className="space-y-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
      </CardContent>
    </Card>
  );
}

function StockPageSkeleton() {
  return (
    <div className="w-full max-w-[100dvw] space-y-4 overflow-x-hidden px-3 pb-4 sm:space-y-6 sm:px-0 sm:pb-0">
      <div className="w-full max-w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <Skeleton className="hidden h-12 w-12 rounded-2xl sm:block" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-8 w-44 rounded-xl" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-64 max-w-full rounded-full" />
              </div>
            </div>
            <Skeleton className="h-4 w-52 rounded-full sm:ml-14" />
          </div>

          <div className="flex w-full max-w-full flex-col gap-3 md:w-auto md:min-w-[360px]">
            <Skeleton className="h-3 w-36 rounded-full" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-black text-emerald-800 shadow-sm">
        <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
        Cargando stocks de las fuentes...
      </div>

      <Card className="gap-0 overflow-hidden border-zinc-200 bg-white py-0 shadow-sm sm:hidden">
        <CardContent className="grid grid-cols-2 gap-px bg-zinc-100 p-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white p-3">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="mt-3 h-8 w-16 rounded-xl" />
              <Skeleton className="mt-2 h-3 w-24 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="hidden w-full max-w-full grid-cols-2 gap-2 sm:grid sm:gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="min-w-0 border-zinc-200 bg-white shadow-sm">
            <CardHeader className="px-3 pb-1 pt-4 sm:px-6">
              <Skeleton className="h-4 w-24 rounded-full" />
            </CardHeader>
            <CardContent className="min-w-0 px-3 pb-4 sm:px-6">
              <Skeleton className="h-10 w-20 rounded-xl" />
              <Skeleton className="mt-2 h-3 w-28 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-12 w-full rounded-xl sm:hidden" />
        <div className="hidden h-auto w-full gap-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:flex lg:w-auto">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 min-w-[112px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl lg:max-w-md" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => <MachineCardSkeleton key={index} />)}
      </div>
    </div>
  );
}

function productFillRate(product: StockProduct) {
  if (Number.isFinite(product.stockPercent)) return Math.round(product.stockPercent);
  if (product.capacity <= 0) return 0;
  return Math.round((product.quantity / product.capacity) * 100);
}

function centsToEuroInput(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0,00';
  return (value / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NaN;
}

function parseEuroToCents(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100);
}

function createRailEditRows(machine: StockMachine): RailEditRow[] {
  return sortedProducts(machine.products).map((product, index) => ({
    key: `${product.railId || 'new'}-${product.line || index}`,
    railId: product.railId,
    number: product.line || String(index + 1),
    mdbCode: product.mdbCode || '',
    productId: product.productId ? String(product.productId) : '',
    productName: product.productName,
    category: product.category,
    price: centsToEuroInput(product.price),
    quantity: String(product.quantity),
    capacity: String(product.capacity),
    min: String(product.min),
  }));
}

export function StockLivePage() {
  const [telemetryProvider, setTelemetryProvider] = useState<TelemetryProvider>('frekuent');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StockLiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<number>>(new Set());
  const [pendingReplenishmentAction, setPendingReplenishmentAction] = useState<PendingReplenishmentAction | null>(null);
  const [runningReplenishmentAction, setRunningReplenishmentAction] = useState(false);
  const [railEditor, setRailEditor] = useState<RailEditorState | null>(null);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [loadingProductOptions, setLoadingProductOptions] = useState(false);
  const [savingRails, setSavingRails] = useState(false);
  const [confirmRailSaveOpen, setConfirmRailSaveOpen] = useState(false);
  const [quantityEditor, setQuantityEditor] = useState<QuantityEditorState | null>(null);
  const [savingQuantities, setSavingQuantities] = useState(false);
  const [confirmQuantitySaveOpen, setConfirmQuantitySaveOpen] = useState(false);

  const machines = data?.stockMachines || [];

  const stats = useMemo(() => {
    const totalCapacity = machines.reduce((sum, machine) => sum + machine.totalCapacity, 0);
    const totalAvailable = machines.reduce((sum, machine) => sum + machine.totalAvailable, 0);
    return {
      all: machines.length,
      empty: machines.filter((machine) => machine.urgency === 'empty').length,
      critical: machines.filter((machine) => machine.urgency === 'critical').length,
      normal: machines.filter((machine) => machine.urgency === 'normal' || machine.urgency === 'unknown').length,
      ok: machines.filter((machine) => machine.urgency === 'ok').length,
      totalToReplenish: machines.reduce((sum, machine) => sum + machine.totalToReplenish, 0),
      fillRate: totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 100) : 0,
    };
  }, [machines]);

  const filteredMachines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleMachines = machines.filter((machine) => {
      const matchesTab =
        activeTab === 'all'
        || machine.urgency === activeTab
        || (activeTab === 'normal' && machine.urgency === 'unknown');

      const matchesQuery = !q
        || machine.label.toLowerCase().includes(q)
        || machine.location?.toLowerCase().includes(q)
        || machine.clientName?.toLowerCase().includes(q)
        || machine.machineNumber?.toLowerCase().includes(q)
        || String(machine.machineId).includes(q)
        || machine.products.some((product) => (
          product.productName.toLowerCase().includes(q)
          || product.category?.toLowerCase().includes(q)
          || product.line.includes(q)
          || product.mdbCode?.toLowerCase().includes(q)
        ));

      return matchesTab && matchesQuery;
    });

    if (activeTab !== 'all') return visibleMachines;

    const allTabOrder: Record<StockMachine['urgency'], number> = {
      critical: 0,
      normal: 1,
      unknown: 2,
      ok: 3,
      empty: 4,
    };

    return [...visibleMachines].sort((a, b) => {
      const urgencyDiff = allTabOrder[a.urgency] - allTabOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      if (b.totalToReplenish !== a.totalToReplenish) return b.totalToReplenish - a.totalToReplenish;
      return a.label.localeCompare(b.label);
    });
  }, [activeTab, machines, query]);

  async function loadStock() {
    try {
      setError(null);
      if (!data) setLoading(true);
      setRefreshing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
      }

      const response = await fetch(`/api/stock?provider=${telemetryProvider}`, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(response.status, payload.error));
      }

      setData(payload);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Error desconocido consultando ${telemetryProvider === 'televend' ? 'Televend' : 'Frekuent'}`;
      setError(message);
      toast.error('Error consultando Stock', { description: message });
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setData(null);
    setError(null);
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetryProvider]);

  function changeTelemetryProvider(value: string) {
    if (!value) return;
    const nextProvider = value as TelemetryProvider;
    if (nextProvider === telemetryProvider) return;
    setLoading(true);
    setData(null);
    setError(null);
    setTelemetryProvider(nextProvider);
    setActiveTab('all');
    setExpandedMachineIds(new Set());
  }

  function toggleExpanded(machineId: number) {
    setExpandedMachineIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  }

  function getTabCount(tab: TabKey) {
    if (tab === 'all') return stats.all;
    if (tab === 'empty') return stats.empty;
    if (tab === 'critical') return stats.critical;
    if (tab === 'normal') return stats.normal;
    return stats.ok;
  }

  async function getSessionAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    }

    return sessionData.session.access_token;
  }

  async function loadProductOptions() {
    if (productOptions.length > 0 || loadingProductOptions) return;

    try {
      setLoadingProductOptions(true);
      const accessToken = await getSessionAccessToken();
      const response = await fetch('/api/stock/replenishment?resource=products', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron cargar los productos.');
      }

      setProductOptions(Array.isArray(payload.products) ? payload.products : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando productos';
      toast.error('No se pudo cargar el catálogo de productos', { description: message });
    } finally {
      setLoadingProductOptions(false);
    }
  }

  function openRailEditor(machine: StockMachine) {
    setRailEditor({
      machine,
      rows: createRailEditRows(machine),
    });
    loadProductOptions();
  }

  function openQuantityEditor(machine: StockMachine) {
    const rows = sortedProducts(machine.products)
      .map((product, index) => {
        const columnId = Number(product.railId);
        if (!Number.isInteger(columnId) || columnId <= 0) return null;
        return {
          key: `${columnId}-${product.line || index}`,
          columnId,
          line: product.line || String(index + 1),
          productName: product.productName,
          category: product.category,
          quantity: String(product.quantity),
          capacity: product.capacity,
          stockLabel: product.stockLabel,
        };
      })
      .filter(Boolean) as QuantityEditRow[];

    if (rows.length === 0) {
      toast.error('No se puede editar esta máquina', {
        description: 'Televend no ha devuelto identificadores de columna para guardar cantidades.',
      });
      return;
    }

    setQuantityEditor({ machine, rows });
  }

  function updateQuantityRow(key: string, quantity: string) {
    setQuantityEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => (row.key === key ? { ...row, quantity } : row)),
      };
    });
  }

  function updateRailRow(key: string, patch: Partial<RailEditRow>) {
    setRailEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      };
    });
  }

  function updateRailProduct(key: string, productId: string) {
    const selected = productOptions.find((product) => String(product.id) === productId);
    updateRailRow(key, {
      productId,
      productName: selected?.name || '',
      category: selected?.category,
    });
  }

  function addRailRow() {
    setRailEditor((current) => {
      if (!current) return current;
      const activeRows = current.rows.filter((row) => !row.deleted);
      const nextNumber = activeRows.reduce((max, row) => Math.max(max, Number(row.number) || 0), 0) + 1;
      return {
        ...current,
        rows: [
          ...current.rows,
          {
            key: `new-${Date.now()}`,
            number: String(nextNumber),
            mdbCode: '',
            productId: '',
            productName: '',
            price: '0,00',
            quantity: '0',
            capacity: '0',
            min: '0',
          },
        ],
      };
    });
  }

  function removeRailRow(key: string) {
    setRailEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => (row.key === key ? { ...row, deleted: true } : row)),
      };
    });
  }

  function restoreRailRow(key: string) {
    updateRailRow(key, { deleted: false });
  }

  function getActiveRailRows() {
    return railEditor?.rows.filter((row) => !row.deleted) || [];
  }

  function buildRailPayload() {
    const rows = getActiveRailRows();
    const usedNumbers = new Set<number>();

    if (rows.length === 0) {
      throw new Error('El planograma debe tener al menos un raíl.');
    }

    return rows.map((row) => {
      const number = parsePositiveInteger(row.number);
      const numberMdb = row.mdbCode.trim() ? parsePositiveInteger(row.mdbCode) : null;
      const productId = parsePositiveInteger(row.productId);
      const quantity = parsePositiveInteger(row.quantity);
      const capacity = parsePositiveInteger(row.capacity);
      const min = parsePositiveInteger(row.min);
      const price = parseEuroToCents(row.price);

      if (!Number.isInteger(number) || number <= 0) throw new Error('Hay un número de raíl no válido.');
      if (usedNumbers.has(number)) throw new Error(`El raíl ${number} está duplicado.`);
      usedNumbers.add(number);
      if (numberMdb !== null && (!Number.isInteger(numberMdb) || numberMdb <= 0)) throw new Error(`El MDB del raíl ${number} no es válido.`);
      if (!Number.isInteger(productId) || productId <= 0) throw new Error(`Selecciona producto en el raíl ${number}.`);
      if (!Number.isInteger(quantity) || !Number.isInteger(capacity) || quantity < 0 || capacity < 0) throw new Error(`Cantidad/capacidad no válida en el raíl ${number}.`);
      if (quantity > capacity) throw new Error(`El raíl ${number} tiene cantidad mayor que capacidad.`);
      if (!Number.isInteger(min) || min < 0) throw new Error(`Mínimo no válido en el raíl ${number}.`);
      if (!Number.isInteger(price) || price < 0) throw new Error(`Precio no válido en el raíl ${number}.`);

      return {
        rail: row.railId || null,
        number,
        number_mdb: numberMdb,
        product_id: productId,
        quantity,
        capacity,
        price,
        min,
      };
    });
  }

  async function saveRailEditor() {
    if (!railEditor) return;

    let rows: ReturnType<typeof buildRailPayload>;
    try {
      rows = buildRailPayload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Revisa los datos del planograma.';
      toast.error('No se puede guardar el planograma', { description: message });
      setConfirmRailSaveOpen(false);
      return;
    }

    const toastId = toast.loading('Guardando planograma en Frekuent...', {
      description: `${railEditor.machine.label} · ${rows.length} raíles`,
    });

    try {
      setSavingRails(true);
      const accessToken = await getSessionAccessToken();
      const response = await fetch('/api/stock/replenishment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-rails',
          machineId: railEditor.machine.machineId,
          rows,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Frekuent no pudo guardar el planograma.');
      }

      toast.success('Planograma guardado y sincronizado', {
        id: toastId,
        description: `${railEditor.machine.label} se ha actualizado correctamente.`,
      });
      setConfirmRailSaveOpen(false);
      setRailEditor(null);
      const refreshed = await loadStock();
      if (!refreshed) {
        toast.warning('Guardado correcto, pero no se pudo refrescar la vista', {
          description: 'Pulsa “Actualizar stock” para volver a consultar Frekuent.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando planograma';
      toast.error('No se pudo guardar el planograma', {
        id: toastId,
        description: `${railEditor.machine.label} · ${message}`,
      });
    } finally {
      setSavingRails(false);
    }
  }

  function buildQuantityPayload() {
    if (!quantityEditor) return [];

    return quantityEditor.rows.map((row) => {
      const quantity = parsePositiveInteger(row.quantity);
      if (!Number.isInteger(quantity)) {
        throw new Error(`La cantidad de la columna ${row.line} no es válida.`);
      }
      if (row.capacity > 0 && quantity > row.capacity) {
        throw new Error(`La columna ${row.line} tiene más cantidad que capacidad.`);
      }

      return {
        columnId: row.columnId,
        quantity,
      };
    });
  }

  async function saveQuantityEditor() {
    if (!quantityEditor) return;

    let rows: ReturnType<typeof buildQuantityPayload>;
    try {
      rows = buildQuantityPayload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Revisa las cantidades.';
      toast.error('No se pueden guardar las cantidades', { description: message });
      setConfirmQuantitySaveOpen(false);
      return;
    }

    const toastId = toast.loading('Guardando cantidades en Televend...', {
      description: `${quantityEditor.machine.label} · ${rows.length} columnas`,
    });

    try {
      setSavingQuantities(true);
      const accessToken = await getSessionAccessToken();
      const response = await fetch('/api/stock/replenishment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'televend',
          action: 'update-quantities',
          machineId: quantityEditor.machine.machineId,
          rows,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Televend no pudo guardar las cantidades.');
      }

      toast.success('Cantidades guardadas en Televend', {
        id: toastId,
        description: `${quantityEditor.machine.label} se ha actualizado correctamente.`,
      });
      setConfirmQuantitySaveOpen(false);
      setQuantityEditor(null);
      const refreshed = await loadStock();
      if (!refreshed) {
        toast.warning('Guardado correcto, pero no se pudo refrescar la vista', {
          description: 'Pulsa “Actualizar stock” para volver a consultar Televend.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error guardando cantidades';
      toast.error('No se pudieron guardar las cantidades', {
        id: toastId,
        description: `${quantityEditor.machine.label} · ${message}`,
      });
    } finally {
      setSavingQuantities(false);
    }
  }

  async function confirmReplenishmentAction() {
    if (!pendingReplenishmentAction) return;

    const { action, machine } = pendingReplenishmentAction;
    const providerLabel = telemetryProvider === 'televend' ? 'Televend' : 'Frekuent';

    const toastId = toast.loading(`Enviando reposición a ${providerLabel}...`, {
      description: `${machine.label} · marcando llenado completo`,
    });

    try {
      setRunningReplenishmentAction(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
      }

      const response = await fetch('/api/stock/replenishment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: telemetryProvider,
          action: 'full-refill',
          machineId: machine.machineId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `${providerLabel} no pudo completar la reposición.`);
      }

      toast.success('Reposición registrada correctamente', {
        id: toastId,
        description: `${machine.label} se ha marcado como llena. Actualizando la vista...`,
      });
      setPendingReplenishmentAction(null);
      const refreshed = await loadStock();
      if (refreshed) {
        toast.success('Stock actualizado', {
          description: 'La pantalla ya muestra la última lectura disponible.',
        });
      } else {
        toast.warning('Reposición registrada, pero no se pudo refrescar la vista', {
          description: `Pulsa “Actualizar stock” para volver a consultar ${providerLabel}.`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error actualizando reposición';
      toast.error('No se pudo completar la reposición', {
        id: toastId,
        description: `${machine.label} · ${message}`,
        action: {
          label: 'Reintentar',
          onClick: () => setPendingReplenishmentAction({ action: 'full-refill', machine }),
        },
      });
    } finally {
      setRunningReplenishmentAction(false);
    }
  }

  if (loading) {
    return <StockPageSkeleton />;
  }

  return (
    <div className="w-full max-w-[100dvw] space-y-4 overflow-x-hidden px-3 pb-4 sm:space-y-6 sm:px-0 sm:pb-0 [&_*]:min-w-0">
      <div className="w-full max-w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:bg-gradient-to-br sm:from-white sm:via-emerald-50/40 sm:to-blue-50/30 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <div className="hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-3 text-white shadow-lg sm:block">
                <PackageSearch className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl">
                    Stock {telemetryProvider === 'frekuent' ? 'Frekuent' : 'Televend'}
                  </h1>
                  <Badge
                    className={
                      telemetryProvider === 'frekuent'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }
                  >
                    Conectado
                  </Badge>
                </div>
                <p className="break-words text-sm font-semibold text-zinc-700">
                  Vista de reposición por máquina y producto
                </p>
              </div>
            </div>
            {data?.requestedAt && (
              <p className="break-words text-xs font-medium text-emerald-700 sm:ml-14">
                <Clock className="mr-1 inline h-3 w-3" />
                Última consulta: {formatDate(data.requestedAt)}
              </p>
            )}
          </div>

          <div className="flex w-full max-w-full flex-col gap-3 md:w-auto md:min-w-[360px]">
            <div>
              <p className="mb-1 text-xs font-black uppercase text-zinc-500">Fuente de telemetría</p>
              <ToggleGroup
                type="single"
                value={telemetryProvider}
                onValueChange={changeTelemetryProvider}
                className="grid w-full grid-cols-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"
              >
                {telemetryProviders.map((provider) => (
                  <ToggleGroupItem
                    key={provider.key}
                    value={provider.key}
                    aria-label={`Usar ${provider.label}`}
                    className="h-auto rounded-lg px-2 py-2 text-left data-[state=on]:bg-emerald-600 data-[state=on]:text-white"
                  >
                    <span className="block truncate text-sm font-black">{provider.label}</span>
                    <span className="block truncate text-[11px] font-semibold opacity-75">{provider.description}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {telemetryProvider === 'frekuent' ? (
              <Button
                onClick={loadStock}
                disabled={refreshing}
                className="h-12 w-full max-w-full rounded-xl bg-emerald-600 px-4 text-base font-bold text-white hover:bg-emerald-700"
              >
                <RefreshCw className={`mr-2 h-4 w-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="truncate">Actualizar stock</span>
              </Button>
            ) : (
              <Button
                onClick={loadStock}
                disabled={refreshing}
                className="h-12 w-full max-w-full rounded-xl bg-red-600 px-4 text-base font-bold text-white hover:bg-red-700"
              >
                <RefreshCw className={`mr-2 h-4 w-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="truncate">Actualizar stock</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-4 pt-6 text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">No se pudo actualizar el stock</p>
                <p className="mt-1 text-sm font-medium">{error}</p>
              </div>
            </div>
            <Button
              onClick={loadStock}
              disabled={refreshing}
              className="h-11 w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Reintentar consulta
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden border-zinc-200 bg-white py-0 shadow-sm sm:hidden">
        <CardContent className="px-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100">
            <div className="p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Máquinas</p>
              <p className="mt-2 break-all text-2xl font-black leading-none text-zinc-900">{stats.all}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">con planograma</p>
            </div>
            <div className="p-3">
              <p className="text-xs font-black uppercase text-zinc-500">A reponer</p>
              <p className="mt-2 break-all text-2xl font-black leading-none text-emerald-600">{stats.totalToReplenish}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">unidades</p>
            </div>
            <div className="p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Prioridad</p>
              <p className="mt-2 break-all text-2xl font-black leading-none text-red-600">{stats.empty + stats.critical}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">vacías + críticas</p>
            </div>
            <div className="p-3">
              <p className="text-xs font-black uppercase text-zinc-500">Llenado</p>
              <p className="mt-2 break-all text-2xl font-black leading-none text-zinc-900">{stats.fillRate}%</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">global</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden w-full max-w-full grid-cols-2 gap-2 sm:grid sm:gap-3 md:grid-cols-4">
        <Card className="min-w-0 border-zinc-200 bg-white shadow-sm">
          <CardHeader className="px-3 pb-1 pt-4 sm:px-6">
            <CardTitle className="text-[13px] font-bold text-zinc-600">Máquinas</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-3 pb-4 sm:px-6">
            <div className="break-all text-[clamp(1.75rem,9vw,2.5rem)] font-black leading-none">{stats.all}</div>
            <p className="text-xs font-semibold text-zinc-500">con planograma</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-zinc-200 bg-white shadow-sm">
          <CardHeader className="px-3 pb-1 pt-4 sm:px-6">
            <CardTitle className="text-[13px] font-bold text-zinc-600">A reponer</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-3 pb-4 sm:px-6">
            <div className="break-all text-[clamp(1.75rem,9vw,2.5rem)] font-black leading-none text-emerald-600">{stats.totalToReplenish}</div>
            <p className="text-xs font-semibold text-zinc-500">unidades</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-zinc-200 bg-white shadow-sm">
          <CardHeader className="px-3 pb-1 pt-4 sm:px-6">
            <CardTitle className="text-[13px] font-bold text-zinc-600">Alta prioridad</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-3 pb-4 sm:px-6">
            <div className="break-all text-[clamp(1.75rem,9vw,2.5rem)] font-black leading-none text-red-600">{stats.empty + stats.critical}</div>
            <p className="text-xs font-semibold text-zinc-500">vacías + críticas</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-zinc-200 bg-white shadow-sm">
          <CardHeader className="px-3 pb-1 pt-4 sm:px-6">
            <CardTitle className="text-[13px] font-bold text-zinc-600">Llenado</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 px-3 pb-4 sm:px-6">
            <div className="break-all text-[clamp(1.75rem,9vw,2.5rem)] font-black leading-none">{stats.fillRate}%</div>
            <p className="text-xs font-semibold text-zinc-500">global</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:hidden">
            {tabOptions.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={`h-16 min-w-0 justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-left text-zinc-900 shadow-sm transition-all data-[state=active]:shadow-lg ${tab.key === 'all' ? 'col-span-2' : ''} ${mobileTabClassName(tab.key)}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tab.dotClassName}`} />
                  <span className="truncate text-sm font-black">{tab.label}</span>
                </span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-black text-zinc-900 shadow-sm">
                  {getTabCount(tab.key)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsList className="hidden h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:flex lg:w-auto">
            {tabOptions.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="h-12 min-w-0 justify-between gap-2 rounded-xl px-3 text-left text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:h-14 sm:min-w-[112px] sm:shrink-0"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${tab.dotClassName}`} />
                  {tab.label}
                </span>
                <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-black text-zinc-800">
                  {getTabCount(tab.key)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative w-full flex-1 lg:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar máquina, ID o producto..."
              className="h-12 w-full max-w-full rounded-xl border-emerald-200 pl-9 text-base focus:border-emerald-400"
            />
          </div>
        </div>

        {(['all', 'empty', 'critical', 'normal', 'ok'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {refreshing && data && (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, index) => <MachineCardSkeleton key={index} />)}
              </div>
            )}

            {!refreshing && filteredMachines.length === 0 && (
              <Card className="bg-white">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <PackageSearch className="mb-4 h-16 w-16 text-zinc-300" />
                  <h3 className="mb-2 text-lg font-semibold">No hay máquinas en esta vista</h3>
                  <p className="text-center text-sm font-medium text-zinc-500">Prueba otra búsqueda o cambia de pestaña.</p>
                </CardContent>
              </Card>
            )}

            {!refreshing && filteredMachines.length > 0 && (
              <div className="space-y-3">
                {filteredMachines.map((machine) => {
                  const meta = urgencyMeta(machine.urgency);
                  const UrgencyIcon = meta.icon;
                  const isExpanded = expandedMachineIds.has(machine.machineId);
                  const allProducts = sortedProducts(machine.products);
                  const priorityProducts = allProducts.filter((product) => product.unitsToReplenish > 0);
                  const productsToShow = allProducts;
                  const subtitle = machineSubtitle(machine);

                  return (
                    <Card
                      key={machine.machineId}
                      className={`w-full max-w-full overflow-hidden border bg-white shadow-sm transition-all duration-200 ${meta.border}`}
                    >
                      <div className="flex w-full min-w-0 items-stretch gap-2 p-3 text-left sm:gap-3 sm:p-5">
                        <div className={`w-1.5 shrink-0 self-stretch rounded-full ${meta.bar}`} />
                        <div className="min-w-0 flex-1 space-y-3 overflow-hidden">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={meta.badge}>
                                  <UrgencyIcon className="mr-1 h-3 w-3" />
                                  {meta.label}
                                </Badge>
                                {machine.outOfStockCount > 0 && (
                                  <Badge className="border-red-500 bg-red-500 text-white">
                                    {machine.outOfStockCount} vacíos
                                  </Badge>
                                )}
                              </div>
                              <h3 className="mt-2 break-words text-lg font-black leading-tight text-zinc-900 sm:text-2xl">
                                {machine.label}
	                              </h3>
	                              <p className="mt-1 break-words text-sm font-semibold leading-snug text-zinc-600">
	                                {subtitle || `ID ${telemetryProvider === 'televend' ? 'Televend' : 'Frekuent'}: ${machine.machineId}`}
	                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                                <span className="break-all">ID {machine.machineId}</span>
                                {machine.serialNumber && <span className="break-all">Serie {machine.serialNumber}</span>}
                                {machine.machineStatus?.length ? (
                                  <span className="break-words">{machine.machineStatus.join(', ')}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                            <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-center sm:p-3">
                              <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">{machine.fillRate}%</div>
                              <div className="text-xs font-bold text-zinc-600">Lleno</div>
                            </div>
                            <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/80 p-2 text-center sm:p-3">
                              <div className="break-all text-xl font-black leading-none text-emerald-700 sm:text-2xl">{machine.totalToReplenish}</div>
                              <div className="text-xs font-bold text-zinc-600">Meter</div>
                            </div>
                            <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-center sm:p-3">
                              <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">{machine.totalAvailable}</div>
                              <div className="text-xs font-bold text-zinc-600">Actual</div>
                            </div>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${meta.bar}`}
                              style={{ width: `${Math.max(0, Math.min(100, machine.fillRate))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 px-3 pb-3 sm:px-5 sm:pb-5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 w-full justify-between rounded-xl border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 hover:bg-zinc-50 sm:h-12 sm:px-4 sm:text-base"
                            >
                              <span className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
                                Reposición
                              </span>
                              <MoreVertical className="h-4 w-4 text-zinc-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-[22rem] rounded-xl p-2">
                            <DropdownMenuLabel className="truncate px-3 py-2 text-xs font-black uppercase text-zinc-500">
                              {machine.label}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
	                            <DropdownMenuItem
	                              className="min-h-12 cursor-pointer rounded-lg px-3 py-3 text-sm font-bold"
	                              onSelect={() => {
	                                setPendingReplenishmentAction({ action: 'full-refill', machine });
	                              }}
	                            >
	                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
	                              <span className="min-w-0 flex-1">Llenado completo</span>
	                            </DropdownMenuItem>
	                            <DropdownMenuItem
	                              className="min-h-12 cursor-pointer rounded-lg px-3 py-3 text-sm font-bold"
	                              onSelect={() => {
	                                if (telemetryProvider === 'televend') {
	                                  openQuantityEditor(machine);
	                                  return;
	                                }
	                                openRailEditor(machine);
	                              }}
	                            >
	                              <SlidersHorizontal className="h-4 w-4 text-zinc-700" />
	                              <span className="min-w-0 flex-1">{telemetryProvider === 'televend' ? 'Editar columnas' : 'Editar raíles'}</span>
	                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          type="button"
                          variant={isExpanded ? 'default' : 'outline'}
                          onClick={() => toggleExpanded(machine.machineId)}
                          aria-expanded={isExpanded}
                          className={`h-11 w-full justify-between rounded-xl px-3 text-sm font-black sm:h-12 sm:px-4 sm:text-base ${
                            isExpanded
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                          }`}
                        >
                          <span className="truncate">{isExpanded ? 'Ocultar' : 'Ver productos'}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50 p-3 sm:p-5">
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <h4 className="text-lg font-black text-zinc-900">Productos</h4>
                              <p className="break-words text-sm font-semibold text-zinc-500">
                                {priorityProducts.length} a reponer de {machine.totalProducts} productos
                              </p>
                            </div>
                          </div>

                          {productsToShow.length === 0 ? (
                            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
                              <p className="font-black text-green-900">Sin productos</p>
                              <p className="mt-1 text-sm font-semibold text-green-800">No hay planograma disponible para esta máquina.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {productsToShow.map((product, index) => {
                                const status = productStatus(product);
                                const fillRate = productFillRate(product);
                                const price = formatPrice(product.price);

                                return (
                                  <div
                                    key={`${machine.machineId}-${product.line}-${index}`}
                                    className="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4"
                                  >
                                    <div className="flex min-w-0 gap-3">
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 sm:h-16 sm:w-16 sm:rounded-2xl">
                                        {product.image ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={product.image} alt={product.productName} className="h-full w-full object-contain p-1" />
                                        ) : (
                                          <span className="text-lg font-black text-zinc-900">{product.line || '-'}</span>
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                          <div className="min-w-0">
                                            <p className="break-words text-base font-black leading-tight text-zinc-900 sm:text-lg">
                                              {product.productName}
                                            </p>
                                            <p className="mt-1 break-words text-sm font-semibold text-zinc-500">
	                                              {telemetryProvider === 'televend' ? 'Col.' : 'Raíl'} {product.line || '-'}{product.mdbCode ? ` · MDB ${product.mdbCode}` : ''} · mínimo {product.min}
                                            </p>
                                          </div>
                                          <Badge className={`w-fit shrink-0 ${status.className}`}>{status.label}</Badge>
                                        </div>

                                        <div className="mt-2 flex max-w-full flex-wrap gap-2">
                                          {product.category && <Badge variant="outline" className="max-w-full truncate">{product.category}</Badge>}
                                          {price && <Badge variant="outline" className="shrink-0">{price}</Badge>}
                                          {product.status && <Badge variant="outline" className="max-w-full truncate">{product.status}</Badge>}
                                          {product.stockLabel && <Badge variant="outline" className="max-w-full truncate">{product.stockLabel}</Badge>}
                                        </div>

                                        <div className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                                          <div className="rounded-xl bg-zinc-50 p-2 text-center sm:p-3">
                                            <div className="text-xs font-bold text-zinc-500">Actual</div>
                                            <div className="text-xl font-black text-zinc-900 sm:text-2xl">{product.quantity}</div>
                                          </div>
                                          <div className="rounded-xl bg-zinc-50 p-2 text-center sm:p-3">
                                            <div className="text-xs font-bold text-zinc-500">Cap.</div>
                                            <div className="text-xl font-black text-zinc-900 sm:text-2xl">{product.capacity}</div>
                                          </div>
                                          <div className="rounded-xl bg-emerald-50 p-2 text-center sm:p-3">
                                            <div className="text-xs font-bold text-emerald-700">Meter</div>
                                            <div className="text-xl font-black text-emerald-700 sm:text-2xl">+{product.unitsToReplenish}</div>
                                          </div>
                                        </div>

                                        <div className="mt-3">
                                          <div className="mb-1 flex items-center justify-between text-sm font-bold text-zinc-500">
                                            <span>Llenado del raíl</span>
                                            <span>{fillRate}%</span>
                                          </div>
                                          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                                            <div
                                              className={`h-full rounded-full ${fillRate < 65 ? 'bg-red-600' : fillRate < 75 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                              style={{ width: `${Math.max(0, Math.min(100, fillRate))}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
	      </Tabs>

      <Dialog
        open={Boolean(quantityEditor)}
        onOpenChange={(open) => {
          if (!open && !savingQuantities) {
            setConfirmQuantitySaveOpen(false);
            setQuantityEditor(null);
          }
        }}
      >
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-w-3xl sm:rounded-2xl">
          {quantityEditor && (
            <>
              <DialogHeader className="border-b bg-white p-4 pr-12 text-left sm:p-6 sm:pr-14">
                <DialogTitle className="text-xl font-black leading-tight text-zinc-900 sm:text-2xl">
                  Editar cantidades
                </DialogTitle>
                <DialogDescription className="break-words text-sm font-semibold text-zinc-600">
                  {quantityEditor.machine.label} · {quantityEditor.rows.length} columnas
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto bg-zinc-50 p-3 sm:p-5">
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">{quantityEditor.rows.length}</div>
                    <div className="text-xs font-bold text-zinc-500">Columnas</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">
                      {quantityEditor.rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}
                    </div>
                    <div className="text-xs font-bold text-zinc-500">Actual</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-emerald-700 sm:text-2xl">
                      {quantityEditor.rows.reduce((sum, row) => sum + Math.max(0, row.capacity - (Number(row.quantity) || 0)), 0)}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">Meter</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {quantityEditor.rows.map((row) => {
                    const currentQuantity = Number(row.quantity) || 0;
                    const fillRate = row.capacity > 0 ? Math.round((currentQuantity / row.capacity) * 100) : 0;

                    return (
                      <div key={row.key} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                        <div className="mb-3 min-w-0">
                          <p className="text-xs font-black uppercase text-zinc-500">Columna {row.line}</p>
                          <p className="break-words text-lg font-black leading-tight text-zinc-900">
                            {row.productName}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.category && <Badge variant="outline" className="max-w-full truncate">{row.category}</Badge>}
                            {row.stockLabel && <Badge variant="outline" className="max-w-full truncate">{row.stockLabel}</Badge>}
                            <Badge variant="outline" className="shrink-0">Cap. {row.capacity}</Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                          <label className="block rounded-2xl border border-emerald-300 bg-emerald-50 p-2 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]">
                            <span className="mb-1 flex items-center gap-1 text-xs font-black uppercase text-emerald-800">
                              <Zap className="h-3.5 w-3.5" />
                              Cantidad actual
                            </span>
                            <Input
                              inputMode="numeric"
                              value={row.quantity}
                              onChange={(event) => updateQuantityRow(row.key, event.target.value)}
                              disabled={savingQuantities}
                              className="h-14 rounded-xl border-emerald-300 bg-white text-center text-2xl font-black text-emerald-900 shadow-sm focus-visible:ring-emerald-500"
                            />
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={savingQuantities}
                            onClick={() => updateQuantityRow(row.key, String(row.capacity))}
                            className="h-12 shrink-0 rounded-xl px-3 font-black"
                          >
                            Llenar
                          </Button>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-sm font-bold text-zinc-500">
                            <span>Llenado</span>
                            <span>{Math.max(0, Math.min(100, fillRate))}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${fillRate < 65 ? 'bg-red-600' : fillRate < 75 ? 'bg-yellow-500' : 'bg-green-600'}`}
                              style={{ width: `${Math.max(0, Math.min(100, fillRate))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="grid grid-cols-2 gap-2 border-t bg-white p-3 sm:flex sm:flex-row sm:p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuantityEditor(null)}
                  disabled={savingQuantities}
                  className="h-12 rounded-xl font-black"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    try {
                      buildQuantityPayload();
                      setConfirmQuantitySaveOpen(true);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Revisa las cantidades.';
                      toast.error('No se pueden guardar las cantidades', { description: message });
                    }
                  }}
                  disabled={savingQuantities}
                  className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmQuantitySaveOpen}
        onOpenChange={(open) => {
          if (!open && !savingQuantities) setConfirmQuantitySaveOpen(false);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-zinc-900">
              Guardar cantidades
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm font-medium text-zinc-600">
                <p className="break-words">
                  Máquina: <span className="font-black text-zinc-900">{quantityEditor?.machine.label}</span>
                </p>
                <p>
                  Se enviarán {quantityEditor?.rows.length || 0} cantidades a Televend. Esta acción cambia el stock real de la máquina.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingQuantities} className="h-11 rounded-xl font-bold">
              Revisar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingQuantities}
              onClick={(event) => {
                event.preventDefault();
                saveQuantityEditor();
              }}
              className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
            >
              {savingQuantities && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

	      <Dialog
        open={Boolean(railEditor)}
        onOpenChange={(open) => {
          if (!open && !savingRails) {
            setConfirmRailSaveOpen(false);
            setRailEditor(null);
          }
        }}
      >
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl">
          {railEditor && (
            <>
              <DialogHeader className="border-b bg-white p-4 pr-12 text-left sm:p-6 sm:pr-14">
                <DialogTitle className="text-xl font-black leading-tight text-zinc-900 sm:text-2xl">
                  Editar raíles
                </DialogTitle>
                <DialogDescription className="break-words text-sm font-semibold text-zinc-600">
                  {railEditor.machine.label} · {getActiveRailRows().length} raíles activos
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto bg-zinc-50 p-3 sm:p-5">
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">{getActiveRailRows().length}</div>
                    <div className="text-xs font-bold text-zinc-500">Raíles</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-zinc-900 sm:text-2xl">
                      {getActiveRailRows().reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}
                    </div>
                    <div className="text-xs font-bold text-zinc-500">Actual</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-center sm:p-3">
                    <div className="break-all text-xl font-black leading-none text-emerald-700 sm:text-2xl">
                      {getActiveRailRows().reduce((sum, row) => sum + Math.max(0, (Number(row.capacity) || 0) - (Number(row.quantity) || 0)), 0)}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">Meter</div>
                  </div>
                </div>

                {loadingProductOptions && (
                  <div className="mb-4 rounded-2xl border border-emerald-100 bg-white p-4 text-sm font-bold text-emerald-700">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Cargando catálogo de Frekuent...
                  </div>
                )}

                <div className="space-y-3">
                  {railEditor.rows.map((row, index) => (
                    <div
                      key={row.key}
                      className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${row.deleted ? 'border-red-200 opacity-60' : 'border-zinc-200'}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-zinc-500">Raíl {index + 1}</p>
                          <p className="break-words text-lg font-black leading-tight text-zinc-900">
                            {row.productName || 'Producto sin seleccionar'}
                          </p>
                          {row.category && <p className="mt-1 text-sm font-semibold text-zinc-500">{row.category}</p>}
                        </div>
                        {row.deleted ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => restoreRailRow(row.key)}
                            className="h-10 shrink-0 rounded-xl font-bold"
                          >
                            Restaurar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeRailRow(row.key)}
                            className="h-10 shrink-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            aria-label="Eliminar raíl"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <fieldset disabled={row.deleted || savingRails} className="space-y-3 disabled:pointer-events-none">
                        <label className="block">
                          <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Producto</span>
                          <select
                            value={row.productId}
                            onChange={(event) => updateRailProduct(row.key, event.target.value)}
                            className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-bold text-zinc-900 outline-none focus:border-emerald-400"
                          >
                            <option value="">Seleccionar producto</option>
                            {productOptions.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}{product.category ? ` · ${product.category}` : ''}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Número</span>
                            <Input
                              inputMode="numeric"
                              value={row.number}
                              onChange={(event) => updateRailRow(row.key, { number: event.target.value })}
                              className="h-12 rounded-xl text-base font-bold"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">MDB</span>
                            <Input
                              inputMode="numeric"
                              value={row.mdbCode}
                              onChange={(event) => updateRailRow(row.key, { mdbCode: event.target.value })}
                              placeholder="-"
                              className="h-12 rounded-xl text-base font-bold"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Precio</span>
                            <Input
                              inputMode="decimal"
                              value={row.price}
                              onChange={(event) => updateRailRow(row.key, { price: event.target.value })}
                              className="h-12 rounded-xl text-base font-bold"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Mínimo</span>
                            <Input
                              inputMode="numeric"
                              value={row.min}
                              onChange={(event) => updateRailRow(row.key, { min: event.target.value })}
                              className="h-12 rounded-xl text-base font-bold"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="block rounded-2xl border border-emerald-300 bg-emerald-50 p-2 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]">
                            <span className="mb-1 flex items-center gap-1 text-xs font-black uppercase text-emerald-800">
                              <Zap className="h-3.5 w-3.5" />
                              Cantidad
                            </span>
                            <Input
                              inputMode="numeric"
                              value={row.quantity}
                              onChange={(event) => updateRailRow(row.key, { quantity: event.target.value })}
                              className="h-14 rounded-xl border-emerald-300 bg-white text-center text-2xl font-black text-emerald-900 shadow-sm focus-visible:ring-emerald-500"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Capacidad</span>
                            <Input
                              inputMode="numeric"
                              value={row.capacity}
                              onChange={(event) => updateRailRow(row.key, { capacity: event.target.value })}
                              className="h-12 rounded-xl text-base font-bold"
                            />
                          </label>
                        </div>
                      </fieldset>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="grid grid-cols-2 gap-2 border-t bg-white p-3 sm:flex sm:flex-row sm:p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRailRow}
                  disabled={savingRails}
                  className="h-12 rounded-xl font-black sm:mr-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRailEditor(null)}
                  disabled={savingRails}
                  className="h-12 rounded-xl font-black"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    try {
                      buildRailPayload();
                      setConfirmRailSaveOpen(true);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Revisa los datos del planograma.';
                      toast.error('No se puede guardar el planograma', { description: message });
                    }
                  }}
                  disabled={savingRails}
                  className="col-span-2 h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 sm:col-span-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmRailSaveOpen}
        onOpenChange={(open) => {
          if (!open && !savingRails) setConfirmRailSaveOpen(false);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-zinc-900">
              Guardar planograma
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm font-medium text-zinc-600">
                <p className="break-words">
                  Máquina: <span className="font-black text-zinc-900">{railEditor?.machine.label}</span>
                </p>
                <p>
                  Se enviarán {getActiveRailRows().length} raíles a Frekuent y se sincronizará el planograma.
                  Esta acción cambia el stock/configuración real de la máquina.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingRails} className="h-11 rounded-xl font-bold">
              Revisar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingRails}
              onClick={(event) => {
                event.preventDefault();
                saveRailEditor();
              }}
              className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
            >
              {savingRails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingReplenishmentAction)}
        onOpenChange={(open) => {
          if (!open && !runningReplenishmentAction) setPendingReplenishmentAction(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-zinc-900">
              Confirmar llenado completo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm font-medium text-zinc-600">
                <p className="break-words">
                  Máquina: <span className="font-black text-zinc-900">{pendingReplenishmentAction?.machine.label}</span>
                </p>
                <p>
                  Esta acción marcará la máquina como rellenada en {telemetryProvider === 'televend' ? 'Televend' : 'Frekuent'}.
                  Úsala solo después de haber repuesto físicamente la máquina.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runningReplenishmentAction} className="h-11 rounded-xl font-bold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={runningReplenishmentAction}
              onClick={(event) => {
                event.preventDefault();
                confirmReplenishmentAction();
              }}
              className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
            >
              {runningReplenishmentAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, marcar lleno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
