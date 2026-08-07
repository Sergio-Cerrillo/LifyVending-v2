'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  Package,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingCart,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingInline } from '@/components/ui/loading-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StockProduct {
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

interface StockMachine {
  machineId: number;
  label: string;
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
  if (product.capacity <= 0) return 0;
  return Math.round((product.quantity / product.capacity) * 100);
}

export function StockLivePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StockLiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedMachine, setSelectedMachine] = useState<StockMachine | null>(null);
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<number>>(new Set());
  const [onlyProductsToReplenish, setOnlyProductsToReplenish] = useState(true);
  const [detailProductQuery, setDetailProductQuery] = useState('');

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
        || String(machine.machineId).includes(q)
        || machine.products.some((product) => product.productName.toLowerCase().includes(q));

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

  const detailProducts = useMemo(() => {
    if (!selectedMachine) return [];
    const q = detailProductQuery.trim().toLowerCase();
    return sortedProducts(selectedMachine.products).filter((product) => {
      const matchesQuery = !q
        || product.productName.toLowerCase().includes(q)
        || product.category?.toLowerCase().includes(q)
        || product.line.includes(q);
      const matchesReplenish = !onlyProductsToReplenish || product.unitsToReplenish > 0;
      return matchesQuery && matchesReplenish;
    });
  }, [detailProductQuery, onlyProductsToReplenish, selectedMachine]);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido consultando Frekuent';
      setError(message);
      toast.error('Error consultando Stock', { description: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedMachine) {
      setDetailProductQuery('');
      setOnlyProductsToReplenish(true);
    }
  }, [selectedMachine]);

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

  if (loading) {
    return <LoadingInline message="Consultando stock en Frekuent..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 text-white shadow-lg sm:rounded-xl sm:p-3">
                <PackageSearch className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Stock Frekuent</h1>
                <p className="text-xs font-semibold text-zinc-700 sm:text-sm">
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
            className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 md:w-auto"
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Máquinas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.all}</div>
            <p className="text-xs font-medium text-zinc-500">con planograma</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">A reponer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.totalToReplenish}</div>
            <p className="text-xs font-medium text-zinc-500">unidades totales</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vacías + Críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.empty + stats.critical}</div>
            <p className="text-xs font-medium text-zinc-500">prioridad alta</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Llenado medio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fillRate}%</div>
            <p className="text-xs font-medium text-zinc-500">global</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl bg-zinc-100 p-1.5 lg:w-auto">
            {tabOptions.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="h-12 min-w-[96px] shrink-0 justify-between gap-2 rounded-lg px-3 text-left text-xs data-[state=active]:bg-white"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${tab.dotClassName}`} />
                  {tab.label}
                </span>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-bold text-zinc-800">
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
              className="border-emerald-200 pl-8 focus:border-emerald-400"
            />
          </div>
        </div>

        {(['all', 'empty', 'critical', 'normal', 'ok'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {refreshing && data && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMachines.map((machine) => {
                  const meta = urgencyMeta(machine.urgency);
                  const UrgencyIcon = meta.icon;
                  const isExpanded = expandedMachineIds.has(machine.machineId);
                  const priorityProducts = sortedProducts(machine.products).filter((product) => product.unitsToReplenish > 0);
                  const productsToShow = (isExpanded ? priorityProducts : priorityProducts.slice(0, 4));

                  return (
                    <Card
                      key={machine.machineId}
                      className={`flex flex-col border bg-white transition-all duration-200 hover:border-emerald-300 hover:shadow-md ${meta.border}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="space-y-3">
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
                          <div>
                            <CardTitle className="text-base leading-snug text-zinc-900">{machine.label}</CardTitle>
                            <CardDescription>ID Frekuent: {machine.machineId}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="flex flex-1 flex-col space-y-4">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-600">Llenado</span>
                            <span className="font-bold text-zinc-900">{machine.fillRate}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${meta.bar}`}
                              style={{ width: `${Math.max(0, Math.min(100, machine.fillRate))}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2 text-center">
                            <div className="text-lg font-bold text-emerald-700">{machine.totalToReplenish}</div>
                            <div className="text-[11px] font-semibold text-zinc-600">Reponer</div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-center">
                            <div className="text-lg font-bold text-zinc-900">{machine.totalAvailable}</div>
                            <div className="text-[11px] font-semibold text-zinc-600">Actual</div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-center">
                            <div className="text-lg font-bold text-zinc-900">{machine.totalCapacity}</div>
                            <div className="text-[11px] font-semibold text-zinc-600">Capacidad</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-zinc-900">Qué reponer</h4>
                            <Badge variant="outline">{priorityProducts.length}</Badge>
                          </div>
                          {priorityProducts.length === 0 ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
                              No hay productos pendientes de reposición.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {productsToShow.map((product, index) => {
                                const status = productStatus(product);
                                return (
                                  <div key={`${machine.machineId}-${product.line}-${index}`} className="rounded-lg border border-zinc-200 p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="line-clamp-1 text-sm font-semibold text-zinc-900">{product.productName}</p>
                                        <p className="text-xs text-zinc-500">Raíl {product.line || '-'} · mínimo {product.min}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-emerald-700">{product.quantity}/{product.capacity}</p>
                                        <p className="text-xs font-semibold text-red-600">+{product.unitsToReplenish}</p>
                                      </div>
                                    </div>
                                    <Badge className={`mt-2 text-[11px] ${status.className}`}>{status.label}</Badge>
                                  </div>
                                );
                              })}
                              {priorityProducts.length > 4 && (
                                <Button variant="ghost" size="sm" onClick={() => toggleExpanded(machine.machineId)} className="w-full">
                                  {isExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                                  {isExpanded ? 'Ver menos' : `Ver ${priorityProducts.length - 4} más`}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-auto border-t pt-3">
                          <Button
                            size="lg"
                            onClick={() => setSelectedMachine(machine)}
                            className="h-12 w-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Revisar productos
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={Boolean(selectedMachine)} onOpenChange={(open) => !open && setSelectedMachine(null)}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-full translate-y-[-50%] overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl lg:max-w-5xl">
          {selectedMachine && (
            <div className="flex h-full max-h-[100dvh] flex-col sm:max-h-[90vh]">
              <DialogHeader className="border-b bg-white p-4 pr-12 text-left sm:p-6 sm:pr-14">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <DialogTitle className="text-xl leading-tight sm:text-2xl">{selectedMachine.label}</DialogTitle>
                    <DialogDescription className="mt-1 text-sm">
                      {selectedMachine.totalAvailable}/{selectedMachine.totalCapacity} unidades · {selectedMachine.fillRate}% lleno · {selectedMachine.totalToReplenish} a reponer
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={urgencyMeta(selectedMachine.urgency).badge}>{urgencyMeta(selectedMachine.urgency).label}</Badge>
                    <Badge variant="outline">{selectedMachine.totalProducts} productos</Badge>
                    <Badge variant="outline">{selectedMachine.outOfStockCount} vacíos</Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 overflow-auto bg-zinc-50 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-lg border bg-emerald-50 p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <ShoppingCart className="h-4 w-4" />
                      A reponer
                    </div>
                    <div className="mt-1 text-2xl font-bold text-emerald-700">{selectedMachine.totalToReplenish}</div>
                  </div>
                  <div className="rounded-lg border bg-white p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <Package className="h-4 w-4" />
                      Actual
                    </div>
                    <div className="mt-1 text-2xl font-bold">{selectedMachine.totalAvailable}</div>
                  </div>
                  <div className="rounded-lg border bg-white p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <PackageCheck className="h-4 w-4" />
                      Capacidad
                    </div>
                    <div className="mt-1 text-2xl font-bold">{selectedMachine.totalCapacity}</div>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      Bajo/vacío
                    </div>
                    <div className="mt-1 text-2xl font-bold text-red-700">
                      {selectedMachine.lowStockCount + selectedMachine.outOfStockCount}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-500" />
                    <Input
                      value={detailProductQuery}
                      onChange={(event) => setDetailProductQuery(event.target.value)}
                      placeholder="Buscar producto o raíl..."
                      className="pl-8"
                    />
                  </div>
                  <Button
                    variant={onlyProductsToReplenish ? 'default' : 'outline'}
                    onClick={() => setOnlyProductsToReplenish((value) => !value)}
                    className={`h-11 w-full md:w-auto ${onlyProductsToReplenish ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white'}`}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Solo a reponer
                  </Button>
                </div>

                {detailProducts.length === 0 ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
                    <p className="font-semibold text-green-900">No hay productos en esta vista</p>
                    <p className="mt-1 text-sm text-green-800">Quita el filtro o cambia la búsqueda para ver el planograma completo.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailProducts.map((product, index) => {
                        const status = productStatus(product);
                        const fillRate = productFillRate(product);
                        return (
                          <div key={`${product.line}-${product.productName}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-base font-bold text-white">
                                {product.line || '-'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-base font-bold leading-snug text-zinc-900">{product.productName}</p>
                                    <p className="mt-1 text-xs font-medium text-zinc-500">
                                      {product.category || 'Sin categoría'} · mínimo {product.min}
                                    </p>
                                  </div>
                                  <Badge className={`w-fit ${status.className}`}>{status.label}</Badge>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <div className="rounded-lg bg-zinc-50 p-2 text-center">
                                    <div className="text-xs font-semibold text-zinc-500">Actual</div>
                                    <div className="text-lg font-bold text-zinc-900">{product.quantity}</div>
                                  </div>
                                  <div className="rounded-lg bg-zinc-50 p-2 text-center">
                                    <div className="text-xs font-semibold text-zinc-500">Capacidad</div>
                                    <div className="text-lg font-bold text-zinc-900">{product.capacity}</div>
                                  </div>
                                  <div className="rounded-lg bg-emerald-50 p-2 text-center">
                                    <div className="text-xs font-semibold text-emerald-700">Meter</div>
                                    <div className="text-lg font-bold text-emerald-700">+{product.unitsToReplenish}</div>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-500">
                                    <span>Llenado del raíl</span>
                                    <span>{fillRate}%</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
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

              <div className="border-t bg-white p-3 sm:hidden">
                <DialogClose asChild>
                  <Button className="h-11 w-full bg-zinc-900 text-white hover:bg-zinc-800">Cerrar revisión</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
