'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    TrendingUp,
    TrendingDown,
    Euro,
    RefreshCw,
    BarChart3,
    Package,
    Clock,
    CreditCard,
    Banknote,
    Activity,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase-helpers';

interface DashboardStats {
    lastUpdate: string | null;
    totalMachines: number;
    activeMachines: number;
    daily: {
        totalRevenue: number;
        totalCard: number;
        totalCash: number;
        machineCount: number;
        change: number;
    };
    weekly: {
        totalRevenue: number;
        totalCard: number;
        totalCash: number;
        machineCount: number;
    };
    monthly: {
        totalRevenue: number;
        totalCard: number;
        totalCash: number;
        machineCount: number;
    };
}

type ProviderKey = 'frekuent' | 'televend';

interface ProviderMachineStatus {
    provider: ProviderKey;
    requestedAt: string;
    total: number;
    empty: number;
    critical: number;
    normal: number;
    ok: number;
    unknown: number;
    fillRate: number;
    totalToReplenish: number;
}

interface ProviderStatusState {
    loading: boolean;
    data: ProviderMachineStatus | null;
    error: string | null;
}

function MachineStatusSkeleton() {
    return (
        <Card className="overflow-hidden border border-zinc-200 bg-white">
            <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-28 animate-pulse" />
                    <Skeleton className="h-9 w-9 rounded-xl animate-pulse" />
                </div>
                <Skeleton className="h-9 w-20 animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((item) => (
                        <Skeleton key={item} className="h-16 rounded-xl animate-pulse" />
                    ))}
                </div>
                <Skeleton className="h-3 rounded-full animate-pulse" />
            </CardContent>
        </Card>
    );
}

