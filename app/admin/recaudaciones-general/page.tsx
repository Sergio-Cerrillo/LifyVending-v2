'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  DollarSign,
  EuroIcon,
  Medal,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import { fetchWithTimeout, withTimeout } from '@/lib/client-timeouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingInline } from '@/components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MachineRevenue {
  id: string;
  name: string;
  location: string | null;
  lastScraped: string | null;
  source: 'frekuent' | 'televend';
  daily: { total: number; card?: number; cash?: number; updatedAt: string | null };
  monthly: { total: number; card?: number; cash?: number; updatedAt: string | null };
}

interface RevenueData {
  machines: MachineRevenue[];
  totals: { daily: number; monthly: number };
  count: number;
  lastUpdate: string | null;
}

type Provider = 'frekuent' | 'televend';

interface RankingMachine {
  id: string;
  name: string;
  location: string | null;
  provider: Provider;
  dailyTotal: number;
  monthlyTotal: number;
}

interface RankingData {
  success: boolean;
  rankings: {
    topDaily: RankingMachine[];
    topMonthly: RankingMachine[];
    noSalesToday: RankingMachine[];
  };
}

export default function AdminRevenueGeneralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RevenueData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function authenticatedFetch(url: string, init?: RequestInit) {
    const { data: sessionData } = await withTimeout(
      supabase.auth.getSession(),
      10_000,
      'No se pudo validar la sesión',
    );
    if (!sessionData.session) {
      router.push('/login');
      throw new Error('Sesión expirada');
    }

    return fetchWithTimeout(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    }, 35_000);
  }

  async function loadRevenueData(showLoader = true, showToast = false) {
    try {
      if (showLoader) setLoading(true);
      if (!showLoader) setRefreshing(true);
      setError(null);
      const [revenueResult, rankingResult] = await Promise.allSettled([
        authenticatedFetch('/api/admin/revenue'),
        authenticatedFetch('/api/admin/home-rankings'),
      ]);

      if (revenueResult.status === 'rejected') throw revenueResult.reason;

      const payload = await revenueResult.value.json();
      if (!revenueResult.value.ok) throw new Error(payload.error || 'No se pudieron cargar las recaudaciones');
      setData(payload);

      if (rankingResult.status === 'fulfilled') {
        const rankingPayload = await rankingResult.value.json();
        if (rankingResult.value.ok && rankingPayload.success) {
          setRankingData(rankingPayload);
        }
      }

      if (showToast) {
        toast.success('Datos actualizados', {
          description: 'La vista muestra la última información disponible.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      toast.error('Error cargando recaudaciones', { description: message });
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRevenueData();
  }, []);

  if (loading) return <LoadingInline message="Cargando recaudaciones..." />;

  const providerCounts = (data?.machines || []).reduce(
    (acc, machine) => {
      acc[machine.source] += 1;
      return acc;
    },
    { frekuent: 0, televend: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-3 shadow-lg">
                <EuroIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Recaudaciones</h1>
                <p className="text-sm font-medium text-zinc-600">
                  Datos diarios y del mes para {data?.count || 0} máquinas
                </p>
              </div>
            </div>
            {data?.lastUpdate && (
              <p className="ml-14 mt-2 text-xs font-medium text-emerald-700">
                <Clock className="mr-1 inline h-3 w-3" />
                Última actualización: {formatDate(data.lastUpdate)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => loadRevenueData(false, true)}
              disabled={refreshing}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando...' : 'Actualizar datos'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <TotalCard
          title="Total de hoy"
          amount={data?.totals.daily || 0}
          subtitle={`${providerCounts.frekuent} Frekuent · ${providerCounts.televend} Televend`}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
        />
        <TotalCard
          title="Total de este mes"
          amount={data?.totals.monthly || 0}
          subtitle="Mes natural"
          icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <MachineRankingCard
          title="Top ventas de hoy"
          description="Máquinas que más están facturando hoy"
          machines={rankingData?.rankings.topDaily || []}
          emptyText="Todavía no hay ventas registradas hoy."
          metric={(machine) => (
            <p className="text-base font-black text-emerald-700">{formatCurrency(machine.dailyTotal)}</p>
          )}
        />
        <MachineRankingCard
          title="Top ventas del mes"
          description="Rendimiento acumulado del mes actual"
          machines={rankingData?.rankings.topMonthly || []}
          emptyText="Todavía no hay acumulado mensual."
          metric={(machine) => (
            <p className="text-base font-black text-zinc-900">{formatCurrency(machine.monthlyTotal)}</p>
          )}
        />
        <MachineRankingCard
          title="Sin ventas hoy"
          description="Con ventas este mes pero sin movimiento hoy"
          machines={rankingData?.rankings.noSalesToday || []}
          emptyText="Todas las máquinas activas del mes tienen movimiento o no hay datos suficientes."
          metric={(machine) => (
            <div className="space-y-1">
              <p className="text-sm font-black text-zinc-900">{formatCurrency(machine.monthlyTotal)}</p>
              <p className="text-[10px] font-black uppercase text-zinc-500">mes</p>
            </div>
          )}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por máquina</CardTitle>
          <CardDescription>Recaudaciones brutas obtenidas de las fuentes conectadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="daily">Hoy</TabsTrigger>
              <TabsTrigger value="monthly">Este mes</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="mt-4">
              <MachineTable machines={data?.machines || []} period="daily" />
            </TabsContent>
            <TabsContent value="monthly" className="mt-4">
              <MachineTable machines={data?.machines || []} period="monthly" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TotalCard({
  title,
  amount,
  subtitle,
  icon,
}: {
  title: string;
  amount: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-2 border-emerald-100">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-zinc-700">{title}</CardTitle>
        <div className="rounded-lg bg-emerald-50 p-2">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-zinc-900">{formatCurrency(amount)}</div>
        <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function providerLabel(provider: Provider) {
  return provider === 'televend' ? 'Televend' : 'Frekuent';
}

function providerBadgeClass(provider: Provider) {
  return provider === 'televend'
    ? 'border-red-100 bg-red-50 text-red-700'
    : 'border-violet-100 bg-violet-50 text-violet-700';
}

function MachineRankingCard({
  title,
  description,
  machines,
  metric,
  emptyText,
}: {
  title: string;
  description: string;
  machines: RankingMachine[];
  metric: (machine: RankingMachine) => React.ReactNode;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/80 p-4">
        <CardTitle className="text-base font-black text-zinc-900">{title}</CardTitle>
        <CardDescription className="font-semibold">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {machines.length === 0 ? (
          <div className="p-5 text-sm font-semibold text-zinc-500">{emptyText}</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {machines.slice(0, 6).map((machine, index) => (
              <div key={machine.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-black text-zinc-700">
                    {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-black text-zinc-900">{machine.name}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase">
                        {providerLabel(machine.provider)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-zinc-500">
                      {machine.location || 'Sin ubicación'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-left sm:text-right">{metric(machine)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MachineTable({
  machines,
  period,
}: {
  machines: MachineRevenue[];
  period: 'daily' | 'monthly';
}) {
  const sortedMachines = [...machines].sort((a, b) => {
    const amountDiff = b[period].total - a[period].total;
    if (amountDiff !== 0) return amountDiff;
    return a.name.localeCompare(b.name, 'es');
  });

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {sortedMachines.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-500">
            No hay datos de recaudación disponibles.
          </div>
        ) : sortedMachines.map((machine) => {
          const revenue = machine[period];
          return (
            <div key={machine.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] font-black uppercase ${providerBadgeClass(machine.source)}`}>
                      {providerLabel(machine.source)}
                    </Badge>
                    <span className="text-xs font-bold text-zinc-400">{formatDate(revenue.updatedAt)}</span>
                  </div>
                  <h4 className="break-words text-base font-black leading-tight text-zinc-900">{machine.name}</h4>
                  <p className="mt-1 break-words text-sm font-semibold text-zinc-500">{machine.location || 'Sin ubicación'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black text-emerald-700">{formatCurrency(revenue.total)}</p>
                  <p className="text-[10px] font-black uppercase text-zinc-400">{period === 'daily' ? 'hoy' : 'mes'}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Electrónico</p>
                  <p className="mt-1 text-base font-black text-zinc-900">{formatCurrency(revenue.card || 0)}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-black uppercase text-zinc-400">Efectivo</p>
                  <p className="mt-1 text-base font-black text-zinc-900">{formatCurrency(revenue.cash || 0)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 md:block">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Actualización</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMachines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-zinc-500">
                No hay datos de recaudación disponibles.
              </TableCell>
            </TableRow>
          ) : sortedMachines.map((machine) => {
            const revenue = machine[period];
            return (
              <TableRow key={machine.id}>
                <TableCell className="font-medium">{machine.name}</TableCell>
                <TableCell>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${providerBadgeClass(machine.source)}`}>
                    {providerLabel(machine.source)}
                  </span>
                </TableCell>
                <TableCell>{machine.location || 'Sin ubicación'}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(revenue.total)}</TableCell>
                <TableCell className="text-sm text-zinc-600">{formatDate(revenue.updatedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return 'Sin datos';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
