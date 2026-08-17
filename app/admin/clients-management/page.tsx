'use client';

/**
 * PÁGINA ADMIN: GESTIÓN DE USUARIOS
 * 
 * Funcionalidades:
 * - Listar clientes y reponedores
 * - Crear nuevos usuarios
 * - Acceso rápido a configuración de cada cliente
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Settings, User, Building, Eye, Trash2, Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase-helpers';
import { fetchWithTimeout, withTimeout } from '@/lib/client-timeouts';
import { LoadingInline } from '@/components/ui/loading-screen';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ManagedUser {
  id: string;
  email: string;
  role: 'client' | 'reponedor';
  display_name: string | null;
  company_name: string | null;
  created_at: string;
  machineCount: number;
  routeCount: number;
  commissionHidePercent: number;
  commissionPaymentPercent: number;
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estado del diálogo de creación
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({
    role: 'client' as 'client' | 'reponedor',
    email: '',
    password: '',
    displayName: '',
    companyName: '',
    commissionHidePercent: '30',
    commissionPaymentPercent: '15'
  });

  // Estado del diálogo de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        10_000,
        'No se pudo validar la sesión',
      );

      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      const response = await fetchWithTimeout('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      }, 30_000);

      if (!response.ok) {
        throw new Error('Error cargando usuarios');
      }

      const data = await response.json();
      setClients(data.users || []);

    } catch (err: any) {
      console.error('Error cargando usuarios:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClient() {
    try {
      setCreating(true);
      setError(null);

      const { data: sessionData } = await withTimeout(
        supabase.auth.getSession(),
        10_000,
        'No se pudo validar la sesión',
      );

      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const payload = {
        role: newClient.role,
        email: newClient.email,
        password: newClient.password,
        displayName: newClient.displayName || null,
        companyName: newClient.companyName || null,
        commissionHidePercent: Number.isFinite(parseFloat(newClient.commissionHidePercent))
          ? parseFloat(newClient.commissionHidePercent)
          : 30,
        commissionPaymentPercent: Number.isFinite(parseFloat(newClient.commissionPaymentPercent))
          ? parseFloat(newClient.commissionPaymentPercent)
          : 15
      };

      const response = await fetchWithTimeout('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 30_000);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creando usuario');
      }

      const result = await response.json();
      console.log('[USER-CREATED] Usuario creado:', result);

      // Limpiar formulario y cerrar diálogo
      setNewClient({
        role: 'client',
        email: '',
        password: '',
        displayName: '',
        companyName: '',
        commissionHidePercent: '30',
        commissionPaymentPercent: '15'
      });
      setDialogOpen(false);

      // Mostrar mensaje de éxito
      toast.success(newClient.role === 'reponedor' ? 'Reponedor creado' : 'Cliente creado exitosamente', {
        description: newClient.role === 'reponedor'
          ? 'Ya puedes asignarle rutas desde Gestión de Rutas'
          : 'Ya puedes asignarle máquinas desde su página de configuración',
        duration: 4000
      });

      // Recargar lista
      await loadClients();

    } catch (err: any) {
      console.error('Error creando usuario:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteClient() {
    if (!clientToDelete) return;

    try {
      setDeleting(true);
      setError(null);

      const { data: sessionData } = await withTimeout(
        supabase.auth.getSession(),
        10_000,
        'No se pudo validar la sesión',
      );

      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      console.log('[DELETE-CLIENT] Intentando eliminar cliente:', clientToDelete.id);

      const response = await fetchWithTimeout(`/api/admin/users/${clientToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      }, 30_000);

      console.log('[DELETE-CLIENT] Respuesta del servidor:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[DELETE-CLIENT] Error del servidor:', errorData);
        throw new Error(errorData.error || 'Error eliminando cliente');
      }

      const result = await response.json();
      console.log('[DELETE-CLIENT] Cliente eliminado exitosamente:', result);

      // Cerrar diálogo y limpiar estado
      setDeleteDialogOpen(false);
      setClientToDelete(null);

      // Mostrar mensaje de éxito
      toast.success('Usuario eliminado correctamente', {
        description: `"${clientToDelete.company_name || clientToDelete.email}" ha sido eliminado del sistema`,
        duration: 4000
      });

      // Recargar lista
      await loadClients();

    } catch (err: any) {
      console.error('Error eliminando cliente:', err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openDeleteDialog(client: ManagedUser) {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  if (loading) {
    return <LoadingInline message="Cargando usuarios..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header mejorado */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg">
                <Building className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Gestión de Usuarios</h1>
            </div>
            <p className="text-sm font-medium text-zinc-700 ml-14">
              Crea clientes y reponedores para operar la plataforma
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Elige si quieres crear un cliente o un reponedor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setNewClient({ ...newClient, role: 'client' })}
                    className={`rounded-lg px-3 py-2 text-sm font-black transition ${newClient.role === 'client' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClient({ ...newClient, role: 'reponedor', companyName: '' })}
                    className={`rounded-lg px-3 py-2 text-sm font-black transition ${newClient.role === 'reponedor' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  >
                    Reponedor
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Nombre</Label>
                  <Input
                    id="displayName"
                    placeholder="Nombre del contacto"
                    value={newClient.displayName}
                    onChange={(e) => setNewClient({ ...newClient, displayName: e.target.value })}
                  />
                </div>

                {newClient.role === 'client' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Empresa</Label>
                      <Input
                        id="companyName"
                        placeholder="Nombre de la empresa"
                        value={newClient.companyName}
                        onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="commissionHidePercent">Porcentaje Oculto (%)</Label>
                      <Input
                        id="commissionHidePercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newClient.commissionHidePercent}
                        onChange={(e) => setNewClient({ ...newClient, commissionHidePercent: e.target.value })}
                      />
                      <p className="text-xs text-zinc-500">
                        Porcentaje interno aplicado antes de mostrar importes al cliente.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="commissionPaymentPercent">Porcentaje Comisión - Pago (%)</Label>
                      <Input
                        id="commissionPaymentPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newClient.commissionPaymentPercent}
                        onChange={(e) => setNewClient({ ...newClient, commissionPaymentPercent: e.target.value })}
                      />
                      <p className="text-xs text-zinc-500">
                        Porcentaje informativo de pago al cliente.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="text-sm text-destructive">
                  {error}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateClient}
                  disabled={creating || !newClient.email || !newClient.password}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold"
                >
                  {creating ? 'Creando...' : newClient.role === 'reponedor' ? 'Crear Reponedor' : 'Crear Cliente'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error global */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Lista de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({clients.length})</CardTitle>
          <CardDescription>
            Listado de clientes y reponedores registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">
              No hay usuarios registrados
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 border border-zinc-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-900">{client.company_name || client.display_name || client.email}</h3>
                      <Badge className={client.role === 'reponedor' ? 'bg-zinc-900 text-white text-xs font-semibold' : 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold'}>
                        {client.role === 'reponedor' ? 'Reponedor' : 'Cliente'}
                      </Badge>
                      {client.role === 'client' && (
                        <>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs font-semibold">
                            {client.commissionHidePercent}% oculto
                          </Badge>
                          <Badge variant="outline" className="bg-emerald-100 border-emerald-200 text-emerald-700 text-xs font-semibold">
                            {client.commissionPaymentPercent}% comisión
                          </Badge>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                      {client.display_name && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {client.display_name}
                        </span>
                      )}
                      <span>{client.email}</span>
                      {client.role === 'client' ? (
                        <span className="text-zinc-700 font-medium">{client.machineCount} máquinas</span>
                      ) : (
                        <span className="text-zinc-700 font-medium">{client.routeCount} rutas</span>
                      )}
                      <span>Creado {formatDate(client.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {client.role === 'client' ? (
                      <>
                        <Link href={`/admin/clients/${client.id}/overview`}>
                          <Button variant="ghost" size="sm" className="border border-zinc-200 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                        </Link>
                        <Link href={`/admin/clients/${client.id}`}>
                          <Button variant="ghost" size="sm" className="border border-emerald-200 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors font-semibold">
                            <Settings className="w-4 h-4 mr-2" />
                            Configurar
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link href="/admin/gestion-rutas">
                        <Button variant="ghost" size="sm" className="border border-zinc-200 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-colors">
                          <Route className="w-4 h-4 mr-2" />
                          Rutas
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(client)}
                      className="border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{' '}
                  <strong>{clientToDelete?.company_name || clientToDelete?.email}</strong> y todos sus datos asociados:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Perfil del usuario</li>
                  <li>Configuración y asignaciones asociadas</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar usuario'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
