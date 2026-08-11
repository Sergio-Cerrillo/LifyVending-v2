'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  DollarSign,
  EuroIcon,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-helpers';
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

export default function AdminRevenueGeneralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function loadRevenueData(showLoader = true, showToast = false) {
    try {
      if (showLoader) setLoading(true);
      if (!showLoader) setRefreshing(true);
      setError(null);
      const response = await authenticatedFetch('/api/admin/revenue');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las recaudaciones');
      setData(payload);
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
