'use client';

/**
 * PÁGINA ADMIN: VER DASHBOARD DEL CLIENTE (Read-only)
 * 
 * Esta página muestra solo las estadísticas del cliente sin permitir edición
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase-helpers';
import { LoadingInline } from '@/components/ui/loading-screen';

import Link from 'next/link';

interface ClientOverview {
  client: {
    id: string;
    email: string;
    displayName: string | null;
    companyName: string | null;
    commissionHidePercent: number;
    commissionPaymentPercent: number;
  };
  machines: Array<{
    id: string;
    name: string;
    location: string | null;
  }>;
  revenue: {
    daily: {
      period: string;
      total_gross: number;
      total_net: number;
      commission_percent: number;
      machine_count: number;
      last_update: string | null;
    } | null;
    weekly: {
      period: string;
      total_gross: number;
      total_net: number;
      commission_percent: number;
      machine_count: number;
      last_update: string | null;
    } | null;
    monthly: {
      period: string;
      total_gross: number;
      total_net: number;
      commission_percent: number;
      machine_count: number;
      last_update: string | null;
    } | null;
  };
}

export default function AdminClientOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [clientId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      const overviewResponse = await fetch(`/api/admin/clients/${clientId}/overview`, {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });

      if (!overviewResponse.ok) {
        const errorData = await overviewResponse.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error cargando overview del cliente');
      }

      const overviewData = await overviewResponse.json();
      setOverview(overviewData);

    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  function calculateDifference(gross: number, net: number): string {
    const diff = gross - net;
    return formatCurrency(diff);
  }

  if (loading) {
    return <LoadingInline message="Cargando información del cliente..." />;
  }

  if (error || !overview) {
    return (
      <div className="container mx-auto p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'No se pudieron cargar los datos'}</p>
            <Button onClick={loadData} className="mt-4">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-200 pb-6 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients-management">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {overview.client.companyName || overview.client.displayName || overview.client.email}
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              {overview.client.email}
            </p>
          </div>
        </div>
        <Link href={`/admin/clients/${clientId}`}>
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold">
            <Settings className="w-4 h-4 mr-2" />
            Configurar Cliente
          </Button>
        </Link>
      </div>

      {/* Info del cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-zinc-600 font-medium">Email</p>
              <p className="font-medium">{overview.client.email}</p>
            </div>
            {overview.client.displayName && (
              <div>
                <p className="text-sm text-zinc-600 font-medium">Nombre</p>
                <p className="font-medium">{overview.client.displayName}</p>
              </div>
            )}
            {overview.client.companyName && (
              <div>
                <p className="text-sm text-zinc-600 font-medium">Empresa</p>
                <p className="font-medium">{overview.client.companyName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-zinc-600 font-medium">Porcentaje Oculto</p>
              <p className="font-medium">{overview.client.commissionHidePercent}%</p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 font-medium">Comisión Pago</p>
              <p className="font-medium">{overview.client.commissionPaymentPercent}%</p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 font-medium">Máquinas Asignadas</p>
              <p className="font-medium">{overview.machines.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard - Vista Comparativa */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard del Cliente - Vista Comparativa</CardTitle>
          <CardDescription>
            Lo que el cliente ve después de aplicar {overview.client.commissionHidePercent}% oculto. Como admin, ves ambos valores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Daily */}
            {overview.revenue.daily && (
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground">DIARIA</h3>
                  <Badge variant="outline">{overview.revenue.daily.machine_count} máquinas</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bruto:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(overview.revenue.daily.total_gross)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600">
                    <span className="text-sm">Oculto ({overview.client.commissionHidePercent}%):</span>
                    <span className="font-medium">
                      -{calculateDifference(overview.revenue.daily.total_gross, overview.revenue.daily.total_net)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                    <span className="text-sm font-medium">Neto (cliente ve):</span>
                    <span className="font-bold text-lg text-primary">
                      {formatCurrency(overview.revenue.daily.total_net)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly */}
            {overview.revenue.monthly && (
              <div className="space-y-2 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-zinc-700 uppercase">MENSUAL</h3>
                  <Badge variant="outline">{overview.revenue.monthly.machine_count} máquinas</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bruto:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(overview.revenue.monthly.total_gross)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600">
                    <span className="text-sm">Oculto ({overview.client.commissionHidePercent}%):</span>
                    <span className="font-medium">
                      -{calculateDifference(overview.revenue.monthly.total_gross, overview.revenue.monthly.total_net)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                    <span className="text-sm font-medium">Neto (cliente ve):</span>
                    <span className="font-bold text-lg text-primary">
                      {formatCurrency(overview.revenue.monthly.total_net)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Máquinas asignadas */}
      <Card>
        <CardHeader>
          <CardTitle>Máquinas Asignadas</CardTitle>
          <CardDescription>
            El cliente puede ver solo estas máquinas en su dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.machines.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">
              No hay máquinas asignadas a este cliente.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {overview.machines.map((machine) => (
                <div
                  key={machine.id}
                  className="p-3 border rounded-lg bg-zinc-50/50 border-zinc-200"
                >
                  <div className="font-medium">{machine.name}</div>
                  {machine.location && (
                    <div className="text-sm text-zinc-600 mt-1">{machine.location}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
