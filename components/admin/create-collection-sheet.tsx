'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type { Collection } from '@/lib/types';
import { format } from 'date-fns';

interface CreateCollectionSheetProps {
  trigger: React.ReactNode;
}

export function CreateCollectionSheet({ trigger }: CreateCollectionSheetProps) {
  const { addCollection, machines } = useData();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    machineId: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    cashAmount: '',
    cardAmount: '',
    clientCommission: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.machineId) {
        toast.error('Por favor seleccione una máquina');
        setLoading(false);
        return;
      }

      const cashAmount = parseFloat(formData.cashAmount) || 0;
      const cardAmount = parseFloat(formData.cardAmount) || 0;
      const totalAmount = cashAmount + cardAmount;

      if (totalAmount <= 0) {
        toast.error('Debe ingresar al menos un importe (efectivo o tarjeta)');
        setLoading(false);
        return;
      }

      const newCollection: Collection = {
        id: Date.now().toString(),
        machineId: formData.machineId,
        date: new Date(formData.date),
        cashAmount,
        cardAmount,
        totalAmount,
        clientCommission: parseFloat(formData.clientCommission) || undefined,
        commissionPaid: false,
        collectedBy: currentUser?.name || 'Usuario',
        notes: formData.notes || undefined,
      };

      addCollection(newCollection);
      toast.success('Recaudación registrada correctamente');
      
      setFormData({
        machineId: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        clientCommission: '',
        cashAmount: '',
        cardAmount: '',
        notes: '',
      });
      setOpen(false);
    } catch (error) {
      toast.error('Error al registrar la recaudación');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const cashAmount = parseFloat(formData.cashAmount) || 0;
  const cardAmount = parseFloat(formData.cardAmount) || 0;
  const totalAmount = cashAmount + cardAmount;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>Nueva Recaudación</SheetTitle>
          <SheetDescription>
            Registre una nueva recaudación de máquina.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Máquina */}
          <div className="space-y-2">
            <Label htmlFor="machineId">
              Máquina <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.machineId}
              onValueChange={(value) => setFormData({ ...formData, machineId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una máquina" />
              </SelectTrigger>
              <SelectContent>
                {machines
                  .filter((m) => m.status === 'ACTIVA')
                  .map((machine) => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.machineNumber} - {machine.locationName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha y Hora */}
          <div className="space-y-2">
            <Label htmlFor="date">
              Fecha y Hora <span className="text-red-500">*</span>
            </Label>
            <Input
              id="date"
              type="datetime-local"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Importes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cashAmount">Efectivo (€)</Label>
              <Input
                id="cashAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.cashAmount}
                onChange={(e) => setFormData({ ...formData, cashAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardAmount">Tarjeta (€)</Label>
              <Input
                id="cardAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.cardAmount}
                onChange={(e) => setFormData({ ...formData, cardAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Total */}
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-zinc-700">Total:</span>
                <span className="text-2xl font-bold text-emerald-700">€{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Comisión al Cliente */}
          <div className="space-y-2">
            <Label htmlFor="clientCommission">Comisión al Cliente (€)</Label>
            <Input
              id="clientCommission"
              type="number"
              step="0.01"
              min="0"
              value={formData.clientCommission}
              onChange={(e) => setFormData({ ...formData, clientCommission: e.target.value })}
              placeholder="0.00"
            />
            <p className="text-xs text-zinc-500">
              Importe de comisión pactado con el cliente
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observaciones sobre la recaudación..."
              rows={3}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Recaudación'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
