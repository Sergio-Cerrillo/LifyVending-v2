'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { useAuth } from '@/contexts/auth-context';
import type { Document, DocumentFilters } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StatusBadge,
  getDocumentAccountingVariant,
} from './status-badge';
import {
  Plus,
  Download,
  Edit,
  Trash2,
  Check,
  Search,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { UploadDocumentSheet } from './upload-document-sheet';

export function DocumentsPage() {
  const { documents, updateDocument, deleteDocument } = useData();
  const { currentUser, hasRole } = useAuth();
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Filtrar documentos
  const filteredDocuments = documents.filter((doc) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !doc.title.toLowerCase().includes(searchLower) &&
        !doc.counterparty.toLowerCase().includes(searchLower) &&
        !doc.invoiceNumber?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    if (filters.docType && doc.docType !== filters.docType) return false;
    if (filters.statusAccounting && doc.statusAccounting !== filters.statusAccounting)
      return false;

    return true;
  });

  const handleToggleAccounted = (doc: Document) => {
    if (!hasRole(['admin', 'gestor'])) {
      toast.error('No tiene permisos para esta acción');
      return;
    }

    const isAccounted = doc.statusAccounting === 'CONTABILIZADA';
    
    updateDocument(doc.id, {
      statusAccounting: isAccounted ? 'PENDIENTE' : 'CONTABILIZADA',
      accountedAt: isAccounted ? undefined : new Date(),
      accountedBy: isAccounted ? undefined : currentUser?.name,
    });
    
    toast.success(
      isAccounted 
        ? 'Documento marcado como pendiente' 
        : 'Documento contabilizado'
    );
  };

  const handleDelete = (id: string) => {
    if (!hasRole(['admin'])) {
      toast.error('Solo los administradores pueden eliminar documentos');
      return;
    }

    if (confirm('¿Está seguro de eliminar este documento?')) {
      deleteDocument(id);
      toast.success('Documento eliminado');
    }
  };

  const handleDownload = (doc: Document) => {
    // Mock download
    toast.info(`Descargando: ${doc.title}`);
  };

  const handleBulkDownload = () => {
    if (selectedDocuments.length === 0) return;
    
    const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
    toast.success(`Descargando ${selectedDocuments.length} documentos...`);
    
    // Mock bulk download
    selectedDocs.forEach((doc, index) => {
      setTimeout(() => {
        toast.info(`Descargando: ${doc.title}`);
      }, index * 500);
    });
    
    // Clear selection after download
    setSelectedDocuments([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  const handleSelectDocument = (docId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, docId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== docId));
    }
  };

  const isAllSelected = filteredDocuments.length > 0 && 
    selectedDocuments.length === filteredDocuments.length;
  const isSomeSelected = selectedDocuments.length > 0 && 
    selectedDocuments.length < filteredDocuments.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Documentos Facturas</h1>
            <p className="text-sm text-zinc-600 mt-1">
            Gestión centralizada de documentación
          </p>
        </div>
        <div className="flex gap-2">
          {selectedDocuments.length > 1 && (
            <Button 
              variant="outline" 
              onClick={handleBulkDownload}
              className="border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Selección ({selectedDocuments.length})
            </Button>
          )}
          <UploadDocumentSheet
            trigger={
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                <Plus className="mr-2 h-4 w-4" />
                Subir Documento
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
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, procedencia o número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select
          value={filters.docType || 'all'}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              docType: value === 'all' ? undefined : (value as any),
            }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="RECIBIDA">Recibida</SelectItem>
            <SelectItem value="ABONADA">Abonada</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.statusAccounting || 'all'}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              statusAccounting: value === 'all' ? undefined : (value as any),
            }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="CONTABILIZADA">Contabilizada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-3xl font-bold">{documents.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Total Documentos</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-3xl font-bold text-orange-600">
            {documents.filter((d) => d.statusAccounting === 'PENDIENTE').length}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Pendientes de Contabilizar
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Procedencia/Destino</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Fecha Factura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
              <TableHead className="w-20 text-center">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Seleccionar todos"
                    className={`h-5 w-5 ${isSomeSelected ? "opacity-50" : ""}`}
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No se encontraron documentos
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => (
                <TableRow key={doc.id} className={selectedDocuments.includes(doc.id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <StatusBadge
                      status={doc.docType}
                      variant={doc.docType === 'RECIBIDA' ? 'danger' : 'success'}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>{doc.counterparty}</TableCell>
                  <TableCell className="text-right">
                    {doc.amount.toFixed(2)} {doc.currency}
                  </TableCell>
                  <TableCell>
                    {format(new Date(doc.invoiceDate), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={doc.statusAccounting === 'CONTABILIZADA' ? 'CONTABILIZADA' : 'PENDIENTE'}
                      variant={getDocumentAccountingVariant(doc.statusAccounting)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {hasRole(['admin', 'gestor']) && (
                        <Button
                          variant={doc.statusAccounting === 'CONTABILIZADA' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleAccounted(doc)}
                        >
                          <Check className={`h-4 w-4 mr-1 ${doc.statusAccounting === 'CONTABILIZADA' ? '' : 'opacity-50'}`} />
                          {doc.statusAccounting === 'CONTABILIZADA' ? 'Contabilizada' : 'Contabilizar'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {hasRole(['admin']) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                        aria-label={`Seleccionar ${doc.title}`}
                        className="h-5 w-5 border-2 border-primary/60 shadow-sm"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
