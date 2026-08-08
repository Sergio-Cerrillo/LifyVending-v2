'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
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
import { LoadingInline } from '@/components/ui/loading-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const tabOptions: Array<{ key: TabKey; label: string; dotClassName: string }> = [
  { key: 'all', label: 'Todas', dotClassName: 'bg-zinc-500' },
  { key: 'critical', label: 'Crítico', dotClassName: 'bg-red-600' },
  { key: 'normal', label: 'Normal', dotClassName: 'bg-yellow-500' },
  { key: 'ok', label: 'Bien', dotClassName: 'bg-green-600' },
  { key: 'empty', label: 'Vacías', dotClassName: 'bg-zinc-950' },
];

function getErrorMessage(status: number, fallback: string) {
  if (status === 401) return 'La sesión con Frekuent ha caducado o tu sesión de usuario no es válida.';
  if (status === 403) return 'No tienes permisos para consultar Stock o Frekuent ha denegado el acceso.';
  if (status === 429) return 'Frekuent está limitando las peticiones. Espera unos minutos antes de reintentar.';
  if (status >= 500) return fallback || 'Frekuent no está disponible temporalmente.';
  return fallback || 'No se pudo consultar Frekuent.';
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
      description: 'Reposición prioritaria',
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
      description: 'Revisar en ruta',
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
    description: 'Sin prioridad',
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StockLiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<number>>(new Set());
  const [onlyProductsToReplenish, setOnlyProductsToReplenish] = useState(true);
  const [pendingReplenishmentAction, setPendingReplenishmentAction] = useState<PendingReplenishmentAction | null>(null);
  const [runningReplenishmentAction, setRunningReplenishmentAction] = useState(false);
  const [railEditor, setRailEditor] = useState<RailEditorState | null>(null);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [loadingProductOptions, setLoadingProductOptions] = useState(false);
  const [savingRails, setSavingRails] = useState(false);
  const [confirmRailSaveOpen, setConfirmRailSaveOpen] = useState(false);

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

      const response = await fetch('/api/stock', {
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
      const message = err instanceof Error ? err.message : 'Error desconocido consultando Frekuent';
      setError(message);
      toast.error('Error consultando Stock', { description: message });
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.error('No se pudo cargar el catálogo de Frekuent', { description: message });
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

  async function confirmReplenishmentAction() {
    if (!pendingReplenishmentAction) return;

    const { action, machine } = pendingReplenishmentAction;

    const toastId = toast.loading('Enviando reposición a Frekuent...', {
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
          action: 'full-refill',
          machineId: machine.machineId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Frekuent no pudo completar la reposición.');
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
          description: 'Pulsa “Actualizar stock” para volver a consultar Frekuent.',
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
    return <LoadingInline message="Consultando stock en Frekuent..." />;
  }

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden px-3 pb-4 sm:space-y-6 sm:px-0 sm:pb-0">
      <div className="w-full max-w-full rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-blue-50/30 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-3 text-white shadow-lg">
                <PackageSearch className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl">Stock Frekuent</h1>
                <p className="text-sm font-semibold text-zinc-700">
                  Vista de reposición por máquina y producto
                </p>
              </div>
            </div>
            {data?.requestedAt && (
              <p className="text-xs font-medium text-emerald-700 sm:ml-14">
                <Clock className="mr-1 inline h-3 w-3" />
                Última consulta: {formatDate(data.requestedAt)}
              </p>
            )}
          </div>

          <Button
            onClick={loadStock}
            disabled={refreshing}
            className="h-12 w-full rounded-xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 md:w-auto"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar stock
          </Button>
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

      <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
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
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:flex sm:justify-start sm:overflow-x-auto lg:w-auto">
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

          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar máquina, ID o producto..."
              className="h-12 rounded-xl border-emerald-200 pl-9 text-base focus:border-emerald-400"
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
                  const productsToShow = onlyProductsToReplenish ? priorityProducts : allProducts;
                  const subtitle = machineSubtitle(machine);

                  return (
                    <Card
                      key={machine.machineId}
                      className={`w-full max-w-full overflow-hidden border bg-white shadow-sm transition-all duration-200 ${meta.border}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(machine.machineId)}
                        className="flex w-full min-w-0 items-stretch gap-2 p-3 text-left sm:gap-3 sm:p-5"
                        aria-expanded={isExpanded}
                      >
                        <div className={`w-1.5 shrink-0 self-stretch rounded-full ${meta.bar}`} />
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex min-w-0 items-start justify-between gap-3">
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
                                {subtitle || `ID Frekuent: ${machine.machineId}`}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                                <span>ID {machine.machineId}</span>
                                {machine.serialNumber && <span>Serie {machine.serialNumber}</span>}
                                {machine.machineStatus?.length ? <span>{machine.machineStatus.join(', ')}</span> : null}
                              </div>
                            </div>
                            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-900">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
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
                      </button>

                      <div className="border-t border-zinc-100 px-3 pb-3 sm:px-5 sm:pb-5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 w-full justify-between rounded-xl border-zinc-200 bg-white text-sm font-black text-zinc-900 hover:bg-zinc-50 sm:h-12 sm:text-base"
                            >
                              <span className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
                                Reposición
                              </span>
                              <MoreVertical className="h-4 w-4 text-zinc-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-xl p-2">
                            <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase text-zinc-500">
                              {machine.label}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="min-h-12 cursor-pointer rounded-lg px-3 py-3 text-sm font-bold"
                              onSelect={() => setPendingReplenishmentAction({ action: 'full-refill', machine })}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span className="min-w-0 flex-1">Llenado completo</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="min-h-12 cursor-pointer rounded-lg px-3 py-3 text-sm font-bold"
                              onSelect={() => openRailEditor(machine)}
                            >
                              <SlidersHorizontal className="h-4 w-4 text-zinc-700" />
                              <span className="min-w-0 flex-1">Editar raíles</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50 p-3 sm:p-5">
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h4 className="text-lg font-black text-zinc-900">Productos</h4>
                              <p className="text-sm font-semibold text-zinc-500">
                                {priorityProducts.length} a reponer de {machine.totalProducts} productos
                              </p>
                            </div>
                            <Button
                              variant={onlyProductsToReplenish ? 'default' : 'outline'}
                              onClick={() => setOnlyProductsToReplenish((value) => !value)}
                              className={`h-11 w-full rounded-xl text-sm font-black sm:w-auto ${onlyProductsToReplenish ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white'}`}
                            >
                              <Filter className="mr-2 h-4 w-4" />
                              {onlyProductsToReplenish ? 'Pendientes' : 'Todos'}
                            </Button>
                          </div>

                          {productsToShow.length === 0 ? (
                            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
                              <p className="font-black text-green-900">Sin productos pendientes</p>
                              <p className="mt-1 text-sm font-semibold text-green-800">Cambia a “Todos” para ver el planograma completo.</p>
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
                                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 sm:h-16 sm:w-16">
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
                                              Raíl {product.line || '-'}{product.mdbCode ? ` · MDB ${product.mdbCode}` : ''} · mínimo {product.min}
                                            </p>
                                          </div>
                                          <Badge className={`w-fit shrink-0 ${status.className}`}>{status.label}</Badge>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {product.category && <Badge variant="outline" className="max-w-full break-words">{product.category}</Badge>}
                                          {price && <Badge variant="outline">{price}</Badge>}
                                          {product.status && <Badge variant="outline">{product.status}</Badge>}
                                          {product.stockLabel && <Badge variant="outline">{product.stockLabel}</Badge>}
                                        </div>

                                        <div className="mt-3 grid grid-cols-3 gap-2">
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
                                              className={`h-full rounded-full ${fillRate === 0 ? 'bg-red-600' : fillRate < 30 ? 'bg-orange-500' : fillRate < 70 ? 'bg-yellow-500' : 'bg-green-600'}`}
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
                    Cargando catálogo de productos...
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
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase text-zinc-500">Cantidad</span>
                            <Input
                              inputMode="numeric"
                              value={row.quantity}
                              onChange={(event) => updateRailRow(row.key, { quantity: event.target.value })}
                              className="h-12 rounded-xl text-base font-bold"
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
                  Esta acción marcará la máquina como rellenada en Frekuent y sincronizará el planograma.
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
