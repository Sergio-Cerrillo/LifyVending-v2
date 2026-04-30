'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingCard, Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PackageSearch,
  Download,
  RefreshCw,
  Search,
  Loader2,
  TrendingUp,
  Package,
  AlertCircle,
  MapPin,
  Eye,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Clock,
  Box,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { MachineStock, StockSummary, StockProduct } from '@/lib/types';

export function StockPage() {
  const [machines, setMachines] = useState<MachineStock[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [selectedMachineForDetails, setSelectedMachineForDetails] = useState<MachineStock | null>(null);
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [lastScrape, setLastScrape] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [search, setSearch] = useState('');
  const [sortType, setSortType] = useState<'alphabetic' | 'priority'>('alphabetic');
  const [showOnlyEmptyLanes, setShowOnlyEmptyLanes] = useState(false);

  // Cargar estado inicial
  useEffect(() => {
    loadStatus();
  }, []);

  // Cargar datos cuando cambien las máquinas seleccionadas
  useEffect(() => {
    if (selectedMachines.length > 0) {
      loadData(selectedMachines);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachines]);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/admin/stock?action=status');

      if (!response.ok) {
        console.error('Error loading status:', response.status);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Response is not JSON');
        return;
      }

      const data = await response.json();

      setIsScraping(false); // Ya no se hace scraping manual
      setLastScrape(data.lastScrape ? new Date(data.lastScrape) : null);

      if (data.hasData) {
        loadData();
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const loadData = async (machineIds?: string[]) => {
    setIsLoading(true);
    try {
      const params = machineIds ? `?action=data&machines=${machineIds.join(',')}` : '?action=data';
      const response = await fetch(`/api/admin/stock${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }

      const data = await response.json();

      if (machineIds) {
        setSummary(data.summary || []);
        setStats(data.stats || null);
      } else {
        setMachines(data.machines || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      toast.error('Error cargando datos de stock');
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función eliminada - el scraping ahora es automático cada 30 min vía CRON

  const toggleMachine = (machineId: string) => {
    setSelectedMachines((prev) =>
      prev.includes(machineId)
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId]
    );
  };

  const toggleAll = () => {
    if (selectedMachines.length === filteredMachines.length) {
      setSelectedMachines([]);
    } else {
      setSelectedMachines(filteredMachines.map((m) => m.machineId));
    }
  };

  const exportToCSV = () => {
    if (summary.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = ['Producto', 'Categoría', 'Total a Reponer', 'Nº Máquinas'];
    const rows = summary.map((item) => [
      item.productName,
      item.category || '',
      item.totalUnitsToReplenish,
      item.machineCount,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock-resumen-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    link.click();

    toast.success('CSV exportado correctamente');
  };

  const exportToJSON = () => {
    if (summary.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const json = JSON.stringify(summary, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock-resumen-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    link.click();

    toast.success('JSON exportado correctamente');
  };

  // Función para calcular fillRate de una máquina de forma segura
  const calculateFillRate = (machine: MachineStock): number => {
    if (!machine.products || machine.products.length === 0) {
      return 0;
    }

    let totalRate = 0;
    let validProducts = 0;

    for (const product of machine.products) {
      // Solo considerar productos con capacidad válida
      if (product.totalCapacity > 0) {
        const rate = (product.availableUnits / product.totalCapacity) * 100;
        if (!isNaN(rate) && isFinite(rate)) {
          totalRate += rate;
          validProducts++;
        }
      }
    }

    // Si no hay productos válidos, retornar 0
    if (validProducts === 0) return 0;

    return totalRate / validProducts;
  };

  const filteredMachines = machines
    .filter((machine) => {
      // Filtro de búsqueda
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = (
          machine.machineName.toLowerCase().includes(searchLower) ||
          machine.machineId.toLowerCase().includes(searchLower) ||
          machine.location?.toLowerCase().includes(searchLower)
        );
        if (!matchesSearch) return false;
      }

      // Filtro de carriles vacíos
      if (showOnlyEmptyLanes) {
        const hasEmptyLanes = machine.products.some(p => p.availableUnits === 0);
        if (!hasEmptyLanes) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortType === 'alphabetic') {
        // Ordenar alfabéticamente por nombre
        return a.machineName.localeCompare(b.machineName);
      } else {
        // Ordenar por prioridad (fillRate ascendente - más vacías primero)
        const fillRateA = calculateFillRate(a);
        const fillRateB = calculateFillRate(b);

        return fillRateA - fillRateB;
      }
    });

  const showSummary = selectedMachines.length > 0;

  // Función para detectar productos sin stock
  const hasOutOfStockProducts = (products: StockProduct[]) => {
    return products.some(p => p.availableUnits === 0);
  };

  // Función para contar productos sin stock
  const countOutOfStockProducts = (products: StockProduct[]) => {
    return products.filter(p => p.availableUnits === 0).length;
  };

  // Función para obtener el badge de urgencia basado en el fillRate
  const getUrgencyBadge = (fillRate: number) => {
    if (fillRate < 30) {
      return {
        label: 'CRÍTICO',
        icon: AlertTriangle,
        variant: 'destructive' as const,
        className: 'bg-red-600 text-white border-red-600',
        borderColor: 'border-red-300',
        progressColor: 'bg-red-600',
      };
    } else if (fillRate < 50) {
      return {
        label: 'URGENTE',
        icon: Zap,
        variant: 'default' as const,
        className: 'bg-orange-500 text-white border-orange-500',
        borderColor: 'border-orange-300',
        progressColor: 'bg-orange-500',
      };
    } else if (fillRate < 70) {
      return {
        label: 'REVISAR',
        icon: Clock,
        variant: 'secondary' as const,
        className: 'bg-yellow-500 text-white border-yellow-500',
        borderColor: 'border-yellow-300',
        progressColor: 'bg-yellow-500',
      };
    } else {
      return {
        label: 'BIEN',
        icon: CheckCircle2,
        variant: 'outline' as const,
        className: 'bg-green-600 text-white border-green-600',
        borderColor: 'border-green-300',
        progressColor: 'bg-green-600',
      };
    }
  };

  // Componente de Skeleton para cargar
  const MachineCardSkeleton = () => (
    <Card className="border border-zinc-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-10 w-full mt-4" />
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
              <PackageSearch className="h-7 w-7 text-zinc-900" />
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Gestión de Stock
              </h1>
            </div>
            <p className="text-sm text-zinc-600">
              Preparación de furgoneta de reparto · Actualización automática cada 30 minutos
            </p>
            {lastScrape && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Última actualización: {format(lastScrape, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                loadStatus();
                if (machines.length > 0) {
                  loadData();
                }
              }}
              disabled={isLoading}
              className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
          </div>
        </div>
      </div>

      {/* Banner de sumatorio cuando hay máquinas seleccionadas */}
      {showSummary && stats && (
        <Card className="border border-zinc-200 bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-zinc-900 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">Lista de Reposición</h3>
                  <p className="text-sm text-zinc-600 flex items-center gap-1">
                    <Box className="h-3 w-3" />
                    {selectedMachines.length} {selectedMachines.length === 1 ? 'máquina seleccionada' : 'máquinas seleccionadas'}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-3xl font-semibold text-zinc-900">
                    {stats.totalUnitsToReplenish}
                  </p>
                  <p className="text-xs text-zinc-500 font-medium">UNIDADES A REPONER</p>
                </div>
                <Separator orientation="vertical" className="h-auto" />
                <div className="text-center">
                  <p className="text-3xl font-semibold text-zinc-900">{summary.length}</p>
                  <p className="text-xs text-zinc-500 font-medium">PRODUCTOS DISTINTOS</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToJSON}
                  className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                >
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && !isScraping && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Máquinas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.machineCount}</div>
              <p className="text-xs text-muted-foreground">
                {selectedMachines.length > 0 ? `${selectedMachines.length} seleccionadas` : 'Total'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Reponer</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUnitsToReplenish}</div>
              <p className="text-xs text-muted-foreground">unidades totales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacidad</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCapacity}</div>
              <p className="text-xs text-muted-foreground">unidades totales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Llenado</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.fillRate}%</div>
              <p className="text-xs text-muted-foreground">promedio</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skeleton mientras carga */}
      {isScraping && (
        <LoadingCard
          title="Extrayendo datos de Orain-Frekuent"
          description="Esto puede tardar varios minutos"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <MachineCardSkeleton key={i} />
            ))}
          </div>
        </LoadingCard>
      )}

      {machines.length === 0 && !isLoading && !isScraping && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay datos de stock disponibles</h3>
            <p className="text-muted-foreground text-center mb-4">
              Los datos de stock se actualizan automáticamente cada 30 minutos
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {lastScrape ? (
                <span>Última actualización: {format(lastScrape, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              ) : (
                <span>Esperando primera actualización automática</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {machines.length > 0 && !isScraping && (
        <>
          {/* Buscador, filtros y ordenamiento */}
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar máquinas por nombre, ID o ubicación..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" onClick={toggleAll} className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900">
                {selectedMachines.length === filteredMachines.length
                  ? 'Deseleccionar Todas'
                  : 'Seleccionar Todas'}
              </Button>
            </div>

            {/* Botones de filtrado y ordenamiento */}
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-2">
                <Button
                  variant={sortType === 'alphabetic' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortType('alphabetic')}
                  className={sortType === 'alphabetic'
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900'
                  }
                >
                  Alfabético
                </Button>
                <Button
                  variant={sortType === 'priority' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortType('priority')}
                  className={sortType === 'priority'
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900'
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Por Prioridad
                </Button>
              </div>

              <div className="h-6 w-px bg-zinc-200" />

              <Button
                variant={showOnlyEmptyLanes ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOnlyEmptyLanes(!showOnlyEmptyLanes)}
                className={showOnlyEmptyLanes
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900'
                }
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Solo con Carriles Vacíos
                {showOnlyEmptyLanes && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white text-zinc-900 rounded text-xs font-semibold">
                    {filteredMachines.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Resumen de productos (si hay máquinas seleccionadas) */}
          {showSummary && summary.length > 0 && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Lista de Compra
                </CardTitle>
                <CardDescription>
                  Productos consolidados para llevar en la furgoneta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {summary.map((item, index) => (
                    <Card key={index} className="border-2 hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          {/* Header del producto */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm line-clamp-2 mb-1 break-words leading-tight">
                                {item.productName}
                              </h4>
                              {item.category && (
                                <Badge variant="secondary" className="text-xs break-words">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            <div className="text-center shrink-0">
                              <div className="text-2xl font-bold text-primary">
                                {item.totalUnitsToReplenish}
                              </div>
                              <div className="text-xs text-muted-foreground">unidades</div>
                            </div>
                          </div>

                          <Separator />

                          {/* Máquinas */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                              Para {item.machineNames.length} {item.machineNames.length === 1 ? 'máquina' : 'máquinas'}:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {item.machineNames.slice(0, 3).map((machineName, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs break-words max-w-[150px] line-clamp-1">
                                  {machineName}
                                </Badge>
                              ))}
                              {item.machineNames.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{item.machineNames.length - 3} más
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid de máquinas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Máquinas</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredMachines.length} {filteredMachines.length === 1 ? 'máquina' : 'máquinas'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMachines.map((machine) => {
                const totalToReplenish = machine.products.reduce(
                  (sum, p) => sum + p.unitsToReplenish,
                  0
                );
                const isSelected = selectedMachines.includes(machine.machineId);
                const fillRate = calculateFillRate(machine);

                const urgencyBadge = getUrgencyBadge(fillRate);
                const hasOutOfStock = hasOutOfStockProducts(machine.products);
                const outOfStockCount = countOutOfStockProducts(machine.products);
                const UrgencyIcon = urgencyBadge.icon;

                return (
                  <Card
                    key={machine.machineId}
                    className={`relative transition-all duration-200 hover:shadow-md cursor-pointer group border flex flex-col ${isSelected
                        ? 'border-zinc-900 shadow-sm'
                        : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                  >
                    {/* Checkbox de selección */}
                    <div
                      className="absolute top-3 right-3 z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMachine(machine.machineId);
                      }}
                    >
                      <div className={`
                        p-1.5 rounded transition-all border flex items-center justify-center
                        ${isSelected
                          ? 'bg-zinc-900 border-zinc-900'
                          : 'bg-white border-zinc-300 hover:bg-zinc-50'}
                      `}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMachine(machine.machineId)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>

                    {/* Card clickeable para ver detalles */}
                    <div onClick={() => setSelectedMachineForDetails(machine)} className="relative h-full flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="pr-12">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className={urgencyBadge.className}>
                              <UrgencyIcon className="h-3 w-3 mr-1" />
                              {urgencyBadge.label}
                            </Badge>
                            {hasOutOfStock && (
                              <Badge className="bg-zinc-900 text-white border-zinc-900">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {outOfStockCount} SIN STOCK
                              </Badge>
                            )}
                          </div>
                          <div className="min-h-[3rem] flex items-center">
                            <CardTitle className="text-base font-semibold text-zinc-900 leading-snug">
                              {machine.machineName}
                            </CardTitle>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 relative flex-1 flex flex-col">
                        {/* Estadísticas con diseño moderno */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              Productos
                            </span>
                            <Badge variant="secondary" className="font-bold">
                              {machine.products.length}
                            </Badge>
                          </div>

                          <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" />
                              A reponer
                            </span>
                            <Badge
                              className={totalToReplenish > 0 ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}
                            >
                              {totalToReplenish} unidades
                            </Badge>
                          </div>

                          <div className="flex justify-between items-center bg-zinc-50 p-2 rounded">
                            <span className="text-sm text-zinc-600">Nivel de llenado</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all rounded-full ${urgencyBadge.progressColor}`}
                                  style={{ width: `${fillRate}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-zinc-900">
                                {isNaN(fillRate) || !isFinite(fillRate) ? '0' : fillRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón de ver detalles */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-auto border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMachineForDetails(machine);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Dialog de detalles de máquina */}
      <Dialog open={!!selectedMachineForDetails} onOpenChange={(open) => !open && setSelectedMachineForDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedMachineForDetails && (() => {
            const machineDetailsFillRate = calculateFillRate(selectedMachineForDetails);

            const urgencyBadge = getUrgencyBadge(machineDetailsFillRate);
            const UrgencyIcon = urgencyBadge.icon;
            const hasOutOfStock = hasOutOfStockProducts(selectedMachineForDetails.products);
            const outOfStockCount = countOutOfStockProducts(selectedMachineForDetails.products);
            const outOfStockProducts = selectedMachineForDetails.products.filter(p => p.availableUnits === 0);

            return (
              <>
                <DialogHeader className="border-b pb-4">
                  <div className="flex items-start justify-between gap-4 pr-8">
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-3xl mb-3 font-bold break-words leading-tight">
                        {selectedMachineForDetails.machineName}
                      </DialogTitle>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Badge className={`${urgencyBadge.className} text-base px-4 py-1.5 whitespace-nowrap`}>
                        <UrgencyIcon className="h-4 w-4 mr-1.5" />
                        {urgencyBadge.label}
                      </Badge>
                      {hasOutOfStock && (
                        <Badge className="bg-red-100 text-red-700 border-2 border-red-300 font-bold text-sm px-3 py-1 whitespace-nowrap">
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          {outOfStockCount} SIN STOCK
                        </Badge>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Resumen compacto */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                      <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
                      <p className="text-2xl font-bold">{selectedMachineForDetails.products.length}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">Productos</p>
                    </div>
                    <div className="bg-red-500/5 border border-red-200 rounded-lg p-3 text-center">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-red-600" />
                      <p className="text-2xl font-bold text-red-600">
                        {selectedMachineForDetails.products.reduce((sum, p) => sum + p.unitsToReplenish, 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">A Reponer</p>
                    </div>
                    <div className="bg-blue-500/5 border border-blue-200 rounded-lg p-3 text-center">
                      <Box className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                      <p className="text-2xl font-bold">
                        {selectedMachineForDetails.products.reduce((sum, p) => sum + p.totalCapacity, 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">Capacidad</p>
                    </div>
                  </div>

                  {/* Alerta de productos sin stock */}
                  {hasOutOfStock && (
                    <div className="border-2 border-red-300 bg-red-50 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-red-900 break-words">
                            {outOfStockCount} {outOfStockCount === 1 ? 'Producto sin stock' : 'Productos sin stock'}
                          </h4>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {outOfStockProducts.map((product, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs font-medium break-words">
                                {product.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Lista de productos */}
                  <div>
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Inventario Completo ({selectedMachineForDetails.products.length} productos)
                    </h3>
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2">
                      {selectedMachineForDetails.products.map((product, idx) => {
                        const needsReplenishment = product.unitsToReplenish > 0;
                        const stockPercentage = (product.availableUnits / product.totalCapacity) * 100;
                        const isOutOfStock = product.availableUnits === 0;

                        return (
                          <div
                            key={idx}
                            className={`border-l-4 rounded-md p-3 transition-all ${isOutOfStock
                                ? 'border-red-500 bg-red-50'
                                : needsReplenishment
                                  ? 'border-orange-400 bg-orange-50/50'
                                  : 'border-green-500 bg-green-50/30'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Nombre y categoría */}
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                {isOutOfStock ? (
                                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                ) : needsReplenishment ? (
                                  <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm break-words leading-tight">{product.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {product.category && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {product.category}
                                      </Badge>
                                    )}
                                    {product.line && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        L{product.line}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Stats y barra */}
                              <div className="shrink-0 flex items-center gap-3">
                                {/* Cantidad a reponer */}
                                {needsReplenishment && (
                                  <div className="text-center bg-red-100 rounded px-2 py-1">
                                    <div className="text-base font-bold text-red-600">+{product.unitsToReplenish}</div>
                                    <div className="text-[9px] text-red-700">Reponer</div>
                                  </div>
                                )}

                                {/* Stock actual */}
                                <div className="text-center">
                                  <div className="text-sm font-bold">
                                    {product.availableUnits}/{product.totalCapacity}
                                  </div>
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                      className={`h-full transition-all ${stockPercentage >= 80 ? 'bg-green-500' :
                                          stockPercentage >= 50 ? 'bg-yellow-400' :
                                            stockPercentage > 0 ? 'bg-orange-500' :
                                              'bg-red-600'
                                        }`}
                                      style={{ width: `${stockPercentage}%` }}
                                    />
                                  </div>
                                  <div className={`text-[10px] font-semibold mt-0.5 ${stockPercentage >= 80 ? 'text-green-600' :
                                      stockPercentage >= 50 ? 'text-yellow-600' :
                                        stockPercentage > 0 ? 'text-orange-600' :
                                          'text-red-600'
                                    }`}>
                                    {stockPercentage.toFixed(0)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
