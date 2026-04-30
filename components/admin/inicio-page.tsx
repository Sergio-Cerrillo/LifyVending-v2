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
            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <Clock className="h-5 w-5 text-emerald-100" />
                        <p className="text-sm font-semibold text-emerald-100 capitalize">{getCurrentTime()}</p>
                    </div>
                    <h1 className="text-4xl font-bold mb-2 drop-shadow-sm">
                        {getGreeting()}, {currentUser?.name || 'Usuario'}
                    </h1>
                    <p className="text-emerald-50 text-lg font-medium">
                        Bienvenido al sistema de gestión de Lify Vending
                    </p>
                </div>
            </div>

            {/* Tarjeta de acceso rápido */}
            <div className="grid gap-6 md:grid-cols-1">
                <Card className="bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 cursor-pointer group">
                    <CardHeader className="pb-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                                    <PackageSearch className="h-6 w-6 text-white" />
                                </div>
                                <span className="font-bold text-zinc-900">Gestión de Stock</span>
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-zinc-700 mb-6 leading-relaxed">
                            Accede al inventario de todas las máquinas vending. Consulta productos,
                            cantidades disponibles y realiza actualizaciones de stock.
                        </p>
                        <Link href="/admin/stock">
                            <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-6 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl">
                                Ir al Stock
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Información adicional */}
            <Card className="bg-white border border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
                    <CardTitle className="text-lg font-bold text-zinc-900">Información del Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-xl border border-emerald-100">
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 shadow-md">
                            <PackageSearch className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-zinc-900 mb-1">Gestión de Inventario</p>
                            <p className="text-sm text-zinc-700 leading-relaxed">
                                Consulta y gestiona el stock de productos en tiempo real
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
