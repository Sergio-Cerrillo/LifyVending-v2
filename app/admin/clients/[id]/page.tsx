'use client';

/**
 * PÁGINA ADMIN: CONFIGURACIÓN DE CLIENTE
 * 
 * Funcionalidades:
 * - Asignar/desasignar máquinas
 * - Cambiar porcentaje de comisión
 * - Resetear contraseña
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Save, Key, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase-helpers';
import { LoadingInline } from '@/components/ui/loading-screen';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface Machine {
  id: string;
  name: string;
  location: string | null;
  source?: 'orain' | 'televend'; // Fuente de la máquina
}

export default function AdminClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(new Set());
  const [commissionHidePercent, setCommissionHidePercent] = useState<number>(0);
  const [commissionPaymentPercent, setCommissionPaymentPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para resetear contraseña
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

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

      console.log('[LOAD-DATA] Cargando overview para cliente:', clientId);

      // Cargar overview del cliente
      const overviewResponse = await fetch(`/api/admin/clients/${clientId}/overview`, {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });

      console.log('[LOAD-DATA] Respuesta overview:', overviewResponse.status);

      if (!overviewResponse.ok) {
        const errorData = await overviewResponse.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('[LOAD-DATA] Error en overview:', errorData);
        throw new Error(errorData.error || 'Error cargando overview del cliente');
      }

      const overviewData = await overviewResponse.json();
      console.log('[LOAD-DATA] Overview recibido:', overviewData);
      console.log('[LOAD-DATA] commissionHidePercent:', overviewData.client.commissionHidePercent);
      console.log('[LOAD-DATA] commissionPaymentPercent:', overviewData.client.commissionPaymentPercent);
      
      setOverview(overviewData);
      setCommissionHidePercent(overviewData.client.commissionHidePercent);
      setCommissionPaymentPercent(overviewData.client.commissionPaymentPercent);
      setSelectedMachineIds(new Set(overviewData.machines.map((m: Machine) => m.id)));
      
      console.log('[LOAD-DATA] Estados actualizados - Hide:', overviewData.client.commissionHidePercent, 'Payment:', overviewData.client.commissionPaymentPercent);

      // Cargar todas las máquinas disponibles
      const machinesResponse = await fetch('/api/admin/machines', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });

      if (!machinesResponse.ok) {
        throw new Error('Error cargando máquinas');
      }

      const machinesData = await machinesResponse.json();
      setAllMachines(machinesData.machines);

    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    try {
      setSaving(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      // Actualizar porcentajes
      console.log('[SAVE-SETTINGS] Enviando porcentajes:', { 
        commissionHidePercent, 
        commissionPaymentPercent 
      });
      
      const settingsResponse = await fetch(`/api/admin/client-settings/${clientId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          commissionHidePercent,
          commissionPaymentPercent
        })
      });

      console.log('[SAVE-SETTINGS] Respuesta settings:', settingsResponse.status);

      if (!settingsResponse.ok) {
        const errorData = await settingsResponse.json();
        console.error('[SAVE-SETTINGS] Error:', errorData);
        throw new Error('Error actualizando configuración: ' + (errorData.error || 'Unknown'));
      }

      const settingsResult = await settingsResponse.json();
      console.log('[SAVE-SETTINGS] Settings guardados correctamente:', settingsResult);

      // Actualizar asignaciones de máquinas
      const assignmentsResponse = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          machineIds: Array.from(selectedMachineIds)
        })
      });

      if (!assignmentsResponse.ok) {
        throw new Error('Error actualizando asignaciones');
      }

      // Recargar datos
      await loadData();

      // Mostrar mensaje de éxito
      toast.success('Configuración actualizada correctamente', {
        description: `Porcentajes guardados y ${selectedMachineIds.size} máquinas asignadas`,
        duration: 4000
      });

    } catch (err: any) {
      console.error('Error guardando configuración:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    try {
      setResetting(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/admin/users/${clientId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error reseteando contraseña');
      }

      setNewPassword('');
      setResetPasswordOpen(false);
      toast.success('Contraseña reseteada correctamente', {
        duration: 3000
      });

    } catch (err: any) {
      console.error('Error reseteando contraseña:', err);
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  function toggleMachine(machineId: string) {
    const newSelected = new Set(selectedMachineIds);
    if (newSelected.has(machineId)) {
      newSelected.delete(machineId);
    } else {
      newSelected.add(machineId);
    }
    setSelectedMachineIds(newSelected);
  }

  function selectAllMachines() {
    setSelectedMachineIds(new Set(allMachines.map(m => m.id)));
  }

  function deselectAllMachines() {
    setSelectedMachineIds(new Set());
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
    return <LoadingInline message="Cargando configuración..." />;
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Configuración: {overview.client.companyName || overview.client.displayName || overview.client.email}
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {overview.client.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900">
                <Key className="w-4 h-4 mr-2" />
                Resetear Contraseña
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resetear Contraseña</DialogTitle>
                <DialogDescription>
                  Introduce una nueva contraseña temporal para el cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResetPasswordOpen(false)}
                  disabled={resetting}
                  className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={resetting || newPassword.length < 6}
                  className="bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  {resetting ? 'Reseteando...' : 'Resetear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSaveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      {/* Link a Dashboard */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle>Dashboard del Cliente</CardTitle>
          <CardDescription>
            Para ver las estadísticas de recaudación (bruto vs neto), accede al dashboard del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/admin/clients/${clientId}/overview`}>
            <Button variant="outline" className="w-full border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900">
              <TrendingUp className="w-4 h-4 mr-2" />
              Ver Dashboard del Cliente
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Configuración de porcentajes */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Porcentajes</CardTitle>
          <CardDescription>
            Define el porcentaje oculto (usado en cálculos) y el porcentaje de comisión (informativo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Porcentaje Oculto */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="hidePercent" className="text-base font-semibold">Porcentaje Oculto (%)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Este porcentaje se RESTA de la recaudación bruta
                </p>
              </div>
              <Input
                id="hidePercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionHidePercent}
                onChange={(e) => setCommissionHidePercent(parseFloat(e.target.value) || 0)}
                className="text-lg font-medium"
              />
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Ejemplo:</strong><br />
                  Si bruto = 100€ y % oculto = {commissionHidePercent}%<br />
                  → Cliente ve: {formatCurrency(100 * (1 - commissionHidePercent / 100))}
                </p>
              </div>
            </div>

            {/* Porcentaje Comisión */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="paymentPercent" className="text-base font-semibold">Porcentaje Comisión - Pago (%)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo informativo, NO afecta los cálculos del dashboard
                </p>
              </div>
              <Input
                id="paymentPercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionPaymentPercent}
                onChange={(e) => setCommissionPaymentPercent(parseFloat(e.target.value) || 0)}
                className="text-lg font-medium"
              />
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Info:</strong><br />
                  El cliente recibirá el {commissionPaymentPercent}% en el pago.<br />
                  Este valor es solo para tu referencia.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asignación de máquinas */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Asignación de Máquinas</CardTitle>
              <CardDescription>
                Selecciona las máquinas que este cliente podrá ver en su dashboard.
                Las máquinas no seleccionadas no aparecerán en su vista.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className="text-sm">
                {selectedMachineIds.size} de {allMachines.length} seleccionadas
              </Badge>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={selectAllMachines}
                  disabled={selectedMachineIds.size === allMachines.length}
                  className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                >
                  Seleccionar todas
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={deselectAllMachines}
                  disabled={selectedMachineIds.size === 0}
                  className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                >
                  Deseleccionar todas
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allMachines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay máquinas disponibles en el sistema.
            </p>
          ) : (
            <div className="space-y-3">
              {allMachines.map((machine) => {
                const isSelected = selectedMachineIds.has(machine.id);
                const isOrain = machine.source === 'orain';
                return (
                  <div
                    key={machine.id}
                    className={`flex items-center space-x-3 p-3 border rounded-lg transition-all ${
                      isSelected 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'hover:bg-accent'
                    }`}
                  >
                    <Checkbox
                      id={`machine-${machine.id}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleMachine(machine.id)}
                    />
                    <label
                      htmlFor={`machine-${machine.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{machine.name}</span>
                        {machine.source && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${isOrain 
                              ? "bg-blue-50 text-blue-700 border-blue-300" 
                              : "bg-purple-50 text-purple-700 border-purple-300"
                            }`}
                          >
                            {isOrain ? 'Orain-Frekuent' : 'Televend'}
                          </Badge>
                        )}
                      </div>
                      {machine.location && (
                        <div className="text-sm text-muted-foreground">{machine.location}</div>
                      )}
                    </label>
                    {isSelected && (
                      <Badge variant="default" className="text-xs">Asignada</Badge>
                    )}
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
