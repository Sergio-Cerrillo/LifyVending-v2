'use client';

import { useData } from '@/contexts/data-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  FileText,
  FileCheck,
  DollarSign,
  Users,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DashboardPage() {
  const { getDashboardStats, collections, machines } = useData();
  const stats = getDashboardStats();

  // Datos para el gráfico de recaudaciones por máquina
  const collectionsByMachine = machines.map((machine) => {
    const machineCollections = collections.filter((c) => c.machineId === machine.id);
    const total = machineCollections.reduce((sum, c) => sum + c.totalAmount, 0);
    return {
      name: machine.machineNumber,
      total: total,
    };
  });

  const statCards = [
    {
      title: 'Máquinas Activas',
      value: stats.activeMachines,
      icon: Package,
      description: 'En operación',
      color: 'text-green-600',
    },
    {
      title: 'Facturas Pendientes Revisión',
      value: stats.pendingReviewDocuments,
      icon: FileText,
      description: 'Requieren revisión',
      color: 'text-yellow-600',
    },
    {
      title: 'Facturas Pendientes Contabilizar',
      value: stats.pendingAccountingDocuments,
      icon: FileCheck,
      description: 'Pendientes de contabilizar',
      color: 'text-orange-600',
    },
    {
      title: 'Recaudación del Mes',
      value: `€${stats.monthlyRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: 'Total recaudado',
      color: 'text-blue-600',
    },
    {
      title: 'Nóminas del Mes',
      value: stats.monthlyPayrolls,
      icon: Users,
      description: 'Subidas este mes',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la operación de vending
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recaudación por Máquina</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectionsByMachine}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Máquinas</span>
              <span className="font-bold">{machines.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Con Lector Tarjeta</span>
              <span className="font-bold">
                {machines.filter((m) => m.hasCardReader).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Con Telemetría</span>
              <span className="font-bold">
                {machines.filter((m) => m.hasTelemetry).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Promedio Recaudación</span>
              <span className="font-bold">
                €
                {collections.length > 0
                  ? (
                      collections.reduce((sum, c) => sum + c.totalAmount, 0) /
                      collections.length
                    ).toFixed(2)
                  : '0.00'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
