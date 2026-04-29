'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import type { Payroll } from '@/lib/types';

interface UploadPayrollSheetProps {
  trigger: React.ReactNode;
}

export function UploadPayrollSheet({ trigger }: UploadPayrollSheetProps) {
  const { addPayroll, employees } = useData();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [formData, setFormData] = useState({
    employeeId: '',
    month: currentMonth.toString(),
    year: currentYear.toString(),
    grossAmount: '',
    netAmount: '',
    companyCost: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.employeeId || !formData.grossAmount || !formData.netAmount || !formData.companyCost) {
        toast.error('Por favor complete todos los campos obligatorios');
        setLoading(false);
        return;
      }

      const grossAmount = parseFloat(formData.grossAmount);
      const netAmount = parseFloat(formData.netAmount);
      const companyCost = parseFloat(formData.companyCost);

      if (isNaN(grossAmount) || isNaN(netAmount) || isNaN(companyCost)) {
        toast.error('Los importes deben ser números válidos');
        setLoading(false);
        return;
      }

      if (netAmount > grossAmount) {
        toast.error('El neto no puede ser mayor que el bruto');
        setLoading(false);
        return;
      }

      const newPayroll: Payroll = {
        id: Date.now().toString(),
        employeeId: formData.employeeId,
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        grossAmount,
        netAmount,
        companyCost,
        uploadedAt: new Date(),
        status: 'PENDIENTE',
        fileUrl: `/mock/nomina-${Date.now()}.pdf`,
        notes: formData.notes || undefined,
      };

      addPayroll(newPayroll);
      toast.success('Nómina subida correctamente');
      
      setFormData({
        employeeId: '',
        month: currentMonth.toString(),
        year: currentYear.toString(),
        grossAmount: '',
        netAmount: '',
        companyCost: '',
        notes: '',
      });
      setSelectedFiles([]);
      setOpen(false);
    } catch (error) {
      toast.error('Error al subir la nómina');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>Subir Nómina</SheetTitle>
          <SheetDescription>
            Suba una nómina de empleado. Los campos marcados con * son obligatorios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Drag & Drop File Upload */}
          <FileDropzone
            onFilesSelected={setSelectedFiles}
            maxFiles={1}
            maxSize={10}
            accept=".pdf,application/pdf"
            multiple={false}
          />
          {/* Empleado */}
          <div className="space-y-2">
            <Label htmlFor="employeeId">
              Empleado <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.employeeId}
              onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un empleado" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.active)
                  .map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} - {employee.position}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mes y Año */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">
                Mes <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.month}
                onValueChange={(value) => setFormData({ ...formData, month: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">
                Año <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.year}
                onValueChange={(value) => setFormData({ ...formData, year: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Importes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grossAmount">
                Salario Bruto (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="grossAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.grossAmount}
                onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                placeholder="2500.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="netAmount">
                Salario Neto (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="netAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.netAmount}
                onChange={(e) => setFormData({ ...formData, netAmount: e.target.value })}
                placeholder="2000.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyCost">
                Coste Empresa (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyCost"
                type="number"
                step="0.01"
                min="0"
                value={formData.companyCost}
                onChange={(e) => setFormData({ ...formData, companyCost: e.target.value })}
                placeholder="3000.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Incluye seguridad social y otros costes
              </p>
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
              rows={2}
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
              {loading ? 'Subiendo...' : 'Subir Nómina'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
