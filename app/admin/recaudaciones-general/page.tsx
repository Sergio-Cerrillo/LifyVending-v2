'use client';

/**
 * PÁGINA ADMIN: RECAUDACIONES GENERALES
 * 
 * Vista general de todas las recaudaciones del sistema
 * - Tabla con todas las máquinas y sus recaudaciones
 * - Totales por periodo (diario, mensual)
 * - Datos actualizados automáticamente cada hora via CRON
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, DollarSign, TrendingUp, Loader2, EuroIcon, Zap, Clock } from 'lucide-react';
import { LoadingInline } from '@/components/ui/loading-screen';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase-helpers';
import { LoadingCard, Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MachineRevenue {
    id: string;
    name: string;
    location: string | null;
    status: string;
    lastScraped: string | null;
    source: 'orain' | 'televend'; // Fuente de la máquina
    daily: {
        total: number;
        card: number;
        cash: number;
        updatedAt: string | null;
    };
    monthly: {
        total: number;
        card: number;
        cash: number;
        updatedAt: string | null;
    };
}

interface RevenueData {
    machines: MachineRevenue[];
    totals: {
        daily: number;
        monthly: number;
    };
    totalsOrain: {
        daily: number;
        monthly: number;
    };
    totalsTelevend: {
        daily: number;
        monthly: number;
    };
    count: number;
    countOrain: number;
    countTelevend: number;
}

export default function AdminRevenueGeneralPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly'>('daily');
    const [isScraping, setIsScraping] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);

    // Check if manual scraping is enabled (only for local development)
    const enableManualScraping = process.env.NEXT_PUBLIC_ENABLE_MANUAL_SCRAPING === 'true';

    useEffect(() => {
        loadRevenueData();
    }, []);

    async function loadRevenueData() {
        try {
            setLoading(true);
            setError(null);

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            console.log('[RECAUDACIONES] Sesión:', !!sessionData.session, 'Error:', sessionError?.message);

            if (sessionError || !sessionData.session) {
                console.error('[RECAUDACIONES] Sin sesión válida, redirigiendo a login');
                toast.error('Sesión expirada. Por favor, inicia sesión de nuevo.');
                router.push('/login');
                return;
            }

            console.log('[RECAUDACIONES] Haciendo petición a /api/admin/revenue');

            const response = await fetch('/api/admin/revenue', {
                headers: {
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                }
            });

            console.log('[RECAUDACIONES] Respuesta:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('[RECAUDACIONES] Error del servidor:', errorData);
                throw new Error(errorData.error || `Error HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[RECAUDACIONES] Datos recibidos:', data.count, 'máquinas');
            setRevenueData(data);
            setLastUpdate(data.lastUpdate);

        } catch (err: any) {
            console.error('[RECAUDACIONES] Error completo:', err);
            setError(err.message);
            toast.error('Error cargando recaudaciones', {
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    }

    async function runScraping() {
        try {
            setIsScraping(true);
            toast.info('Iniciando scraping de recaudaciones...');

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !sessionData.session) {
                router.push('/login');
                return;
            }

            const response = await fetch('/api/admin/scrape', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('[SCRAPE] Error del servidor:', errorData);
                throw new Error(errorData.error || `Error HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[SCRAPE] Resultado:', data);
            toast.success(`Scraping completado: ${data.machines_updated || 0} máquinas actualizadas`);
            
            // Recargar datos
            await loadRevenueData();

        } catch (err: any) {
            console.error('[SCRAPE] Error completo:', err);
            toast.error('Error ejecutando scraping', {
                description: err.message || 'Error desconocido',
                duration: 6000
            });
        } finally {
            setIsScraping(false);
        }
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return 'Sin datos';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    // Componente de Skeleton para las tablas
    const TableRowSkeleton = () => (
        <TableRow>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
        </TableRow>
    );

    if (loading) {
        return <LoadingInline message="Cargando recaudaciones..." />;
    }

    return (
        <div className="space-y-6">
            {/* Header mejorado */}
            <div className="bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                                <EuroIcon className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Recaudaciones Generales</h1>
                            {!enableManualScraping && (
                                <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                                    Solo lectura
                                </Badge>
                            )}
                            {enableManualScraping && (
                                <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 font-semibold">
                                    Modo Desarrollo
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-zinc-700 ml-14">
                            Vista global de todas las máquinas del sistema • Datos de base de datos
                        </p>
                        {lastUpdate && (
                            <p className="text-xs font-medium text-emerald-600 mt-2 ml-14">
                                <Clock className="inline h-3 w-3 mr-1" />
                                Última actualización: {formatDate(lastUpdate)}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {enableManualScraping && (
                            <Button
                                variant="default"
                                size="default"
                                onClick={runScraping}
                                disabled={isScraping || loading}
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md font-semibold"
                            >
                                {isScraping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Scrapeando...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4" />
                                        Actualizar Recaudaciones
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="default"
                            onClick={loadRevenueData}
                            disabled={loading || isScraping}
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors font-semibold"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refrescar
                        </Button>
                    </div>
                </div>
            </div>

            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Tarjetas de Totales - Separadas por fuente */}
            {revenueData && (<>
                {/* Totales Generales */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-zinc-700">Total Diario (Hoy)</CardTitle>
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <DollarSign className="h-5 w-5 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-zinc-900">
                                {formatCurrency(revenueData?.totals.daily || 0)}
                            </div>
                            <p className="text-xs font-semibold text-zinc-600 mt-1">
                                {revenueData?.count || 0} máquinas
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50/50 to-white shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-zinc-700">Total Mensual</CardTitle>
                            <div className="p-2 bg-teal-100 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-teal-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-zinc-900">
                                {formatCurrency(revenueData?.totals.monthly || 0)}
                            </div>
                            <p className="text-xs font-semibold text-zinc-600 mt-1">
                                Combinado
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tarjetas separadas por fuente */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Orain-Frekuent - Este mes */}
                    <Card className="border-2 border-blue-200 bg-blue-50/30">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-blue-900">
                                    Máquinas Orain-Frekuent
                                </CardTitle>
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                    Este mes
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div>
                                <p className="text-xs text-blue-600 mb-1">Diario (Hoy)</p>
                                <div className="text-2xl font-semibold text-blue-900">
                                    {formatCurrency(revenueData?.totalsOrain.daily || 0)}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-blue-600 mb-1">Mensual</p>
                                <div className="text-2xl font-semibold text-blue-900">
                                    {formatCurrency(revenueData?.totalsOrain.monthly || 0)}
                                </div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                                {revenueData?.countOrain || 0} máquinas
                            </p>
                        </CardContent>
                    </Card>

                    {/* Televend - Últimos 30 días */}
                    <Card className="border-2 border-purple-200 bg-purple-50/30">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-purple-900">
                                    Máquinas Televend
                                </CardTitle>
                                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                                    Últimos 30 días
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div>
                                <p className="text-xs text-purple-600 mb-1">Diario (Hoy)</p>
                                <div className="text-2xl font-semibold text-purple-900">
                                    {formatCurrency(revenueData?.totalsTelevend.daily || 0)}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-purple-600 mb-1">Últimos 30 días</p>
                                <div className="text-2xl font-semibold text-purple-900">
                                    {formatCurrency(revenueData?.totalsTelevend.monthly || 0)}
                                </div>
                            </div>
                            <p className="text-xs text-purple-600 mt-2">
                                {revenueData?.countTelevend || 0} máquinas
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </>)}

            {/* Tabla de Máquinas */}
            {!isScraping && (<Card className="border border-zinc-200 bg-white">
                <CardHeader>
                    <CardTitle className="text-zinc-900">Detalle por Máquina</CardTitle>
                    <CardDescription className="text-zinc-600">
                        Recaudaciones brutas de cada máquina
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="daily">Diario (Hoy)</TabsTrigger>
                            <TabsTrigger value="monthly">Mensual (Mixto)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="daily" className="mt-4">
                            <MachineTable
                                machines={revenueData?.machines || []}
                                period="daily"
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                            />
                        </TabsContent>

                        <TabsContent value="monthly" className="mt-4">
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                <p className="text-sm text-amber-800">
                                    ⚠️ <strong>Nota:</strong> Orain-Frekuent muestra datos de <strong>"Este mes"</strong> (mes calendario),
                                    mientras que Televend muestra <strong>"Últimos 30 días"</strong> (rolling).
                                </p>
                            </div>
                            <MachineTable
                                machines={revenueData?.machines || []}
                                period="monthly"
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>)}
        </div>
    );
}

interface MachineTableProps {
    machines: MachineRevenue[];
    period: 'daily' | 'monthly';
    formatCurrency: (amount: number) => string;
    formatDate: (dateString: string | null) => string;
}

function MachineTable({ machines, period, formatCurrency, formatDate }: MachineTableProps) {
    return (
        <div className="rounded-lg border border-zinc-200 overflow-hidden bg-white">
            <Table>
                <TableHeader>
                    <TableRow className="bg-zinc-50 border-b border-zinc-200 hover:bg-zinc-50">
                        <TableHead className="font-semibold text-zinc-900">Máquina</TableHead>
                        <TableHead className="font-semibold text-zinc-900">Fuente</TableHead>
                        <TableHead className="font-semibold text-zinc-900">Ubicación</TableHead>
                        <TableHead className="text-right font-semibold text-zinc-900">Total</TableHead>
                        <TableHead className="font-semibold text-zinc-900">Última Actualización</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {machines.length === 0 ? (
                        <TableRow className="hover:bg-white">
                            <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                                No hay datos de recaudación disponibles. Los datos se actualizan automáticamente cada hora.
                            </TableCell>
                        </TableRow>
                    ) : (
                        machines.map((machine) => {
                            const data = machine[period];
                            const isOrain = machine.source === 'orain';

                            return (
                                <TableRow 
                                    key={machine.id}
                                    className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                                >
                                    <TableCell className="font-medium text-zinc-900">{machine.name}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={isOrain
                                                ? "bg-blue-100 text-blue-800 border-blue-300 font-medium"
                                                : "bg-purple-100 text-purple-800 border-purple-300 font-medium"
                                            }
                                        >
                                            {isOrain ? 'Orain-Frekuent' : 'Televend'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-zinc-700">{machine.location || 'Sin ubicación'}</TableCell>
                                    <TableCell className="text-right font-bold text-zinc-900 text-base">
                                        {formatCurrency(data.total)}
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-600">
                                        {formatDate(data.updatedAt)}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
