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
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Facturas Pendientes Revisión',
      value: stats.pendingReviewDocuments,
      icon: FileText,
      description: 'Requieren revisión',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Facturas Pendientes Contabilizar',
      value: stats.pendingAccountingDocuments,
      icon: FileCheck,
      description: 'Pendientes de contabilizar',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Recaudación del Mes',
      value: `€${stats.monthlyRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: 'Total recaudado',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Nóminas del Mes',
      value: stats.monthlyPayrolls,
      icon: Users,
      description: 'Subidas este mes',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header mejorado */}
      <div className="bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
            <p className="text-zinc-700 font-medium mt-1">
              Resumen general de la operación de vending
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-white border-2 border-zinc-100 hover:border-emerald-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-zinc-700">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-900">{stat.value}</div>
              <p className="text-xs font-medium text-zinc-600 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white border border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border-b border-emerald-100">
            <CardTitle className="text-zinc-900 font-bold">Recaudación por Máquina</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectionsByMachine}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                <XAxis dataKey="name" stroke="#52525b" />
                <YAxis stroke="#52525b" />
                <Tooltip />
                <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border-b border-emerald-100">
            <CardTitle className="text-zinc-900 font-bold">Resumen Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex justify-between items-center p-3 bg-gradient-to-br from-zinc-50 to-emerald-50/30 rounded-lg border border-emerald-100">
              <span className="text-sm font-semibold text-zinc-700">Total Máquinas</span>
              <span className="font-bold text-lg text-zinc-900">{machines.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-br from-zinc-50 to-blue-50/30 rounded-lg border border-blue-100">
              <span className="text-sm font-semibold text-zinc-700">Con Lector Tarjeta</span>
              <span className="font-bold text-lg text-zinc-900">
                {machines.filter((m) => m.hasCardReader).length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-br from-zinc-50 to-purple-50/30 rounded-lg border border-purple-100">
              <span className="text-sm font-semibold text-zinc-700">Con Telemetría</span>
              <span className="font-bold text-lg text-zinc-900">
                {machines.filter((m) => m.hasTelemetry).length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-br from-zinc-50 to-amber-50/30 rounded-lg border border-amber-100">
              <span className="text-sm font-semibold text-zinc-700">Promedio Recaudación</span>
              <span className="font-bold text-lg text-zinc-900">
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
