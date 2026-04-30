'use client';

import { useState, useEffect } from 'react';
import type { DashboardData, DashboardPeriod } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingCard, Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ShoppingCart,
  RefreshCw,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

export function DashboardVentasPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('Día');

  const loadData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      console.log('Llamando a /api/scrape-dashboard...');
      const response = await fetch('/api/scrape-dashboard');
      const result = await response.json();

      console.log('Respuesta del API:', result);

      if (result.success) {
        setData(result.data);
        if (showToast) toast.success('Dashboard actualizado');
      } else {
        const errorMsg = result.error || 'Error al cargar dashboard';
        console.error('Error del API:', errorMsg);
        console.error('Detalles:', result.details);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error(`Error al cargar dashboard: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const MetricCardSkeleton = () => (
    <Card className="border border-zinc-200">
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-6 w-20" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header minimalista */}
      <div className="border-b border-zinc-200 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-7 w-7 text-zinc-900" />
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Dashboard
              </h1>
            </div>
            <p className="text-sm text-zinc-600">
              {data ? `Datos actualizados: ${new Date(data.scrapedAt).toLocaleString('es-ES')}` : 'Análisis de ventas y métricas'}
            </p>
          </div>
          <Button 
            onClick={() => loadData(true)} 
            disabled={refreshing || loading}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Skeleton mientras carga o actualiza */}
      {(loading || refreshing) && (
        <LoadingCard 
          title={loading ? 'Cargando dashboard' : 'Actualizando datos'}
          description="Esto puede tardar unos segundos"
        >
          {/* Tabs skeleton */}
          <div className="mb-6">
            <Skeleton className="h-10 rounded-lg w-full max-w-md" />
          </div>

          {/* Métricas skeleton */}
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            {[1, 2, 3].map((i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>

          {/* Gráficas skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="border border-zinc-200">
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-2 rounded-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </LoadingCard>
      )}

      {/* Mensaje cuando no hay datos */}
      {!data && !loading && !refreshing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
            <p className="text-muted-foreground text-center mb-4">
              Haz clic en "Actualizar" para cargar los datos del dashboard
            </p>
            <Button onClick={() => loadData(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Cargar Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contenido del dashboard */}
      {data && !loading && !refreshing && (() => {
        const periodData = data.periods[selectedPeriod];
        const { metrics, totalVentasEuros, totalVentasUnidades } = periodData;

        return (
          <>

            {/* Period Tabs */}
            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as DashboardPeriod)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="Día">Hoy</TabsTrigger>
                <TabsTrigger value="Semana">Semana</TabsTrigger>
                <TabsTrigger value="Mes">Mes</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedPeriod} className="space-y-6 mt-6">
                {/* Métricas Principales */}
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Ticket Medio */}
                  <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                        <Euro className="h-4 w-4" />
                        Ticket Medio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-semibold text-zinc-900">
                            {metrics.ticketMedio.value.toFixed(2)} €
                          </p>
                          <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${metrics.ticketMedio.trend === 'up' ? 'text-zinc-900' : 'text-zinc-500'
                            }`}>
                            {metrics.ticketMedio.trend === 'up' ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {metrics.ticketMedio.change.toFixed(2)}%
                          </div>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                          <Euro className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Media Ventas Euros */}
                  <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                        <Euro className="h-4 w-4" />
                        Media por Máquina (€)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-semibold text-zinc-900">
                            {metrics.mediaVentasEuros.value.toFixed(2)} €
                          </p>
                          <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${metrics.mediaVentasEuros.trend === 'up' ? 'text-zinc-900' : 'text-zinc-500'
                            }`}>
                            {metrics.mediaVentasEuros.trend === 'up' ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {metrics.mediaVentasEuros.change.toFixed(2)}%
                          </div>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                          <Euro className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Media Ventas Unidades */}
                  <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Media por Máquina (#)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-semibold text-zinc-900">
                            {metrics.mediaVentasUnidades.value.toFixed(1)}
                          </p>
                          <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${metrics.mediaVentasUnidades.trend === 'up' ? 'text-zinc-900' : 'text-zinc-500'
                            }`}>
                            {metrics.mediaVentasUnidades.trend === 'up' ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {metrics.mediaVentasUnidades.change.toFixed(2)}%
                          </div>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <ShoppingCart className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráficas */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Total Ventas Euros */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-900">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                          <Euro className="h-4 w-4 text-white" />
                        </div>
                        Total Ventas (€)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {totalVentasEuros.length === 0 ? (
                          <p className="text-center text-zinc-500 py-8">
                            No hay datos disponibles
                          </p>
                        ) : (
                          totalVentasEuros.map((item, idx) => {
                            const totalValue = totalVentasEuros.reduce((sum, i) => sum + i.value, 0);
                            const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

                            return (
                              <div key={idx} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500"></div>
                                    <span className="font-medium text-zinc-900">{item.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-zinc-500">
                                      {percentage.toFixed(1)}%
                                    </span>
                                    <span className="font-semibold min-w-20 text-right text-zinc-900">
                                      {item.value.toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-emerald-500 to-teal-500"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Ventas Unidades */}
                  <Card className="border border-zinc-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-900">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                          <ShoppingCart className="h-4 w-4 text-white" />
                        </div>
                        Total Ventas (#)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {totalVentasUnidades.length === 0 ? (
                          <p className="text-center text-zinc-500 py-8">
                            No hay datos disponibles
                          </p>
                        ) : (
                          totalVentasUnidades.map((item, idx) => {
                            const totalValue = totalVentasUnidades.reduce((sum, i) => sum + i.value, 0);
                            const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

                            return (
                              <div key={idx} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-gradient-to-br from-purple-500 to-purple-600"></div>
                                    <span className="font-medium text-zinc-900">{item.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-zinc-500">
                                      {percentage.toFixed(1)}%
                                    </span>
                                    <span className="font-semibold min-w-[60px] text-right text-zinc-900">
                                      {item.value}
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-purple-500 to-purple-600"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        );
      })()}
    </div>
  );
}
