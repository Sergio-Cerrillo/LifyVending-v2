'use client';

import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageSearch, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InicioPage() {
    const { currentUser } = useAuth();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 20) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const getCurrentTime = () => {
        return new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-8">
            {/* Header de bienvenida */}
            <div className="bg-linear-to-r from-primary/10 to-primary/5 rounded-lg p-8 border">
                <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-6 w-6 text-primary" />
                    <p className="text-sm text-muted-foreground capitalize">{getCurrentTime()}</p>
                </div>
                <h1 className="text-4xl font-bold text-primary mb-2">
                    {getGreeting()}, {currentUser?.name || 'Usuario'}
                </h1>
                <p className="text-muted-foreground text-lg">
                    Bienvenido al sistema de gestión de stock de Lify Vending
                </p>
            </div>

            {/* Tarjeta de acceso rápido */}
            <div className="grid gap-6 md:grid-cols-1">
                <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <PackageSearch className="h-5 w-5 text-primary" />
                                Gestión de Stock
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Accede al inventario de todas las máquinas vending. Consulta productos,
                            cantidades disponibles y realiza actualizaciones de stock.
                        </p>
                        <Link href="/admin/stock">
                            <Button className="w-full">
                                Ir al Stock
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Información adicional */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Información del Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="bg-primary/10 rounded-full p-2">
                            <PackageSearch className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Gestión de Inventario</p>
                            <p className="text-xs text-muted-foreground">
                                Consulta y gestiona el stock de productos en tiempo real
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
