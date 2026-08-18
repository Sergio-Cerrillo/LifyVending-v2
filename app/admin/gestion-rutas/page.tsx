'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Loader2, MapPin, MoreVertical, PackageCheck, Pencil, Plus, Route, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase-helpers';
import { fetchWithTimeout, withTimeout } from '@/lib/client-timeouts';
import { cn } from '@/lib/utils';

type Urgency = 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';
type RouteMachineStatus = 'pending' | 'done';

interface SelectableMachine {
  id: string;
  name: string;
  location: string | null;
  provider: 'frekuent' | 'televend';
  externalMachineId: number | null;
  fillRate: number | null;
  urgency: Urgency;
  totalToReplenish: number;
}

interface Replenisher {
  id: string;
  email: string;
  display_name: string | null;
}

interface RouteMachine {
  id: string;
  machineId: string;
  status: RouteMachineStatus;
  completedAt: string | null;
  machine: SelectableMachine;
}

interface ReplenishmentRoute {
  id: string;
  name: string;
  scheduledDate: string;
  status: 'planned' | 'in_progress' | 'completed';
  notes: string | null;
  replenisher: Replenisher | null;
  machines: RouteMachine[];
  totalMachines: number;
  doneMachines: number;
  pendingMachines: number;
}

function urgencyLabel(urgency: Urgency) {
  if (urgency === 'empty') return 'Vacía';
  if (urgency === 'critical') return 'Crítico';
  if (urgency === 'normal') return 'Normal';
  if (urgency === 'ok') return 'Bien';
  return 'Sin stock';
}

function urgencyClass(urgency: Urgency) {
  if (urgency === 'empty') return 'bg-black text-white';
  if (urgency === 'critical') return 'bg-red-600 text-white';
  if (urgency === 'normal') return 'bg-amber-500 text-white';
  if (urgency === 'ok') return 'bg-emerald-600 text-white';
  return 'bg-zinc-200 text-zinc-700';
}

function urgencySurfaceClass(urgency: Urgency, done = false) {
  if (done) return 'border-emerald-300 bg-emerald-50 shadow-[0_14px_34px_rgba(5,150,105,0.12)]';
  if (urgency === 'critical') return 'border-red-200 bg-red-50 shadow-[0_14px_34px_rgba(220,38,38,0.10)]';
  if (urgency === 'normal') return 'border-amber-200 bg-amber-50 shadow-[0_14px_34px_rgba(245,158,11,0.10)]';
  if (urgency === 'ok') return 'border-emerald-200 bg-emerald-50 shadow-[0_14px_34px_rgba(5,150,105,0.10)]';
  if (urgency === 'empty') return 'border-zinc-900 bg-zinc-950 text-white shadow-[0_14px_34px_rgba(0,0,0,0.18)]';
  return 'border-zinc-200 bg-zinc-50 shadow-sm';
}

function urgencyAccentClass(urgency: Urgency, done = false) {
  if (done) return 'bg-emerald-500';
  if (urgency === 'critical') return 'bg-red-500';
  if (urgency === 'normal') return 'bg-amber-500';
  if (urgency === 'ok') return 'bg-emerald-500';
  if (urgency === 'empty') return 'bg-black';
  return 'bg-zinc-300';
}

function urgencyTextClass(urgency: Urgency) {
  if (urgency === 'empty') return 'text-white';
  return 'text-zinc-950';
}

function urgencyMutedTextClass(urgency: Urgency) {
  if (urgency === 'empty') return 'text-zinc-300';
  if (urgency === 'critical') return 'text-red-900/70';
  if (urgency === 'normal') return 'text-amber-900/75';
  if (urgency === 'ok') return 'text-emerald-900/75';
  return 'text-zinc-500';
}

function urgencyMetricClass(urgency: Urgency) {
  if (urgency === 'empty') return 'bg-white/10 text-white ring-white/10';
  if (urgency === 'critical') return 'bg-white/70 text-red-950 ring-red-100';
  if (urgency === 'normal') return 'bg-white/70 text-amber-950 ring-amber-100';
  if (urgency === 'ok') return 'bg-white/70 text-emerald-950 ring-emerald-100';
  return 'bg-white text-zinc-700 ring-zinc-100';
}

