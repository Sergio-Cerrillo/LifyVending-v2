'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    UserPlus,
    Trash2,
    Edit,
    Mail,
    Shield,
    Search,
    Loader2,
    Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Employee {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'operador';
    permissions: string[];
    created_at: string;
    last_sign_in_at?: string;
}

export function EmpleadosPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [search, setSearch] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'operador' as 'admin' | 'operador',
        permissions: [] as string[],
    });

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/employees');
            if (!response.ok) throw new Error('Error al cargar empleados');
            const data = await response.json();
            setEmployees(data.employees || []);
        } catch (error: any) {
            toast.error('Error al cargar empleados', {
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateEmployee = async () => {
        if (!formData.email || !formData.password || !formData.name) {
            toast.error('Completa todos los campos obligatorios');
            return;
        }

        try {
            const response = await fetch('/api/admin/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al crear empleado');
            }

            toast.success('Empleado creado exitosamente');
            setIsDialogOpen(false);
            resetForm();
            loadEmployees();
        } catch (error: any) {
            toast.error('Error al crear empleado', {
                description: error.message,
            });
        }
    };

    const handleDeleteEmployee = async (employeeId: string) => {
        if (!confirm('¿Estás seguro de eliminar este empleado? Esta acción no se puede deshacer.')) {
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/admin/employees?id=${employeeId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al eliminar empleado');
            }

            toast.success('Empleado eliminado exitosamente');
            loadEmployees();
        } catch (error: any) {
            toast.error('Error al eliminar empleado', {
                description: error.message,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            name: '',
            role: 'operador',
            permissions: [],
        });
        setSelectedEmployee(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.email.toLowerCase().includes(search.toLowerCase())
    );

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-red-100 text-red-800';
            case 'operador':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin':
                return 'Administrador';
            case 'operador':
                return 'Operador';
            default:
                return role;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Empleados</h1>
                    <p className="text-muted-foreground mt-2">
                        Administra los usuarios que tienen acceso al sistema
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Crear Empleado
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Employee Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Empleados ({filteredEmployees.length})</CardTitle>
                    <CardDescription>
                        Lista de todos los usuarios con acceso al sistema
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {search ? 'No se encontraron empleados' : 'No hay empleados creados'}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Último acceso</TableHead>
                                    <TableHead>Fecha creación</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEmployees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell className="font-medium">{employee.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                {employee.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getRoleBadgeColor(employee.role)}>
                                                <Shield className="mr-1 h-3 w-3" />
                                                {getRoleLabel(employee.role)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {employee.last_sign_in_at
                                                ? format(new Date(employee.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale: es })
                                                : 'Nunca'}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(employee.created_at), 'dd/MM/yyyy', { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteEmployee(employee.id)}
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Employee Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Empleado</DialogTitle>
                        <DialogDescription>
                            Completa los datos para crear un nuevo usuario en el sistema
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre completo *</Label>
                            <Input
                                id="name"
                                placeholder="Juan Pérez"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="usuario@empresa.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña *</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Mínimo 8 caracteres"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                La contraseña debe tener al menos 8 caracteres
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Rol *</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value: 'admin' | 'operador') =>
                                    setFormData({ ...formData, role: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operador">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-blue-600" />
                                            <div>
                                                <div className="font-medium">Operador</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Acceso solo a Stock de máquinas
                                                </div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-red-600" />
                                            <div>
                                                <div className="font-medium">Administrador</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Acceso completo al sistema
                                                </div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateEmployee}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Crear Empleado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
