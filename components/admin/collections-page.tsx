'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { useAuth } from '@/contexts/auth-context';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './status-badge';
import { Plus, Search, Download, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateCollectionSheet } from './create-collection-sheet';
import { toast } from 'sonner';

export function CollectionsPage() {
  const { collections, machines, updateCollection } = useData();
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const getMachineName = (machineId: string) => {
    const machine = machines.find((m) => m.id === machineId);
    return machine ? `${machine.machineNumber} - ${machine.locationName}` : 'Desconocida';
  };

  const filteredCollections = collections.filter((collection) => {
    if (selectedMachine !== 'all' && collection.machineId !== selectedMachine) {
      return false;
    }
    if (search) {
      const machineName = getMachineName(collection.machineId);
      if (!machineName.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const totalCash = filteredCollections.reduce((sum, c) => sum + c.cashAmount, 0);
  const totalCard = filteredCollections.reduce((sum, c) => sum + c.cardAmount, 0);
  const totalAmount = filteredCollections.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalCommission = filteredCollections.reduce((sum, c) => sum + (c.clientCommission || 0), 0);
  const pendingCommissions = filteredCollections.filter(c => c.clientCommission && !c.commissionPaid).length;

  const handleOpenPaymentDialog = (collection: any) => {
    if (!hasRole(['admin', 'gestor'])) {
      toast.error('No tiene permisos para esta acción');
      return;
    }

    if (collection.commissionPaid) {
      // Si ya está pagada, desmarcar directamente
      updateCollection(collection.id, {
        commissionPaid: false,
        commissionPaidDate: undefined,
        commissionNotes: undefined,
      });
      toast.success('Comisión marcada como pendiente');
    } else {
      // Si no está pagada, abrir diálogo para ingresar fecha
      setSelectedCollection(collection);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentNotes('');
      setPaymentDialogOpen(true);
    }
  };

  const handleConfirmPayment = () => {
    if (!selectedCollection || !paymentDate) {
      toast.error('Debe seleccionar una fecha');
      return;
    }

    updateCollection(selectedCollection.id, {
      commissionPaid: true,
      commissionPaidDate: new Date(paymentDate),
      commissionNotes: paymentNotes || `Pagado el ${format(new Date(paymentDate), 'dd/MM/yyyy')}`,
    });
    
    toast.success('Comisión marcada como pagada');
    setPaymentDialogOpen(false);
    setSelectedCollection(null);
    setPaymentDate('');
    setPaymentNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Recaudaciones</h1>
            </div>
            <p className="text-sm font-semibold text-zinc-700 ml-14">
              Control de recaudaciones por máquina
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 font-semibold">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <CreateCollectionSheet
              trigger={
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Recaudación
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por máquina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={selectedMachine} onValueChange={setSelectedMachine}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Filtrar por máquina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las máquinas</SelectItem>
            {machines.map((machine) => (
              <SelectItem key={machine.id} value={machine.id}>
                {machine.machineNumber} - {machine.locationName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">{filteredCollections.length}</div>
          <div className="text-sm text-zinc-600 font-medium">Total Recaudaciones</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">€{totalAmount.toFixed(2)}</div>
          <div className="text-sm text-zinc-600 font-medium">Total General</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">€{totalCommission.toFixed(2)}</div>
          <div className="text-sm text-zinc-600 font-medium">Comisiones ({pendingCommissions} pend.)</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead>Estado Pago</TableHead>
              <TableHead>Recaudado por</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCollections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                  No se encontraron recaudaciones
                </TableCell>
              </TableRow>
            ) : (
              filteredCollections
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      {format(new Date(collection.date), 'dd/MM/yyyy HH:mm', {
                        locale: es,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getMachineName(collection.machineId)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      €{collection.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {collection.clientCommission ? (
                        <span className="font-medium">€{collection.clientCommission.toFixed(2)}</span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {collection.clientCommission ? (
                        collection.commissionPaid ? (
                          <StatusBadge status="PAGADA" variant="success" />
                        ) : (
                          <StatusBadge status="PENDIENTE" variant="warning" />
                        )
                      ) : (
                        <span className="text-zinc-500 text-sm">Sin comisión</span>
                      )}
                    </TableCell>
                    <TableCell>{collection.collectedBy}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {collection.clientCommission && hasRole(['admin', 'gestor']) && (
                          <Button
                            variant={collection.commissionPaid ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleOpenPaymentDialog(collection)}
                          >
                            {collection.commissionPaid ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Pagada
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Marcar Pagada
                              </>
                            )}
                          </Button>
                        )}
                        {collection.commissionPaid && collection.commissionNotes && (
                          <p className="text-xs text-zinc-500">
                            {collection.commissionNotes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog para marcar como pagada */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Comisión como Pagada</DialogTitle>
            <DialogDescription>
              Ingrese la fecha de pago y notas adicionales (opcional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Fecha de Pago</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notas (opcional)</Label>
              <Input
                id="paymentNotes"
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ej: Transferencia bancaria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment}>
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
