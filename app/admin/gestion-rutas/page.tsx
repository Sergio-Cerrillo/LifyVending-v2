'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Loader2, Plus, Route, Search, UserRound } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
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
  const [newRoute, setNewRoute] = useState({
    name: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    replenisherId: '',
    notes: '',
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
      const urgencyOrder: Record<Urgency, number> = { empty: 0, critical: 1, normal: 2, ok: 3, unknown: 4 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.name.localeCompare(b.name);
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
        body: JSON.stringify(newRoute),
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
        notes: '',
        machineIds: [],
      });
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

  return (
    <div className="space-y-5 px-3 py-4 sm:px-0 sm:py-0">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
              <Route className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Gestión de rutas</h1>
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                Prepara rutas por reponedor y controla cada máquina como Pendiente o Hecha.
              </p>
            </div>
          </div>

          {userRole === 'admin' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-xl bg-zinc-950 px-5 text-base font-black text-white hover:bg-zinc-800">
                  <Plus className="mr-2 h-5 w-5" />
                  Nueva ruta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear ruta de reposición</DialogTitle>
                  <DialogDescription>
                    Selecciona reponedor, fecha y máquinas. La ruta aparecerá en su lista operativa.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la ruta</Label>
                    <Input
                      value={newRoute.name}
                      onChange={(event) => setNewRoute({ ...newRoute, name: event.target.value })}
                      placeholder="Ruta Palma mañana"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={newRoute.scheduledDate}
                      onChange={(event) => setNewRoute({ ...newRoute, scheduledDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reponedor</Label>
                    <Select
                      value={newRoute.replenisherId}
                      onValueChange={(value) => setNewRoute({ ...newRoute, replenisherId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir reponedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {replenishers.map((replenisher) => (
                          <SelectItem key={replenisher.id} value={replenisher.id}>
                            {replenisher.display_name || replenisher.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={newRoute.notes}
                      onChange={(event) => setNewRoute({ ...newRoute, notes: event.target.value })}
                      placeholder="Indicaciones internas para esta ruta"
                      className="min-h-10"
                    />
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
                            'rounded-xl border bg-white p-3 text-left transition',
                            selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-zinc-200 hover:border-zinc-300',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-zinc-950">{machine.name}</p>
                              <p className="truncate text-xs font-semibold text-zinc-500">{machine.location || machine.provider}</p>
                            </div>
                            <Badge className={cn('shrink-0', urgencyClass(machine.urgency))}>
                              {urgencyLabel(machine.urgency)}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-zinc-600">
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
                    disabled={saving || !newRoute.name || !newRoute.scheduledDate || !newRoute.replenisherId || newRoute.machineIds.length === 0}
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

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-black uppercase text-zinc-500">Rutas</p>
            <p className="text-2xl font-black text-zinc-950">{routes.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase text-emerald-700">Hechas</p>
            <p className="text-2xl font-black text-emerald-700">{totals.done}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-black uppercase text-amber-700">Pendientes</p>
            <p className="text-2xl font-black text-amber-700">{totals.pending}</p>
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
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <Card key={route.id} className="overflow-hidden rounded-2xl border-zinc-200 bg-white shadow-sm">
              <CardHeader className="border-b border-zinc-100 bg-zinc-50/80 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-zinc-950">{route.name}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatDate(route.scheduledDate)}
                      </span>
                      {route.replenisher && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-4 w-4" />
                          {route.replenisher.display_name || route.replenisher.email}
                        </span>
                      )}
                    </div>
                    {route.notes && <p className="mt-2 text-sm font-semibold text-zinc-500">{route.notes}</p>}
                  </div>
                  <Badge className={cn(
                    'w-fit rounded-full px-3 py-1 text-sm font-black',
                    route.pendingMachines === 0 ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-white',
                  )}>
                    {route.doneMachines}/{route.totalMachines} hechas
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 p-3 sm:p-4">
                {route.machines.map((routeMachine) => {
                  const done = routeMachine.status === 'done';
                  return (
                    <div
                      key={routeMachine.id}
                      className={cn(
                        'rounded-2xl border p-3 transition sm:p-4',
                        done ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 bg-white',
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-black text-zinc-950 sm:text-lg">
                              {routeMachine.machine.name}
                            </p>
                            <Badge className={cn('text-xs font-black', urgencyClass(routeMachine.machine.urgency))}>
                              {urgencyLabel(routeMachine.machine.urgency)}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-zinc-500">
                            {routeMachine.machine.location || routeMachine.machine.provider}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-black text-zinc-600">
                            <span className="rounded-full bg-zinc-100 px-2 py-1">
                              {routeMachine.machine.fillRate === null ? 'Sin stock' : `${routeMachine.machine.fillRate}% lleno`}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-1">
                              {routeMachine.machine.totalToReplenish} uds. a reponer
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                          <Button
                            variant={!done ? 'default' : 'outline'}
                            onClick={() => updateMachineStatus(routeMachine.id, 'pending')}
                            className={cn(
                              'h-12 rounded-xl font-black',
                              !done ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-white',
                            )}
                          >
                            Pendiente
                          </Button>
                          <Button
                            variant={done ? 'default' : 'outline'}
                            onClick={() => updateMachineStatus(routeMachine.id, 'done')}
                            className={cn(
                              'h-12 rounded-xl font-black',
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
          ))}
        </div>
      )}
    </div>
  );
}
