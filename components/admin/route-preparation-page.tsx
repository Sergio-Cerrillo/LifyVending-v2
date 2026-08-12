'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ClipboardList,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Square,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TelemetryProvider = 'frekuent' | 'televend';

interface StockProduct {
  line: string;
  productName: string;
  category?: string;
  quantity: number;
  capacity: number;
  unitsToReplenish: number;
  min: number;
}

interface StockMachine {
  machineId: number;
  label: string;
  clientName?: string;
  location?: string;
  route?: string;
  products: StockProduct[];
  totalToReplenish: number;
  fillRate: number;
  urgency: 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';
}

interface StockLiveResponse {
  success: boolean;
  requestedAt: string;
  stockMachines: StockMachine[];
}

interface AggregatedProduct {
  key: string;
  productName: string;
  category?: string;
  totalUnits: number;
  machines: Array<{
    machineId: number;
    machineLabel: string;
    line: string;
    units: number;
    current: number;
    capacity: number;
  }>;
}

const providerOptions: Array<{ key: TelemetryProvider; label: string }> = [
  { key: 'frekuent', label: 'Frekuent' },
  { key: 'televend', label: 'Televend' },
];

function normalizeProductKey(product: StockProduct) {
  return product.productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function urgencyOrder(machine: StockMachine) {
  const weights = { critical: 0, normal: 1, ok: 2, unknown: 3, empty: 4 };
  return weights[machine.urgency] ?? 5;
}

function urgencyBadge(machine: StockMachine) {
  if (machine.urgency === 'empty') return 'bg-zinc-950 text-white';
  if (machine.urgency === 'critical') return 'bg-red-600 text-white';
  if (machine.urgency === 'normal') return 'bg-yellow-500 text-white';
  return 'bg-emerald-600 text-white';
}

function urgencyLabel(machine: StockMachine) {
  if (machine.urgency === 'empty') return 'Vacía';
  if (machine.urgency === 'critical') return 'Crítica';
  if (machine.urgency === 'normal') return 'Normal';
  if (machine.urgency === 'unknown') return 'Sin datos';
  return 'Bien';
}

function selectedAggregate(machines: StockMachine[], selectedIds: Set<number>) {
  const map = new Map<string, AggregatedProduct>();

  for (const machine of machines) {
    if (!selectedIds.has(machine.machineId)) continue;

    for (const product of machine.products) {
      if (product.unitsToReplenish <= 0) continue;

      const key = normalizeProductKey(product);
      const current = map.get(key) || {
        key,
        productName: product.productName,
        category: product.category,
        totalUnits: 0,
        machines: [],
      };

      current.totalUnits += product.unitsToReplenish;
      current.machines.push({
        machineId: machine.machineId,
        machineLabel: machine.label,
        line: product.line,
        units: product.unitsToReplenish,
        current: product.quantity,
        capacity: product.capacity,
      });
      map.set(key, current);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
    return a.productName.localeCompare(b.productName, 'es');
  });
}

function MachineSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <Skeleton key={item} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}

