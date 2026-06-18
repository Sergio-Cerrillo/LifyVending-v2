'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  DollarSign,
  EuroIcon,
  Loader2,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
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
  source: 'frekuent';
  daily: { total: number; updatedAt: string | null };
  monthly: { total: number; updatedAt: string | null };
}

interface RevenueData {
  machines: MachineRevenue[];
  totals: { daily: number; monthly: number };
  count: number;
  lastUpdate: string | null;
}

type JobState = {
  status: 'idle' | 'queued' | 'running' | 'success' | 'error';
  message?: string;
  durationSeconds?: number;
};

const IDLE_JOB: JobState = { status: 'idle' };

export default function AdminRevenueGeneralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobState>(IDLE_JOB);
  const manualEnabled = process.env.NEXT_PUBLIC_ENABLE_MANUAL_SCRAPING !== 'false';

  async function authenticatedFetch(url: string, init?: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/login');
      throw new Error('Sesión expirada');
    }

    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });
  }

  async function loadRevenueData(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const response = await authenticatedFetch('/api/admin/revenue');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las recaudaciones');
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      toast.error('Error cargando recaudaciones', { description: message });
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function loadJobStatus() {
    if (!manualEnabled) return;

    try {
      const response = await authenticatedFetch('/api/admin/revenue/jobs');
      if (!response.ok) return;
      const payload = await response.json();
      const latest = payload.byAction?.frekuent;
      if (!latest) return;

      const status =
        latest.status === 'completed' ? 'success' :
        latest.status === 'error' ? 'error' :
        latest.status;

      setJob({
        status,
        message: latest.error_message || latest.phase,
        durationSeconds: latest.result_json?.durationSeconds,
      });

      if (status === 'success') {
        await loadRevenueData(false);
      }
    } catch {
      // El estado es auxiliar y no debe bloquear la lectura de recaudaciones.
    }
  }

  useEffect(() => {
    loadRevenueData();
    loadJobStatus();
  }, []);

  useEffect(() => {
    if (!manualEnabled) return;
    const interval = window.setInterval(loadJobStatus, 5000);
    return () => window.clearInterval(interval);
  }, [manualEnabled]);

  async function runFrekuentScraping() {
    try {
      setSubmitting(true);
      setJob({ status: 'queued', message: 'Encolando ejecución' });

      const response = await authenticatedFetch('/api/admin/revenue/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'frekuent' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo encolar el scraping');

      setJob({
        status: 'success',
        message: 'Completado',
        durationSeconds: payload.result?.durationSeconds,
      });
      await loadRevenueData(false);
      toast.success('Scraping de Frekuent completado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setJob({ status: 'error', message });
      toast.error('Error ejecutando Frekuent', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingInline message="Cargando recaudaciones..." />;

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
                <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Recaudaciones Frekuent</h1>
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
            {manualEnabled && (
              <Button
                onClick={runFrekuentScraping}
                disabled={submitting || job.status === 'queued' || job.status === 'running'}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {submitting || job.status === 'running'
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Zap className="mr-2 h-4 w-4" />}
                Actualizar Frekuent
              </Button>
            )}
            <Button variant="outline" onClick={() => loadRevenueData()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar vista
            </Button>
          </div>
        </div>
      </div>

      {manualEnabled && <JobStatusCard job={job} />}

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <TotalCard
          title="Total de hoy"
          amount={data?.totals.daily || 0}
          subtitle={`${data?.count || 0} máquinas Frekuent`}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
        />
        <TotalCard
          title="Total de este mes"
          amount={data?.totals.monthly || 0}
          subtitle="Mes natural"
          icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por máquina</CardTitle>
          <CardDescription>Recaudaciones brutas obtenidas de Frekuent</CardDescription>
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

function JobStatusCard({ job }: { job: JobState }) {
  const badge =
    job.status === 'running' ? <Badge className="bg-blue-100 text-blue-700"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Ejecutando</Badge> :
    job.status === 'queued' ? <Badge variant="outline" className="text-amber-700"><CircleDashed className="mr-1 h-3 w-3" />En cola</Badge> :
    job.status === 'success' ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Completado</Badge> :
    job.status === 'error' ? <Badge className="bg-red-100 text-red-700"><XCircle className="mr-1 h-3 w-3" />Error</Badge> :
    <Badge variant="outline">Sin actividad</Badge>;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div>
          <p className="font-semibold text-zinc-900">Estado del scraping Frekuent</p>
          <p className="text-sm text-zinc-600">{job.message || 'Sin ejecuciones recientes'}</p>
          {typeof job.durationSeconds === 'number' && (
            <p className="text-xs text-emerald-700">Duración: {job.durationSeconds}s</p>
          )}
        </div>
        {badge}
      </CardContent>
    </Card>
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

function MachineTable({
  machines,
  period,
}: {
  machines: MachineRevenue[];
  period: 'daily' | 'monthly';
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Actualización</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {machines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-zinc-500">
                No hay datos de Frekuent disponibles.
              </TableCell>
            </TableRow>
          ) : machines.map((machine) => {
            const revenue = machine[period];
            return (
              <TableRow key={machine.id}>
                <TableCell className="font-medium">{machine.name}</TableCell>
                <TableCell>{machine.location || 'Sin ubicación'}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(revenue.total)}</TableCell>
                <TableCell className="text-sm text-zinc-600">{formatDate(revenue.updatedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
