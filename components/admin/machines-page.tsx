'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import type { Machine, MachineFilters } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { StatusBadge, getMachineStatusVariant } from './status-badge';
import { Plus, Search, Edit, MapPin, CheckCircle2, XCircle, FileCheck, MoreVertical, Download, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateMachineSheet } from './create-machine-sheet';

export function MachinesPage() {
  const { machines } = useData();
  const [filters, setFilters] = useState<MachineFilters>({});
  const [search, setSearch] = useState('');

  const filteredMachines = machines.filter((machine) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !machine.machineNumber.toLowerCase().includes(searchLower) &&
        !machine.locationName.toLowerCase().includes(searchLower) &&
        !machine.brand.toLowerCase().includes(searchLower) &&
        !machine.model.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    if (filters.type && machine.type !== filters.type) return false;
    if (filters.status && machine.status !== filters.status) return false;
    if (
      filters.hasCardReader !== undefined &&
      machine.hasCardReader !== filters.hasCardReader
    )
      return false;
    if (
      filters.hasTelemetry !== undefined &&
      machine.hasTelemetry !== filters.hasTelemetry
    )
      return false;

    return true;
  });

  const getMachineTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      snack: 'Snacks',
      bebida: 'Bebidas',
      cafe: 'Café',
      mixta: 'Mixta',
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Máquinas</h1>
            </div>
            <p className="text-sm font-semibold text-zinc-700 ml-14">
              Gestión del parque de máquinas vending
            </p>
          </div>
          <CreateMachineSheet
            trigger={
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md font-semibold">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Máquina
              </Button>
            }
          />
        </div>
      </div>      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por número, ubicación, marca o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select
          value={filters.type || 'all'}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              type: value === 'all' ? undefined : (value as any),
            }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="snack">Snacks</SelectItem>
            <SelectItem value="bebida">Bebidas</SelectItem>
            <SelectItem value="cafe">Café</SelectItem>
            <SelectItem value="mixta">Mixta</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              status: value === 'all' ? undefined : (value as any),
            }))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="ACTIVA">Activa</SelectItem>
            <SelectItem value="ALMACEN">Almacén</SelectItem>
            <SelectItem value="AVERIADA">Averiada</SelectItem>
            <SelectItem value="RETIRADA">Retirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Tarjeta</TableHead>
              <TableHead className="text-center">Telemetría</TableHead>
              <TableHead className="text-center">Contrato</TableHead>
              <TableHead>Instalación</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMachines.length === 0 ? (
              <TableRow>1
                <TableCell colSpan={10} className="text-center py-8 text-zinc-500">
                  No se encontraron máquinas
                </TableCell>
              </TableRow>
            ) : (
              filteredMachines.map((machine) => (
                <TableRow key={machine.id}>
                  <TableCell className="font-medium">
                    {machine.machineNumber}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={getMachineTypeLabel(machine.type)}
                      variant="info"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{machine.brand}</div>
                      <div className="text-sm text-zinc-600">
                        {machine.model}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{machine.locationName}</div>
                      <div className="text-sm text-zinc-600 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {machine.locationAddress}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={machine.status}
                      variant={getMachineStatusVariant(machine.status)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {machine.hasCardReader ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 inline" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300 inline" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {machine.hasTelemetry ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 inline" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300 inline" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {machine.hasContract ? (
                      <FileCheck className="h-5 w-5 text-blue-600 inline" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300 inline" />
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(machine.installationDate), 'dd/MM/yyyy', {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {machine.commissionPercentage
                      ? `${machine.commissionPercentage}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        {machine.hasContract && machine.contractFileUrl && (
                          <DropdownMenuItem asChild>
                            <a href={machine.contractFileUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="mr-2 h-4 w-4" />
                              Descargar Contrato
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">{machines.length}</div>
          <div className="text-sm text-zinc-600 font-medium">Total Máquinas</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {machines.filter((m) => m.status === 'ACTIVA').length}
          </div>
          <div className="text-sm text-zinc-600 font-medium">Activas</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {machines.filter((m) => m.hasCardReader).length}
          </div>
          <div className="text-sm text-zinc-600 font-medium">Con Lector Tarjeta</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {machines.filter((m) => m.hasTelemetry).length}
          </div>
          <div className="text-sm text-zinc-600 font-medium">Con Telemetría</div>
        </div>
      </div>
    </div>
  );
}
