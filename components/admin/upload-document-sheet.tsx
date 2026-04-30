'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { useAuth } from '@/contexts/auth-context';
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
import type { Document, DocType, DocumentVisibility } from '@/lib/types';
import { format } from 'date-fns';

interface UploadDocumentSheetProps {
  trigger: React.ReactNode;
}

export function UploadDocumentSheet({ trigger }: UploadDocumentSheetProps) {
  const { addDocument } = useData();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    docType: 'RECIBIDA' as DocType,
    title: '',
    counterparty: '',
    amount: '',
    invoiceNumber: '',
    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    tags: '',
    notes: '',
    visibility: 'AMBOS' as DocumentVisibility,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones
      if (!formData.title || !formData.counterparty || !formData.amount) {
        toast.error('Por favor complete todos los campos obligatorios');
        setLoading(false);
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('El importe debe ser un número válido mayor que 0');
        setLoading(false);
        return;
      }

      // Crear documento
      const newDocument: Document = {
        id: Date.now().toString(),
        docType: formData.docType,
        title: formData.title,
        counterparty: formData.counterparty,
        amount: amount,
        currency: 'EUR',
        invoiceNumber: formData.invoiceNumber || undefined,
        invoiceDate: new Date(formData.invoiceDate),
        uploadedBy: currentUser?.name || 'Usuario',
        uploadedAt: new Date(),
        statusReview: 'PENDIENTE',
        statusAccounting: 'PENDIENTE',
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()) : [],
        notes: formData.notes || undefined,
        fileUrl: `/mock/documento-${Date.now()}.pdf`,
        accountingPeriod: format(new Date(formData.invoiceDate), 'yyyy-MM'),
        visibility: formData.visibility,
        historyEvents: [
          {
            id: '1',
            date: new Date(),
            action: 'Subida',
            userId: currentUser?.id || '1',
            userName: currentUser?.name || 'Usuario',
          },
        ],
      };

      addDocument(newDocument);
      toast.success('Documento subido correctamente');
      
      // Reset form y cerrar
      setFormData({
        docType: 'RECIBIDA',
        title: '',
        counterparty: '',
        amount: '',
        invoiceNumber: '',
        invoiceDate: format(new Date(), 'yyyy-MM-dd'),
        tags: '',
        notes: '',
        visibility: 'AMBOS',
      });
      setSelectedFiles([]);
      setOpen(false);
    } catch (error) {
      toast.error('Error al subir el documento');
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
          <SheetTitle>Subir Documento</SheetTitle>
          <SheetDescription>
            Complete los datos del documento. Los campos marcados con * son obligatorios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Drag & Drop File Upload */}
          <FileDropzone
            onFilesSelected={setSelectedFiles}
            maxFiles={1}
            maxSize={10}
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple={false}
          />
          {/* Tipo de Documento */}
          <div className="space-y-2">
            <Label htmlFor="docType">
              Tipo de Documento <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.docType}
              onValueChange={(value) =>
                setFormData({ ...formData, docType: value as DocType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECIBIDA">Factura Recibida (Proveedor)</SelectItem>
                <SelectItem value="ABONADA">Factura Abonada (Cliente)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              Recibida: facturas de proveedores. Abonada: facturas emitidas a clientes.
            </p>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Factura proveedor Coca-Cola"
              required
            />
          </div>

          {/* Procedencia/Destino */}
          <div className="space-y-2">
            <Label htmlFor="counterparty">
              {formData.docType === 'RECIBIDA' ? 'Procedencia' : 'Destino'}{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="counterparty"
              value={formData.counterparty}
              onChange={(e) =>
                setFormData({ ...formData, counterparty: e.target.value })
              }
              placeholder={
                formData.docType === 'RECIBIDA'
                  ? 'Nombre del proveedor'
                  : 'Nombre del cliente'
              }
              required
            />
          </div>

          {/* Importe y Número de Factura */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Importe (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Número de Factura</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNumber: e.target.value })
                }
                placeholder="FAC-2026-001"
              />
            </div>
          </div>

          {/* Fecha de Factura */}
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">
              Fecha de Factura <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invoiceDate"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) =>
                setFormData({ ...formData, invoiceDate: e.target.value })
              }
              required
            />
          </div>

          {/* Visibilidad */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibilidad</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) =>
                setFormData({ ...formData, visibility: value as DocumentVisibility })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPRESA">Solo Empresa</SelectItem>
                <SelectItem value="GESTOR">Solo Gestor</SelectItem>
                <SelectItem value="AMBOS">Empresa y Gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Etiquetas</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="proveedores, bebidas, electricidad (separadas por comas)"
            />
            <p className="text-xs text-muted-foreground">
              Separe las etiquetas con comas
            </p>
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
              {loading ? 'Subiendo...' : 'Subir Documento'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