function LoadListContent({ products }: { products: AggregatedProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
        <PackageCheck className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <p className="font-black text-zinc-900">Sin productos</p>
        <p className="mt-1 text-sm font-semibold text-zinc-500">Selecciona máquinas con unidades pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <div key={product.key} className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-base font-black leading-tight text-zinc-900">{product.productName}</p>
              {product.category && <p className="mt-1 text-xs font-bold text-zinc-500">{product.category}</p>}
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
              <p className="text-2xl font-black leading-none text-emerald-700">{product.totalUnits}</p>
              <p className="text-[10px] font-black uppercase text-emerald-700">uds</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {product.machines.map((machine) => (
              <div key={`${product.key}-${machine.machineId}-${machine.line}`} className="rounded-xl bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-wide text-zinc-500">
                      {machine.machineLabel}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-zinc-900">
                      Rail {machine.line || '-'}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-emerald-200 bg-white text-emerald-700">
                    +{machine.units} uds
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoutePreparationPage() {
  const [provider, setProvider] = useState<TelemetryProvider>('frekuent');
  const [machines, setMachines] = useState<StockMachine[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [loadListOpen, setLoadListOpen] = useState(false);

  async function loadStock(showToast = false) {
    try {
      if (showToast) setRefreshing(true);
      if (!showToast) setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sesión expirada');

      const response = await fetch(`/api/stock?provider=${provider}`, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const payload = await response.json() as StockLiveResponse & { error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || 'No se pudo cargar stock');

      const sorted = [...payload.stockMachines].sort((a, b) => {
        const urgencyDiff = urgencyOrder(a) - urgencyOrder(b);
        if (urgencyDiff !== 0) return urgencyDiff;
        if (b.totalToReplenish !== a.totalToReplenish) return b.totalToReplenish - a.totalToReplenish;
        return a.label.localeCompare(b.label, 'es');
      });

      setMachines(sorted);
      setSelectedIds(new Set());
      setRequestedAt(payload.requestedAt);
      if (showToast) toast.success('Stock actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando stock';
      toast.error('No se pudo cargar Preparación Reparto', { description: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, [provider]);

  const filteredMachines = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((machine) => (
      machine.label.toLowerCase().includes(q)
      || machine.location?.toLowerCase().includes(q)
      || machine.clientName?.toLowerCase().includes(q)
      || machine.products.some((product) => product.productName.toLowerCase().includes(q))
    ));
  }, [machines, query]);

  const selectedMachines = useMemo(
    () => machines.filter((machine) => selectedIds.has(machine.machineId)),
    [machines, selectedIds],
  );
  const aggregatedProducts = useMemo(
    () => selectedAggregate(machines, selectedIds),
    [machines, selectedIds],
  );
  const totalUnits = aggregatedProducts.reduce((sum, product) => sum + product.totalUnits, 0);

  function toggleMachine(machineId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  }

  function selectVisibleCritical() {
    setSelectedIds(new Set(filteredMachines
      .filter((machine) => machine.totalToReplenish > 0)
      .map((machine) => machine.machineId)));
  }

  return (
    <div className="w-full max-w-[100dvw] space-y-4 overflow-x-hidden px-3 pb-28 sm:space-y-6 sm:px-0 sm:pb-0">
      <section className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:bg-gradient-to-br sm:from-white sm:via-emerald-50/40 sm:to-blue-50/30 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <div className="hidden rounded-2xl bg-emerald-600 p-3 text-white shadow-lg sm:block">
                <Truck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-black text-zinc-900 sm:text-3xl">Preparación Reparto</h1>
                <p className="break-words text-sm font-semibold text-zinc-600">
                  Selecciona máquinas y genera el total de producto a cargar.
                </p>
              </div>
            </div>
            {requestedAt && (
              <p className="text-xs font-bold text-emerald-700 sm:ml-16">
                Stock consultado: {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(requestedAt))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
            <ToggleGroup
              type="single"
              value={provider}
              onValueChange={(value) => value && setProvider(value as TelemetryProvider)}
              className="grid grid-cols-2 rounded-2xl bg-zinc-100 p-1"
            >
              {providerOptions.map((item) => (
                <ToggleGroupItem key={item.key} value={item.key} className="rounded-xl px-4 font-black data-[state=on]:bg-white data-[state=on]:text-emerald-700">
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button type="button" onClick={() => loadStock(true)} disabled={refreshing || loading} className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 sm:h-11">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="border-zinc-200 bg-white">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-black uppercase text-zinc-500">Máquinas</p>
            <p className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">{selectedMachines.length}</p>
            <p className="hidden text-sm font-semibold text-zinc-500 sm:block">seleccionadas</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/80">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-black uppercase text-emerald-700">Total a cargar</p>
            <p className="mt-2 text-2xl font-black text-emerald-700 sm:text-3xl">{totalUnits}</p>
            <p className="hidden text-sm font-semibold text-emerald-800 sm:block">unidades</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 bg-white">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-black uppercase text-zinc-500">Productos</p>
            <p className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">{aggregatedProducts.length}</p>
            <p className="hidden text-sm font-semibold text-zinc-500 sm:block">referencias</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardHeader className="space-y-3 p-3 sm:space-y-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-xl font-black text-zinc-900">Máquinas</CardTitle>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="button" variant="outline" className="h-11 rounded-xl px-2 text-xs font-black sm:px-4 sm:text-sm" onClick={selectVisibleCritical}>
                  Seleccionar con reposición
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-xl px-2 text-xs font-black sm:px-4 sm:text-sm" onClick={() => setSelectedIds(new Set())}>
                  Limpiar
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar máquina, ubicación o producto..."
                className="h-12 rounded-xl border-emerald-100 pl-10 text-base font-semibold focus-visible:ring-emerald-400"
              />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {loading ? (
              <MachineSkeleton />
            ) : filteredMachines.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 p-8 text-center text-sm font-semibold text-zinc-500">
                No hay máquinas para este filtro.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMachines.map((machine) => {
                  const selected = selectedIds.has(machine.machineId);
                  return (
                    <button
                      key={machine.machineId}
                      type="button"
                      onClick={() => toggleMachine(machine.machineId)}
                      className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition sm:p-4 ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-zinc-200 hover:border-emerald-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 shrink-0 text-emerald-600">
                          {selected ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className={urgencyBadge(machine)}>{urgencyLabel(machine)}</Badge>
                            <Badge variant="outline">{machine.fillRate}% lleno</Badge>
                          </div>
                          <h3 className="break-words text-lg font-black leading-tight text-zinc-900">{machine.label}</h3>
                          <p className="mt-1 break-words text-sm font-semibold text-zinc-500">{machine.location || machine.clientName || `ID ${machine.machineId}`}</p>
                          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                            <div className="rounded-xl bg-zinc-50 p-2 text-center">
                              <p className="text-xs font-black uppercase text-zinc-400">Meter</p>
                              <p className="text-xl font-black text-emerald-700">{machine.totalToReplenish}</p>
                            </div>
                            <div className="rounded-xl bg-zinc-50 p-2 text-center">
                              <p className="text-xs font-black uppercase text-zinc-400">Productos</p>
                              <p className="text-xl font-black text-zinc-900">{machine.products.length}</p>
                            </div>
                            <div className="rounded-xl bg-zinc-50 p-2 text-center">
                              <p className="text-xs font-black uppercase text-zinc-400">Ruta</p>
                              <p className="truncate text-sm font-black text-zinc-900">{machine.route || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="lista-carga" className="top-20 h-fit border-zinc-200 bg-white shadow-sm xl:sticky">
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-black text-zinc-900">Lista de carga</CardTitle>
                <p className="mt-1 text-sm font-semibold text-zinc-500">Producto agrupado por referencia</p>
              </div>
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <LoadListContent products={aggregatedProducts} />
          </CardContent>
        </Card>
      </section>

      {refreshing && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Actualizando stock
        </div>
      )}

      <Sheet open={loadListOpen} onOpenChange={setLoadListOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-3xl border-zinc-200 bg-white p-0 sm:hidden">
          <SheetHeader className="border-b border-zinc-100 p-4 pr-12 text-left">
            <SheetTitle className="text-xl font-black text-zinc-900">Lista de carga</SheetTitle>
            <SheetDescription className="font-semibold">
              {totalUnits} unidades · {aggregatedProducts.length} referencias
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[calc(86dvh-5rem)] overflow-y-auto p-3 pb-6">
            <LoadListContent products={aggregatedProducts} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white shadow-2xl sm:hidden">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{selectedMachines.length} máquinas · {totalUnits} uds</p>
            <p className="text-xs font-semibold text-zinc-300">{aggregatedProducts.length} referencias para cargar</p>
          </div>
          <button
            type="button"
            onClick={() => setLoadListOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white"
          >
            Ver lista
            <ClipboardList className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
