'use client';

/**
 * DASHBOARD DEL CLIENTE
 * 
 * Muestra:
 * - Recaudación NETA (daily, weekly, monthly)
 * - Lista de máquinas asignadas
 * - Timestamp de última actualización automática
 * 
 * IMPORTANTE:
 * - Los datos se actualizan automáticamente cada hora (Vercel Cron)
 * - El cliente NO puede forzar scraping (solo admin)
 * - Solo se muestra recaudación NETA (comisión ya aplicada)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, DollarSign, Calendar, MapPin, Clock, LogOut, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase-helpers';
import { LoadingScreen } from '@/components/ui/loading-screen';

interface DashboardData {
  profile: {
    displayName: string | null;
    companyName: string | null;
  };
  commission: {
    hidePercent: number;
    paymentPercent: number;
  };
  machines: Array<{
    id: string;
    name: string;
    location: string | null;
  }>;
  revenue: {
    daily: {
      total: number;
      machines: Array<{ id: string; name: string; location: string | null; amountNet: number }>;
      lastUpdate: string | null;
    };
    weekly: {
      total: number;
      machines: Array<{ id: string; name: string; location: string | null; amountNet: number }>;
      lastUpdate: string | null;
    };
    monthly: {
      total: number;
      machines: Array<{ id: string; name: string; location: string | null; amountNet: number }>;
      lastUpdate: string | null;
    };
  };
  lastUpdate: string | null;
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      // Obtener sesión
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      // Llamar al endpoint del dashboard
      const response = await fetch('/api/client/dashboard', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);

    } catch (err: any) {
      console.error('Error cargando dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  if (loading) {
    return <LoadingScreen message="Cargando dashboard..." />;
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'No se pudieron cargar los datos'}</p>
            <Button onClick={loadDashboard} className="mt-4">
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">
            {data.profile.companyName || data.profile.displayName || 'Mi Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            Recaudación neta de sus máquinas de vending
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadDashboard}
            variant="outline"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="lg"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Actualización automática */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-emerald-100">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900 mb-1">Actualización Automática</h3>
              <p className="text-sm text-emerald-800 mb-2">
                Los datos de recaudación se actualizan automáticamente <strong>cada día alrededor de las 09:00</strong> de la mañana.
              </p>
              {data.lastUpdate && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-emerald-200">
                  <span className="text-xs font-medium text-emerald-700">Última actualización:</span>
                  <span className="text-xs text-emerald-900 font-semibold">
                    {formatDate(data.lastUpdate)}
                  </span>
                  <Badge
                    variant="default"
                    className="text-xs bg-emerald-600"
                  >
                    ✓ Sincronizado
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información importante */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Información sobre los importes</h3>
              <p className="text-sm text-blue-800">
                Los importes mostrados representan la <strong>recaudación total</strong> de sus máquinas, no el beneficio neto.
                Su comisión acordada es del <strong>{data.commission.paymentPercent}%</strong> sobre la recaudación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de recaudación */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recaudación Diaria (Neta)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.revenue.daily.total)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hoy
            </p>
          </CardContent>
        </Card>

        {/* Monthly */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recaudación Mensual (Neta)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.revenue.monthly.total)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de máquinas con recaudación individual */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Máquinas ({data.machines.length})</CardTitle>
          <CardDescription>
            Recaudación individual por máquina (valores netos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.machines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tiene máquinas asignadas
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.machines.map((machine) => {
                // Buscar datos de recaudación para esta máquina
                const dailyData = data.revenue.daily.machines.find(m => m.id === machine.id);
                const monthlyData = data.revenue.monthly.machines.find(m => m.id === machine.id);

                return (
                  <div
                    key={machine.id}
                    className="p-4 border border-zinc-200 rounded-lg hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors group"
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="font-medium leading-snug wrap-break-word">{machine.name}</h3>
                        {machine.location && (
                          <p className="text-xs text-muted-foreground group-hover:text-zinc-300 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {machine.location}
                          </p>
                        )}
                      </div>

                      {/* Recaudación Diaria */}
                      <div className="pt-2 border-t border-zinc-200 group-hover:border-zinc-700">
                        <p className="text-xs text-muted-foreground group-hover:text-zinc-300">Diario</p>
                        <p className="text-base font-bold">
                          {dailyData ? formatCurrency(dailyData.amountNet) : '-'}
                        </p>
                      </div>

                      {/* Recaudación Mensual */}
                      <div className="pt-2 border-t border-zinc-200 group-hover:border-zinc-700">
                        <p className="text-xs text-muted-foreground group-hover:text-zinc-300">Mensual</p>
                        <p className="text-lg font-bold">
                          {monthlyData ? formatCurrency(monthlyData.amountNet) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
