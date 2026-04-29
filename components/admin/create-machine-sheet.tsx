'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { FileDropzone } from './file-dropzone';
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
import type { Machine, MachineType, MachineStatus } from '@/lib/types';
import { format } from 'date-fns';

interface CreateMachineSheetProps {
  trigger: React.ReactNode;
}

export function CreateMachineSheet({ trigger }: CreateMachineSheetProps) {
  const { addMachine } = useData();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    machineNumber: '',
    type: 'mixta' as MachineType,
    brand: '',
    model: '',
    serialNumber: '',
    hasCardReader: false,
    hasTelemetry: false,
    hasContract: false,
    locationName: '',
    locationAddress: '',
    contactPerson: '',
    contactPhone: '',
    installationDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'ACTIVA' as MachineStatus,
    commissionPercentage: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.machineNumber || !formData.brand || !formData.model || !formData.locationName) {
        toast.error('Por favor complete todos los campos obligatorios');
        setLoading(false);
        return;
      }

      const newMachine: Machine = {
        id: Date.now().toString(),
        machineNumber: formData.machineNumber,
        type: formData.type,
        brand: formData.brand,
        model: formData.model,
        serialNumber: formData.serialNumber,
        hasCardReader: formData.hasCardReader,
        hasTelemetry: formData.hasTelemetry,
        hasContract: formData.hasContract,
        contractFileUrl: formData.hasContract && selectedFiles.length > 0 ? `/mock/contrato-${Date.now()}.pdf` : undefined,
        locationName: formData.locationName,
        locationAddress: formData.locationAddress,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        installationDate: new Date(formData.installationDate),
        status: formData.status,
        commissionPercentage: formData.commissionPercentage ? parseFloat(formData.commissionPercentage) : undefined,
        notes: formData.notes || undefined,
        documents: [],
        historyEvents: [],
      };

      addMachine(newMachine);
      toast.success('Máquina creada correctamente');
      
      setFormData({
        machineNumber: '',
        type: 'mixta',
        brand: '',
        model: '',
        serialNumber: '',
        hasCardReader: false,
        hasTelemetry: false,
        hasContract: false,
        locationName: '',
        locationAddress: '',
        contactPerson: '',
        contactPhone: '',
        installationDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'ACTIVA',
        commissionPercentage: '',
        notes: '',
      });
      setSelectedFiles([]);
      setOpen(false);
    } catch (error) {
      toast.error('Error al crear la máquina');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>Nueva Máquina</SheetTitle>
          <SheetDescription>
            Registre una nueva máquina de vending. Los campos marcados con * son obligatorios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Número de Máquina */}
          <div className="space-y-2">
            <Label htmlFor="machineNumber">
              Número de Máquina <span className="text-red-500">*</span>
            </Label>
            <Input
              id="machineNumber"
              value={formData.machineNumber}
              onChange={(e) => setFormData({ ...formData, machineNumber: e.target.value })}
              placeholder="VM-001"
              required
            />
          </div>

          {/* Tipo y Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo <span className="text-red-500">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as MachineType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="snack">Snacks</SelectItem>
                  <SelectItem value="bebida">Bebidas</SelectItem>
                  <SelectItem value="cafe">Café</SelectItem>
                  <SelectItem value="mixta">Mixta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as MachineStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVA">Activa</SelectItem>
                  <SelectItem value="ALMACEN">Almacén</SelectItem>
                  <SelectItem value="AVERIADA">Averiada</SelectItem>
                  <SelectItem value="RETIRADA">Retirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Marca y Modelo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca <span className="text-red-500">*</span></Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Necta, Azkoyen..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo <span className="text-red-500">*</span></Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Jazz, Palma..."
                required
              />
            </div>
          </div>

          {/* Número de Serie */}
          <div className="space-y-2">
            <Label htmlFor="serialNumber">Número de Serie</Label>
            <Input
              id="serialNumber"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              placeholder="NEC-2024-001234"
            />
          </div>

          {/* Características */}
          <div className="space-y-3">
            <Label>Características</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasCardReader"
                checked={formData.hasCardReader}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, hasCardReader: checked as boolean })
                }
              />
              <label htmlFor="hasCardReader" className="text-sm font-medium cursor-pointer">
                Lector de tarjeta
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasTelemetry"
                checked={formData.hasTelemetry}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, hasTelemetry: checked as boolean })
                }
              />
              <label htmlFor="hasTelemetry" className="text-sm font-medium cursor-pointer">
                Telemetría
              </label>
            </div>
          </div>

          {/* Contrato */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasContract">Tiene Contrato</Label>
              <Switch
                id="hasContract"
                checked={formData.hasContract}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, hasContract: checked })
                }
              />
            </div>
            
            {formData.hasContract && (
              <div className="pt-2">
                <FileDropzone
                  onFilesSelected={setSelectedFiles}
                  maxFiles={1}
                  maxSize={10}
                  accept=".pdf,application/pdf"
                  multiple={false}
                />
              </div>
            )}
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="locationName">
              Nombre de Ubicación <span className="text-red-500">*</span>
            </Label>
            <Input
              id="locationName"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              placeholder="Hospital Universitario"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationAddress">Dirección</Label>
            <Input
              id="locationAddress"
              value={formData.locationAddress}
              onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
              placeholder="Av. Principal 123, Madrid"
            />
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Persona de Contacto</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="María García"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Teléfono</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="+34 600 123 456"
              />
            </div>
          </div>

          {/* Fecha de Instalación y Comisión */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="installationDate">Fecha de Instalación</Label>
              <Input
                id="installationDate"
                type="date"
                value={formData.installationDate}
                onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionPercentage">Comisión (%)</Label>
              <Input
                id="commissionPercentage"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.commissionPercentage}
                onChange={(e) => setFormData({ ...formData, commissionPercentage: e.target.value })}
                placeholder="15"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional..."
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
              {loading ? 'Creando...' : 'Crear Máquina'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
