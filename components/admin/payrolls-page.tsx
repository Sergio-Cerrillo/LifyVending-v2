'use client';

import { useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './status-badge';
import { Plus, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { UploadPayrollSheet } from './upload-payroll-sheet';

export function PayrollsPage() {
  const { payrolls, employees, updatePayroll } = useData();
  const { hasRole } = useAuth();
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [activeTab, setActiveTab] = useState<string>(employees[0]?.id || 'all');

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee ? employee.name : 'Desconocido';
  };

  const getMonthName = (month: number) => {
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return months[month - 1] || month.toString();
  };

  const filteredPayrolls = payrolls.filter((payroll) => {
    if (activeTab !== 'all' && payroll.employeeId !== activeTab) {
      return false;
    }
    if (selectedYear !== 'all' && payroll.year.toString() !== selectedYear) {
      return false;
    }
    return true;
  });

  const handleMarkReviewed = (payroll: any) => {
    if (!hasRole(['admin', 'gestor'])) {
      toast.error('No tiene permisos para esta acción');
      return;
    }

    updatePayroll(payroll.id, {
      status: 'REVISADA',
    });
    toast.success('Nómina marcada como revisada');
  };

  const handleDownload = (payroll: any) => {
    toast.info(`Descargando nómina: ${getEmployeeName(payroll.employeeId)} - ${getMonthName(payroll.month)} ${payroll.year}`);
  };

  const totalGross = filteredPayrolls.reduce((sum, p) => sum + p.grossAmount, 0);
  const totalNet = filteredPayrolls.reduce((sum, p) => sum + p.netAmount, 0);
  const totalCost = filteredPayrolls.reduce((sum, p) => sum + p.companyCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Nóminas</h1>
            <p className="text-sm text-zinc-600 mt-1">
              Gestión de nóminas de empleados
            </p>
          </div>
          <UploadPayrollSheet
            trigger={
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                <Plus className="mr-2 h-4 w-4" />
                Subir Nómina
              </Button>
            }
          />
        </div>
      </div>

    {/* Tabs por Empleado */}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="all">Todos</TabsTrigger>
        {employees.map((employee) => (
          <TabsTrigger key={employee.id} value={employee.id}>
            {employee.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab Content for All */}
      <TabsContent value="all" className="space-y-6">
        
        {/* Employees Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {employees.map((employee) => (
            <div key={employee.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    DNI: {employee.dni}
                  </p>
                </div>
                <StatusBadge
                  status={employee.active ? 'ACTIVO' : 'INACTIVO'}
                  variant={employee.active ? 'success' : 'default'}
                />
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="text-sm">
                  <span className="text-muted-foreground">Nóminas subidas: </span>
                  <span className="font-medium">
                    {payrolls.filter((p) => p.employeeId === employee.id).length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los años</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{filteredPayrolls.length}</div>
            <div className="text-sm text-muted-foreground">Total Nóminas</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">€{totalGross.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total Bruto</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">€{totalNet.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total Neto</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">€{totalCost.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Coste Empresa</div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Año</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Coste Empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayrolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron nóminas
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayrolls
                  .sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                  })
                  .map((payroll) => (
                    <TableRow key={payroll.id}>
                      <TableCell className="font-medium">
                        {getEmployeeName(payroll.employeeId)}
                      </TableCell>
                      <TableCell>{getMonthName(payroll.month)}</TableCell>
                      <TableCell>{payroll.year}</TableCell>
                      <TableCell className="text-right">
                        €{payroll.grossAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        €{payroll.netAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        €{payroll.companyCost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={payroll.status}
                          variant={
                            payroll.status === 'REVISADA' ? 'success' : 'warning'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {payroll.status === 'PENDIENTE' &&
                            hasRole(['admin', 'gestor']) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMarkReviewed(payroll)}
                                title="Marcar como revisada"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(payroll)}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Tab Content for Each Employee */}
      {employees.map((employee) => (
        <TabsContent key={employee.id} value={employee.id} className="space-y-6">
          {/* Employee Card */}
          <div className="rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-2xl">{employee.name}</h3>
                <p className="text-muted-foreground mt-1">{employee.position}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  DNI: {employee.dni}
                </p>
              </div>
              <StatusBadge
                status={employee.active ? 'ACTIVO' : 'INACTIVO'}
                variant={employee.active ? 'success' : 'default'}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{filteredPayrolls.length}</div>
              <div className="text-sm text-muted-foreground">Total Nóminas</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">€{totalGross.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Bruto</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">€{totalNet.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Neto</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">€{totalCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Coste Empresa</div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Coste Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayrolls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron nóminas para este empleado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayrolls
                    .sort((a, b) => {
                      if (a.year !== b.year) return b.year - a.year;
                      return b.month - a.month;
                    })
                    .map((payroll) => (
                      <TableRow key={payroll.id}>
                        <TableCell className="font-medium">{getMonthName(payroll.month)}</TableCell>
                        <TableCell>{payroll.year}</TableCell>
                        <TableCell className="text-right">
                          €{payroll.grossAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          €{payroll.netAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          €{payroll.companyCost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={payroll.status}
                            variant={
                              payroll.status === 'REVISADA' ? 'success' : 'warning'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {payroll.status === 'PENDIENTE' &&
                              hasRole(['admin', 'gestor']) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMarkReviewed(payroll)}
                                  title="Marcar como revisada"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(payroll)}
                              title="Descargar"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      ))}
    </Tabs>
    </div>
  );
}