function getUrgencySortValue(urgency: Urgency) {
  const urgencyOrder: Record<Urgency, number> = {
    critical: 0,
    normal: 1,
    ok: 2,
    unknown: 3,
    empty: 4,
  };
  return urgencyOrder[urgency];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export default function RouteManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'reponedor'>('reponedor');
  const [routes, setRoutes] = useState<ReplenishmentRoute[]>([]);
  const [replenishers, setReplenishers] = useState<Replenisher[]>([]);
  const [machines, setMachines] = useState<SelectableMachine[]>([]);
  const [search, setSearch] = useState('');
  const [editingRouteName, setEditingRouteName] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [newRoute, setNewRoute] = useState({
    name: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    replenisherId: '',
    machineIds: [] as string[],
  });

  async function getToken() {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      10_000,
      'No se pudo validar la sesión',
    );
    return data.session?.access_token || null;
  }

  async function loadRoutes() {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        toast.error('Sesión no disponible');
        return;
      }

      const response = await fetchWithTimeout('/api/admin/routes', {
        headers: { Authorization: `Bearer ${token}` },
      }, 30_000);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar rutas');

      setUserRole(data.userRole);
      setRoutes(data.routes || []);
      setReplenishers(data.replenishers || []);
      setMachines(data.machines || []);
    } catch (error: any) {
      console.error('[ROUTES-PAGE] Error:', error);
      toast.error('No se pudieron cargar las rutas', { description: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoutes();
  }, []);

  const filteredMachines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const ordered = [...machines].sort((a, b) => {
      return getUrgencySortValue(a.urgency) - getUrgencySortValue(b.urgency) || a.name.localeCompare(b.name);
    });

    if (!normalized) return ordered.slice(0, 80);
    return ordered.filter((machine) => {
      return `${machine.name} ${machine.location || ''} ${machine.provider}`.toLowerCase().includes(normalized);
    }).slice(0, 80);
  }, [machines, search]);

  const totals = useMemo(() => {
    const totalMachines = routes.reduce((sum, route) => sum + route.totalMachines, 0);
    const done = routes.reduce((sum, route) => sum + route.doneMachines, 0);
    return { totalMachines, done, pending: Math.max(totalMachines - done, 0) };
  }, [routes]);

  const orderedRoutes = useMemo(() => {
    return routes.map((route) => ({
      ...route,
      machines: [...route.machines].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return getUrgencySortValue(a.machine.urgency) - getUrgencySortValue(b.machine.urgency)
          || a.machine.name.localeCompare(b.machine.name);
      }),
    }));
  }, [routes]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return null;
    return orderedRoutes.find((route) => route.id === selectedRouteId) || null;
  }, [orderedRoutes, selectedRouteId]);

  function toggleMachine(machineId: string) {
    setNewRoute((current) => {
      const exists = current.machineIds.includes(machineId);
      return {
        ...current,
        machineIds: exists
          ? current.machineIds.filter((id) => id !== machineId)
          : [...current.machineIds, machineId],
      };
    });
  }

  async function createRoute() {
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) throw new Error('Sesión no disponible');

      const response = await fetchWithTimeout('/api/admin/routes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newRoute,
          name: newRoute.name.trim() || `Ruta (${formatDate(newRoute.scheduledDate)})`,
        }),
      }, 30_000);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la ruta');

      toast.success('Ruta creada', {
        description: 'Ya aparece en la lista del reponedor asignado',
      });
      setDialogOpen(false);
      setNewRoute({
        name: '',
        scheduledDate: new Date().toISOString().slice(0, 10),
        replenisherId: '',
        machineIds: [],
      });
      setEditingRouteName(false);
      await loadRoutes();
    } catch (error: any) {
      toast.error('No se pudo crear la ruta', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateMachineStatus(routeMachineId: string, status: RouteMachineStatus) {
    const previousRoutes = routes;
    setRoutes((currentRoutes) => currentRoutes.map((route) => {
      const machines = route.machines.map((machine) => (
        machine.id === routeMachineId ? { ...machine, status } : machine
      ));
      const doneMachines = machines.filter((machine) => machine.status === 'done').length;
      return {
        ...route,
        machines,
        doneMachines,
        pendingMachines: Math.max(machines.length - doneMachines, 0),
        status: doneMachines === machines.length ? 'completed' : doneMachines > 0 ? 'in_progress' : 'planned',
      };
    }));

    try {
      const token = await getToken();
      if (!token) throw new Error('Sesión no disponible');

      const response = await fetchWithTimeout('/api/admin/routes', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routeMachineId, status }),
      }, 20_000);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar la ruta');

      toast.success(status === 'done' ? 'Máquina marcada como hecha' : 'Máquina marcada como pendiente');
      await loadRoutes();
    } catch (error: any) {
      setRoutes(previousRoutes);
      toast.error('No se pudo actualizar la máquina', { description: error.message });
    }
  }

  async function runFullReplenishment(routeMachine: RouteMachine) {
    const externalMachineId = routeMachine.machine.externalMachineId;
    if (!externalMachineId) {
      toast.error('No se puede reponer esta máquina', {
        description: 'No tiene ID externo configurado para su proveedor.',
      });
      return;
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('Sesión no disponible');

      const providerLabel = routeMachine.machine.provider === 'televend' ? 'Televend' : 'Frekuent';
      toast.loading('Enviando llenado completo', {
        id: `route-refill-${routeMachine.id}`,
        description: `${routeMachine.machine.name} · ${providerLabel}`,
      });

      const response = await fetchWithTimeout('/api/stock/replenishment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: routeMachine.machine.provider,
          machineId: externalMachineId,
          action: 'full-refill',
        }),
      }, 40_000);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo completar el llenado');

      toast.success('Llenado completo enviado', {
        id: `route-refill-${routeMachine.id}`,
        description: 'La máquina se ha actualizado en el proveedor. Marca Hecha cuando termines la visita.',
      });
      await loadRoutes();
    } catch (error: any) {
      toast.error('No se pudo enviar el llenado', {
        id: `route-refill-${routeMachine.id}`,
        description: error.message,
      });
    }
  }

  function openStockEditor(routeMachine: RouteMachine) {
    const externalMachineId = routeMachine.machine.externalMachineId;
    if (!externalMachineId) {
      toast.error('No se puede abrir el editor', {
        description: 'No tiene ID externo configurado para su proveedor.',
      });
      return;
    }

    const params = new URLSearchParams({
      provider: routeMachine.machine.provider,
      machineId: String(externalMachineId),
      open: 'rails',
    });
    window.location.href = `/admin/stock?${params.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-3 sm:px-0 sm:py-0">
      <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white shadow-sm">
        <div className="bg-linear-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-4 text-white sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/10 p-3 text-emerald-300 ring-1 ring-white/10">
              <Route className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Gestión de rutas</h1>
              <p className="mt-1 max-w-xl text-sm font-semibold text-white/70">
                Lista móvil de reposición: prioridad visual, estado claro y check rápido por máquina.
              </p>
            </div>
          </div>

          {userRole === 'admin' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-2xl bg-white px-5 text-base font-black text-zinc-950 shadow-lg shadow-black/20 hover:bg-zinc-100">
                  <Plus className="mr-2 h-5 w-5" />
                  Nueva ruta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear ruta de reposición</DialogTitle>
                  <DialogDescription>
                    Selecciona fecha, reponedor y máquinas. El nombre se genera automáticamente.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={newRoute.scheduledDate}
                      onChange={(event) => setNewRoute({ ...newRoute, scheduledDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Reponedor asignado</Label>
                    <Select
                      value={newRoute.replenisherId}
                      onValueChange={(value) => setNewRoute({ ...newRoute, replenisherId: value })}
                    >
                      <SelectTrigger className="h-auto rounded-2xl border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
                        <SelectValue placeholder="Elegir reponedor">
                          {(() => {
                            const selected = replenishers.find((replenisher) => replenisher.id === newRoute.replenisherId);
                            if (!selected) return null;
                            return (
                              <span className="flex min-w-0 items-center gap-3 text-left">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                  <UserRound className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black text-zinc-950">
                                    {selected.display_name || selected.email}
                                  </span>
                                  <span className="block truncate text-xs font-bold text-zinc-500">{selected.email}</span>
                                </span>
                              </span>
                            );
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {replenishers.map((replenisher) => (
                          <SelectItem key={replenisher.id} value={replenisher.id}>
                            <span className="flex min-w-0 items-center gap-3 py-1">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                <UserRound className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-black">{replenisher.display_name || replenisher.email}</span>
                                <span className="block truncate text-xs text-zinc-500">{replenisher.email}</span>
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-zinc-500">Título</p>
                        <p className="truncate text-lg font-black text-zinc-950">
                          {newRoute.name.trim() || `Ruta (${formatDate(newRoute.scheduledDate)})`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 rounded-xl font-black"
                        onClick={() => setEditingRouteName((value) => !value)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar nombre
                      </Button>
                    </div>
                    {editingRouteName && (
                      <div className="mt-3">
                        <Input
                          value={newRoute.name}
                          onChange={(event) => setNewRoute({ ...newRoute, name: event.target.value })}
                          placeholder={`Ruta (${formatDate(newRoute.scheduledDate)})`}
                          className="rounded-xl bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-zinc-950">Máquinas seleccionadas: {newRoute.machineIds.length}</p>
                      <p className="text-xs font-semibold text-zinc-500">Ordenadas por urgencia para preparar rápido.</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar máquina"
                      />
                    </div>
                  </div>

                  <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {filteredMachines.map((machine) => {
                      const selected = newRoute.machineIds.includes(machine.id);
                      return (
                        <button
                          key={machine.id}
                          type="button"
                          onClick={() => toggleMachine(machine.id)}
                          className={cn(
                            'relative overflow-hidden rounded-2xl border p-3 text-left transition',
                            urgencySurfaceClass(machine.urgency),
                            selected ? 'ring-2 ring-emerald-400' : 'hover:scale-[1.01]',
                          )}
                        >
                          <span className={cn('absolute inset-y-0 left-0 w-1.5', urgencyAccentClass(machine.urgency))} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 pl-2">
                              <p className={cn('truncate text-sm font-black', urgencyTextClass(machine.urgency))}>{machine.name}</p>
                              <p className={cn('truncate text-xs font-semibold', urgencyMutedTextClass(machine.urgency))}>{machine.location || machine.provider}</p>
                            </div>
                            <Badge className={cn('shrink-0', urgencyClass(machine.urgency))}>
                              {urgencyLabel(machine.urgency)}
                            </Badge>
                          </div>
                          <div className={cn('mt-2 flex items-center gap-2 pl-2 text-xs font-bold', urgencyMutedTextClass(machine.urgency))}>
                            <span>{machine.fillRate === null ? 'Sin stock' : `${machine.fillRate}%`}</span>
                            <span>·</span>
                            <span>{machine.totalToReplenish} uds.</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={createRoute}
                    disabled={saving || !newRoute.scheduledDate || !newRoute.replenisherId || newRoute.machineIds.length === 0}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear ruta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-white p-3 sm:gap-3 sm:p-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[0.65rem] font-black uppercase text-zinc-500">Rutas</p>
            <p className="text-2xl font-black text-zinc-950 sm:text-3xl">{routes.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[0.65rem] font-black uppercase text-emerald-700">Hechas</p>
            <p className="text-2xl font-black text-emerald-700 sm:text-3xl">{totals.done}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[0.65rem] font-black uppercase text-amber-700">Pendientes</p>
            <p className="text-2xl font-black text-amber-700 sm:text-3xl">{totals.pending}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <Card className="rounded-2xl border-zinc-200">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="text-lg font-black text-zinc-950">No hay rutas preparadas</p>
            <p className="mt-1 max-w-md text-sm font-semibold text-zinc-500">
              Cuando el admin cree una ruta, el reponedor la verá aquí con sus máquinas pendientes.
            </p>
          </CardContent>
        </Card>
      ) : selectedRoute ? (
        <Card className="overflow-hidden rounded-[1.6rem] border-zinc-200 bg-white shadow-sm">
          <CardHeader className="border-b border-zinc-100 bg-white p-4">
            <div className="flex flex-col gap-3">
              <Button
                variant="ghost"
                onClick={() => setSelectedRouteId(null)}
                className="h-10 w-fit rounded-xl px-2 font-black text-zinc-700 hover:bg-zinc-100"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Rutas
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-zinc-950">{selectedRoute.name}</CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-600 sm:text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(selectedRoute.scheduledDate)}
                    </span>
                    {selectedRoute.replenisher && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1">
                        <UserRound className="h-4 w-4" />
                        {selectedRoute.replenisher.display_name || selectedRoute.replenisher.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full rounded-2xl bg-zinc-100 p-1 sm:w-48">
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-black text-zinc-600">
                    <span>Progreso</span>
                    <span>{selectedRoute.doneMachines}/{selectedRoute.totalMachines}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${selectedRoute.totalMachines ? Math.round((selectedRoute.doneMachines / selectedRoute.totalMachines) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 bg-zinc-50 p-3 sm:p-4">
            {selectedRoute.machines.map((routeMachine) => {
              const done = routeMachine.status === 'done';
              const urgency = routeMachine.machine.urgency;
              return (
                <div
                  key={routeMachine.id}
                  className={cn(
                    'relative overflow-hidden rounded-[1.35rem] border p-3 transition sm:p-4',
                    urgencySurfaceClass(urgency, done),
                  )}
                >
                  <span className={cn('absolute inset-y-0 left-0 w-2', urgencyAccentClass(urgency, done))} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 pl-3">
                      <div className="flex flex-wrap items-center gap-2 pr-1">
                        <p className={cn('min-w-0 flex-1 text-base font-black leading-tight sm:text-lg', urgencyTextClass(urgency))}>
                          {routeMachine.machine.name}
                        </p>
                        <Badge className={cn('shrink-0 text-xs font-black', urgencyClass(urgency))}>
                          {urgencyLabel(urgency)}
                        </Badge>
                      </div>
                      <p className={cn('mt-1 flex items-center gap-1 text-sm font-semibold leading-snug', urgencyMutedTextClass(urgency))}>
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {routeMachine.machine.location || routeMachine.machine.provider}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                        <span className={cn('rounded-2xl px-3 py-2 ring-1', urgencyMetricClass(urgency))}>
                          <span className="block text-[0.62rem] uppercase opacity-70">Llenado</span>
                          {routeMachine.machine.fillRate === null ? 'Sin stock' : `${routeMachine.machine.fillRate}% lleno`}
                        </span>
                        <span className={cn('rounded-2xl px-3 py-2 ring-1', urgencyMetricClass(urgency))}>
                          <span className="block text-[0.62rem] uppercase opacity-70">Reponer</span>
                          {routeMachine.machine.totalToReplenish} uds. a reponer
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pl-3 sm:flex sm:shrink-0 sm:pl-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="col-span-2 h-12 rounded-2xl bg-white font-black text-zinc-950 shadow-sm sm:col-span-1"
                          >
                            <MoreVertical className="mr-2 h-5 w-5" />
                            Reposición
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 rounded-2xl">
                          <DropdownMenuLabel>Acciones de reposición</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer font-bold"
                            onSelect={() => runFullReplenishment(routeMachine)}
                          >
                            <PackageCheck className="mr-2 h-4 w-4 text-emerald-600" />
                            Llenado completo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer font-bold"
                            onSelect={() => openStockEditor(routeMachine)}
                          >
                            <SlidersHorizontal className="mr-2 h-4 w-4 text-zinc-700" />
                            {routeMachine.machine.provider === 'televend' ? 'Editar columnas' : 'Editar raíles'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant={!done ? 'default' : 'outline'}
                        onClick={() => updateMachineStatus(routeMachine.id, 'pending')}
                        className={cn(
                          'h-12 rounded-2xl font-black shadow-sm',
                          !done ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-white',
                        )}
                      >
                        Pendiente
                      </Button>
                      <Button
                        variant={done ? 'default' : 'outline'}
                        onClick={() => updateMachineStatus(routeMachine.id, 'done')}
                        className={cn(
                          'h-12 rounded-2xl font-black shadow-sm',
                          done ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white text-emerald-700',
                        )}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Hecha
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orderedRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => setSelectedRouteId(route.id)}
              className="w-full overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-black',
                        route.pendingMachines === 0 ? 'bg-emerald-600 text-white' : 'bg-zinc-950 text-white',
                      )}>
                        {route.pendingMachines === 0 ? 'Completada' : `${route.pendingMachines} pendientes`}
                      </Badge>
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(route.scheduledDate)}
                      </span>
                    </div>
                    <h2 className="mt-3 break-words text-xl font-black leading-tight text-zinc-950">
                      {route.name}
                    </h2>
                    {route.replenisher && (
                      <p className="mt-1 flex items-center gap-1 text-sm font-bold text-zinc-500">
                        <UserRound className="h-4 w-4 shrink-0" />
                        <span className="truncate">{route.replenisher.display_name || route.replenisher.email}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-zinc-100 p-1">
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-black text-zinc-600">
                    <span>{route.totalMachines} máquinas</span>
                    <span>{route.doneMachines}/{route.totalMachines} hechas</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${route.totalMachines ? Math.round((route.doneMachines / route.totalMachines) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                    <p className="text-[0.62rem] font-black uppercase text-zinc-500">Total</p>
                    <p className="text-xl font-black text-zinc-950">{route.totalMachines}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2">
                    <p className="text-[0.62rem] font-black uppercase text-emerald-700">Hechas</p>
                    <p className="text-xl font-black text-emerald-700">{route.doneMachines}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2">
                    <p className="text-[0.62rem] font-black uppercase text-amber-700">Pend.</p>
                    <p className="text-xl font-black text-amber-700">{route.pendingMachines}</p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