function ProviderMachineStatusCard({
    label,
    state,
    onRetry,
}: {
    label: string;
    state: ProviderStatusState;
    onRetry: () => void;
}) {
    if (state.loading) return <MachineStatusSkeleton />;

    if (state.error || !state.data) {
        return (
            <Card className="border-red-200 bg-red-50/70">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        {label}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm font-medium text-red-700">{state.error || 'No se pudo cargar el estado'}</p>
                    <Button type="button" variant="outline" onClick={onRetry} className="border-red-200 bg-white text-red-700 hover:bg-red-50">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reintentar
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const statusItems = [
        { label: 'Vacías', value: state.data.empty, className: 'bg-zinc-950 text-white', icon: XCircle },
        { label: 'Críticas', value: state.data.critical, className: 'bg-red-600 text-white', icon: AlertTriangle },
        { label: 'Normal', value: state.data.normal, className: 'bg-yellow-500 text-white', icon: AlertCircle },
        { label: 'Bien', value: state.data.ok, className: 'bg-green-600 text-white', icon: CheckCircle },
    ];

    return (
        <Card className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-lg font-black text-zinc-900">{label}</CardTitle>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                            {state.data.totalToReplenish.toLocaleString('es-ES')} unidades a reponer
                        </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-2xl font-black leading-none text-emerald-700">{state.data.total}</p>
                        <p className="text-[10px] font-black uppercase text-emerald-700">máquinas</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    {statusItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className={`rounded-xl p-3 ${item.className}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black uppercase opacity-90">{item.label}</span>
                                    <Icon className="h-4 w-4 shrink-0" />
                                </div>
                                <p className="mt-2 text-2xl font-black leading-none">{item.value}</p>
                            </div>
                        );
                    })}
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-bold text-zinc-500">
                        <span>Llenado medio</span>
                        <span>{state.data.fillRate}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                            className={`h-full rounded-full ${state.data.fillRate < 65 ? 'bg-red-600' : state.data.fillRate < 75 ? 'bg-yellow-500' : 'bg-green-600'}`}
                            style={{ width: `${Math.max(0, Math.min(100, state.data.fillRate))}%` }}
                        />
                    </div>
                    {state.data.unknown > 0 && (
                        <p className="mt-2 text-xs font-semibold text-zinc-500">
                            {state.data.unknown} {state.data.unknown === 1 ? 'máquina sin datos' : 'máquinas sin datos'}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function MachineStatusOverview() {
    const [providers, setProviders] = useState<Record<ProviderKey, ProviderStatusState>>({
        frekuent: { loading: true, data: null, error: null },
        televend: { loading: true, data: null, error: null },
    });

    async function loadProvider(provider: ProviderKey) {
        setProviders((current) => ({
            ...current,
            [provider]: { ...current[provider], loading: true, error: null },
        }));

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error('Sesión no válida');
            }

            const response = await fetch(`/api/admin/stock-status?provider=${provider}`, {
                headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                },
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || `No se pudo cargar ${provider}`);
            }

            setProviders((current) => ({
                ...current,
                [provider]: { loading: false, data: result.status, error: null },
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error consultando proveedor';
            setProviders((current) => ({
                ...current,
                [provider]: { loading: false, data: null, error: message },
            }));
        }
    }

    useEffect(() => {
        loadProvider('frekuent');
        loadProvider('televend');
    }, []);

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-black tracking-tight text-zinc-900">Estado de máquinas</h2>
                    <p className="text-sm font-semibold text-zinc-500">Carga independiente del dashboard principal</p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                        loadProvider('frekuent');
                        loadProvider('televend');
                    }}
                    disabled={providers.frekuent.loading || providers.televend.loading}
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${(providers.frekuent.loading || providers.televend.loading) ? 'animate-spin' : ''}`} />
                    Actualizar estados
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <ProviderMachineStatusCard
                    label="Frekuent"
                    state={providers.frekuent}
                    onRetry={() => loadProvider('frekuent')}
                />
                <ProviderMachineStatusCard
                    label="Televend"
                    state={providers.televend}
                    onRetry={() => loadProvider('televend')}
                />
            </div>
        </section>
    );
}

export function DashboardOverviewPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async (showToast = false) => {
        try {
            setError(null); // Limpiar errores previos
            if (showToast) setRefreshing(true);

            // Usar el mismo endpoint que "Recaudaciones totales"
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !sessionData.session) {
                console.error('[DASHBOARD] Error de sesión:', sessionError);
                setError('Error de autenticación. Por favor, vuelve a iniciar sesión.');
                toast.error('Error de autenticación');
                setLoading(false);
                return;
            }

            const response = await fetch('/api/admin/revenue', {
                headers: {
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const revenueData = await response.json();

            // Transformar datos al formato esperado
            const transformedStats: DashboardStats = {
                lastUpdate: revenueData.machines[0]?.daily?.updatedAt || revenueData.machines[0]?.monthly?.updatedAt || null,
                totalMachines: revenueData.count || 0,
                activeMachines: revenueData.machines.filter((m: any) => m.status === 'active').length,
                daily: {
                    totalRevenue: revenueData.totals?.daily || 0,
                    totalCard: revenueData.machines.reduce((sum: number, m: any) => sum + (m.daily?.card || 0), 0),
                    totalCash: revenueData.machines.reduce((sum: number, m: any) => sum + (m.daily?.cash || 0), 0),
                    machineCount: revenueData.machines.filter((m: any) => m.daily?.total > 0).length,
                    change: 0 // Calcular tendencia si es necesario
                },
                weekly: {
                    totalRevenue: 0, // No hay datos semanales en este endpoint
                    totalCard: 0,
                    totalCash: 0,
                    machineCount: 0
                },
                monthly: {
                    totalRevenue: revenueData.totals?.monthly || 0,
                    totalCard: revenueData.machines.reduce((sum: number, m: any) => sum + (m.monthly?.card || 0), 0),
                    totalCash: revenueData.machines.reduce((sum: number, m: any) => sum + (m.monthly?.cash || 0), 0),
                    machineCount: revenueData.machines.filter((m: any) => m.monthly?.total > 0).length
                }
            };

            setStats(transformedStats);
            if (showToast) toast.success('Dashboard actualizado');
        } catch (error: any) {
            console.error('Error loading dashboard:', error);
            const errorMessage = error.message || 'Error desconocido al cargar el dashboard';
            setError(errorMessage);
            toast.error('Error al cargar dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        // Auto-refresh cada 5 minutos
        const interval = setInterval(() => loadData(), 5 * 60 * 1000);
        return () => clearInterval(interval);
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
            {/* Header */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm mb-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg">
                                <BarChart3 className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                                Dashboard General
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-zinc-700 ml-14">
                            {stats?.lastUpdate
                                ? `Última actualización: ${format(new Date(stats.lastUpdate), "d 'de' MMMM 'a las' HH:mm", { locale: es })}`
                                : 'Panel de control del negocio'}
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

            {/* Skeleton mientras carga */}
            {loading && !error && (
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <MetricCardSkeleton key={i} />
                        ))}
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <MetricCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            )}

            {/* Mostrar error si hay */}
            {error && !loading && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error al cargar el dashboard
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-zinc-500 mb-4">{error}</p>
                        <Button onClick={() => loadData(true)} variant="outline">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reintentar
                        </Button>
                    </CardContent>
                </Card>
            )}

            <MachineStatusOverview />

            {/* Contenido del dashboard */}
            {stats && !loading && (
                <>
                    {/* Métricas principales - Fila 1 */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {/* Recaudación del día */}
                        <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                                    <Euro className="h-4 w-4" />
                                    Recaudación Hoy
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-3xl font-semibold text-zinc-900">
                                                {stats.daily.totalRevenue.toFixed(2)} €
                                            </p>
                                            {stats.daily.change !== 0 && (
                                                <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${stats.daily.change > 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {stats.daily.change > 0 ? (
                                                        <TrendingUp className="h-4 w-4" />
                                                    ) : (
                                                        <TrendingDown className="h-4 w-4" />
                                                    )}
                                                    {Math.abs(stats.daily.change).toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="h-12 w-12 rounded-lg bg-green-500 flex items-center justify-center">
                                            <Euro className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        {stats.daily.machineCount} máquinas activas
                                    </p>
                                </div>
                            </CardContent>
                        </Card>


                        {/* Recaudación mensual */}
                        <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Recaudación Mes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-3xl font-semibold text-zinc-900">
                                                {stats.monthly.totalRevenue.toFixed(2)} €
                                            </p>
                                        </div>
                                        <div className="h-12 w-12 rounded-lg bg-purple-500 flex items-center justify-center">
                                            <BarChart3 className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        {stats.monthly.machineCount} máquinas
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Máquinas activas */}
                        <Card className="border border-zinc-200 hover:border-zinc-400 transition-all duration-200">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Máquinas Activas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-3xl font-semibold text-zinc-900">
                                                {stats.activeMachines}
                                            </p>
                                        </div>
                                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                                            <CheckCircle className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        Total en sistema
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Desglose de pagos - Fila 2 */}
                    <div className="grid gap-6 md:grid-cols-3">
                        {/* Pagos con Tarjeta (Hoy) */}
                        <Card className="border border-zinc-200 bg-white hover:border-zinc-400 transition-all duration-200">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    Tarjeta (Hoy)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-2xl font-bold text-zinc-900">
                                                {stats.daily.totalCard.toFixed(2)} €
                                            </p>
                                        </div>
                                        <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                                            <CreditCard className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-zinc-600">
                                        {stats.daily.totalRevenue > 0
                                            ? `${((stats.daily.totalCard / stats.daily.totalRevenue) * 100).toFixed(1)}% del total`
                                            : 'Sin datos'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pagos en Efectivo (Hoy) */}
                        <Card className="border border-zinc-200 bg-white hover:border-zinc-400 transition-all duration-200">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                                    <Banknote className="h-4 w-4" />
                                    Efectivo (Hoy)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-2xl font-bold text-zinc-900">
                                                {stats.daily.totalCash.toFixed(2)} €
                                            </p>
                                        </div>
                                        <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                                            <Banknote className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-zinc-600">
                                        {stats.daily.totalRevenue > 0
                                            ? `${((stats.daily.totalCash / stats.daily.totalRevenue) * 100).toFixed(1)}% del total`
                                            : 'Sin datos'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info actualización */}
                        <Card className="border border-zinc-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-zinc-900">
                                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                                        <Clock className="h-4 w-4 text-white" />
                                    </div>
                                    Última Actualización
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-2xl font-bold text-zinc-900">
                                            {stats.lastUpdate
                                                ? format(new Date(stats.lastUpdate), 'HH:mm', { locale: es })
                                                : '--:--'}
                                        </p>
                                        <p className="text-sm text-zinc-500 mt-1">
                                            {stats.lastUpdate
                                                ? format(new Date(stats.lastUpdate), "d 'de' MMMM", { locale: es })
                                                : 'Sin datos'}
                                        </p>
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        💡 Los datos se actualizan automáticamente cada hora
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Nota informativa */}
                    <Card className="border border-blue-200 bg-blue-50/50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                                    <Activity className="h-3 w-3 text-white" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-zinc-900">
                                        Datos en tiempo casi real
                                    </p>
                                    <p className="text-sm text-zinc-600">
                                        El sistema actualiza automáticamente las recaudaciones cada hora mediante scraping programado.
                                        Para ver detalles por máquina, visita la sección de <strong>Recaudaciones Totales</strong>.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Sin datos */}
            {!stats && !loading && !refreshing && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
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
        </div>
    );
}
