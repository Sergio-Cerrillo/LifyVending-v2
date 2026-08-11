'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Euro,
  Medal,
  Package,
  RefreshCw,
  Trophy,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Provider = 'frekuent' | 'televend';
type Urgency = 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';

interface RankingMachine {
  id: string;
  name: string;
  location: string | null;
  provider: Provider;
  dailyTotal: number;
  monthlyTotal: number;
  fillRate: number | null;
  urgency: Urgency;
  totalToReplenish: number;
  totalCapacity: number;
  totalAvailable: number;
  revenueUpdatedAt: string | null;
  stockUpdatedAt: string | null;
}

interface RankingPayload {
  success: boolean;
  generatedAt: string;
  lastUpdate: string | null;
  summary: {
    machines: number;
    totalDaily: number;
    totalMonthly: number;
    totalToReplenish: number;
    criticalMachines: number;
    noSalesToday: number;
    providers: Record<Provider, {
      machines: number;
      dailyTotal: number;
      monthlyTotal: number;
    }>;
  };
  rankings: {
    topDaily: RankingMachine[];
    topMonthly: RankingMachine[];
    stockPriority: RankingMachine[];
    noSalesToday: RankingMachine[];
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value || 0);
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

function providerLabel(provider: Provider) {
  return provider === 'televend' ? 'Televend' : 'Frekuent';
}

function urgencyLabel(urgency: Urgency) {
  if (urgency === 'empty') return 'Vacía';
  if (urgency === 'critical') return 'Crítica';
  if (urgency === 'normal') return 'Normal';
  if (urgency === 'unknown') return 'Sin datos';
  return 'Bien';
}

function urgencyClass(urgency: Urgency) {
  if (urgency === 'empty') return 'bg-zinc-950 text-white';
  if (urgency === 'critical') return 'bg-red-600 text-white';
  if (urgency === 'normal') return 'bg-yellow-500 text-white';
  if (urgency === 'unknown') return 'bg-zinc-200 text-zinc-700';
  return 'bg-emerald-600 text-white';
}

function RankingSkeleton() {
  return (
    <div className="w-full max-w-[100dvw] space-y-6 overflow-x-hidden px-3 sm:px-0">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-96 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: 'default' | 'danger' | 'success';
}) {
  const toneClass = tone === 'danger'
    ? 'border-red-100 bg-red-50/70'
    : tone === 'success'
      ? 'border-emerald-100 bg-emerald-50/80'
      : 'border-zinc-200 bg-white';

  return (
    <Card className={`shadow-sm ${toneClass}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-zinc-500">{title}</p>
            <p className="mt-3 break-words text-3xl font-black leading-none text-zinc-900 sm:text-4xl">{value}</p>
            <p className="mt-2 text-sm font-semibold text-zinc-500">{subtitle}</p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MachineRankingCard({
  title,
  description,
  machines,
  metric,
  emptyText,
  href,
}: {
  title: string;
  description: string;
  machines: RankingMachine[];
  metric: (machine: RankingMachine) => React.ReactNode;
  emptyText: string;
  href?: string;
}) {
  return (
    <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/80 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg font-black text-zinc-900">{title}</CardTitle>
            <p className="mt-1 text-sm font-semibold text-zinc-500">{description}</p>
          </div>
          {href && (
            <Link href={href}>
              <Button variant="ghost" size="sm" className="shrink-0">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {machines.length === 0 ? (
          <div className="p-5 text-sm font-semibold text-zinc-500">{emptyText}</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {machines.map((machine, index) => (
              <div key={machine.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-sm font-black text-zinc-700">
                    {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-black text-zinc-900 sm:text-base">{machine.name}</p>
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

export function RankingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RankingPayload | null>(null);

  async function loadRankings(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      if (!showLoader) setRefreshing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        throw new Error('Sesión expirada');
      }

      const response = await fetch('/api/admin/home-rankings', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'No se pudieron cargar los rankings');
      }

      setData(payload);
      if (!showLoader) toast.success('Ranking actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando ranking';
      toast.error('No se pudo cargar el ranking', { description: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRankings();
  }, []);

  if (loading) return <RankingSkeleton />;

  return (
    <div className="w-full max-w-[100dvw] space-y-4 overflow-x-hidden px-3 pb-4 sm:space-y-6 sm:px-0 sm:pb-0 [&_*]:min-w-0">
      <section className="w-full max-w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:bg-gradient-to-br sm:from-white sm:via-emerald-50/40 sm:to-blue-50/30 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <div className="hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-3 text-white shadow-lg sm:block">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-xl font-black leading-tight tracking-tight text-zinc-900 sm:text-3xl">
                  Ranking de máquinas
                </h1>
                <p className="break-words text-sm font-semibold text-zinc-700">
                  Ventas, reposición y señales de atención ordenadas para decidir rápido qué revisar
                </p>
              </div>
            </div>
            <p className="break-words text-xs font-medium text-emerald-700 sm:ml-14">
              Última actualización: {formatDate(data?.lastUpdate || null)}
              <span className="mx-2 text-zinc-300">/</span>
              {data?.summary.providers.frekuent.machines || 0} Frekuent
              <span className="mx-2 text-zinc-300">/</span>
              {data?.summary.providers.televend.machines || 0} Televend
            </p>
          </div>
          <Button
            type="button"
            onClick={() => loadRankings(false)}
            disabled={refreshing}
            className="h-12 w-full max-w-full rounded-xl bg-emerald-600 px-4 text-base font-bold text-white hover:bg-emerald-700 md:w-auto"
          >
            <RefreshCw className={`mr-2 h-4 w-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="truncate">{refreshing ? 'Actualizando...' : 'Actualizar ranking'}</span>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Ventas hoy"
          value={formatCurrency(data?.summary.totalDaily || 0)}
          subtitle="total operativo"
          icon={<Euro className="h-5 w-5 text-emerald-700" />}
          tone="success"
        />
        <SummaryCard
          title="Ventas mes"
          value={formatCurrency(data?.summary.totalMonthly || 0)}
          subtitle={`${data?.summary.machines || 0} máquinas monitorizadas`}
          icon={<Banknote className="h-5 w-5 text-zinc-700" />}
        />
        <SummaryCard
          title="Stock crítico"
          value={String(data?.summary.criticalMachines || 0)}
          subtitle={`${(data?.summary.totalToReplenish || 0).toLocaleString('es-ES')} unidades a reponer`}
          icon={<AlertTriangle className="h-5 w-5 text-red-700" />}
          tone={(data?.summary.criticalMachines || 0) > 0 ? 'danger' : 'default'}
        />
        <SummaryCard
          title="Sin ventas hoy"
          value={String(data?.summary.noSalesToday || 0)}
          subtitle="con actividad este mes"
          icon={<WifiOff className="h-5 w-5 text-zinc-700" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MachineRankingCard
          title="Top ventas de hoy"
          description="Máquinas que más están facturando hoy"
          machines={data?.rankings.topDaily || []}
          href="/admin/recaudaciones-general"
          emptyText="Todavía no hay ventas registradas hoy."
          metric={(machine) => (
            <p className="text-base font-black text-emerald-700">{formatCurrency(machine.dailyTotal)}</p>
          )}
        />
        <MachineRankingCard
          title="Top ventas del mes"
          description="Rendimiento acumulado del mes actual"
          machines={data?.rankings.topMonthly || []}
          href="/admin/recaudaciones-general"
          emptyText="Todavía no hay acumulado mensual."
          metric={(machine) => (
            <p className="text-base font-black text-zinc-900">{formatCurrency(machine.monthlyTotal)}</p>
          )}
        />
        <MachineRankingCard
          title="Prioridad de reposición"
          description="Máquinas ordenadas por urgencia de stock"
          machines={data?.rankings.stockPriority || []}
          href="/admin/stock"
          emptyText="No hay máquinas pendientes de reposición."
          metric={(machine) => (
            <div className="space-y-1">
              <Badge className={`${urgencyClass(machine.urgency)} text-[10px] font-black uppercase`}>
                {urgencyLabel(machine.urgency)}
              </Badge>
              <p className="text-xs font-black text-zinc-500">{machine.fillRate ?? 0}% llenado</p>
            </div>
          )}
        />
        <MachineRankingCard
          title="Sin ventas hoy"
          description="Máquinas con ventas este mes pero sin movimiento hoy"
          machines={data?.rankings.noSalesToday || []}
          href="/admin/recaudaciones-general"
          emptyText="Todas las máquinas activas del mes tienen movimiento o no hay datos suficientes."
          metric={(machine) => (
            <div className="space-y-1">
              <p className="text-sm font-black text-zinc-900">{formatCurrency(machine.monthlyTotal)}</p>
              <p className="text-[10px] font-black uppercase text-zinc-500">mes</p>
            </div>
          )}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link href="/admin/stock" className="group">
          <Card className="border-zinc-200 bg-white shadow-sm transition-colors group-hover:border-emerald-300">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-base font-black text-zinc-900">Abrir stock</p>
                <p className="mt-1 text-sm font-semibold text-zinc-500">Revisar productos, railes y reposición.</p>
              </div>
              <Package className="h-5 w-5 text-emerald-700" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/recaudaciones-general" className="group">
          <Card className="border-zinc-200 bg-white shadow-sm transition-colors group-hover:border-emerald-300">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-base font-black text-zinc-900">Abrir recaudaciones</p>
                <p className="mt-1 text-sm font-semibold text-zinc-500">Consultar detalle diario y mensual.</p>
              </div>
              <Euro className="h-5 w-5 text-emerald-700" />
            </CardContent>
          </Card>
        </Link>
      </section>
    </div>
  );
}
