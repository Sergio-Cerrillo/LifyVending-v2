'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  FileText,
  Package,
  DollarSign,
  Users,
  Settings,
  Menu,
  LogOut,
  User,
  PackageSearch,
  BarChart3,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    title: 'Inicio',
    href: '/admin/inicio',
    icon: <Home className="h-5 w-5" />,
    roles: ['operador'],
  },
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Recaudaciones Totales',
    href: '/admin/recaudaciones-general',
    icon: <DollarSign className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Gestión de Clientes',
    href: '/admin/clients-management',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Gestión de Empleados',
    href: '/admin/empleados',
    icon: <User className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Máquinas',
    href: '/admin/maquinas',
    icon: <Package className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Stock',
    href: '/admin/stock',
    icon: <PackageSearch className="h-5 w-5" />,
    roles: ['admin', 'operador'],
  },
  {
    title: 'Nóminas',
    href: '/admin/nominas',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
];

function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { currentUser, hasRole, loading } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return hasRole(item.roles as any);
  });

  return (
    <div className={cn('pb-12 min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50', className)}>
      <div className="space-y-4 py-6">
        <div className="px-4 py-2">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="-mt-10 w-full">
              <Image
                src="/logo.png"
                alt="Lify Vending Logo"
                width={240}
                height={240}
                className="w-full h-auto"
                priority
              />
            </div>
            <p className="-mt-20 text-xs font-semibold text-emerald-700">Panel de Administración</p>
          </div>
          <div className="space-y-1">
            {filteredNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sm font-medium transition-all duration-200 rounded-lg",
                    pathname === item.href
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                      : 'text-zinc-700 hover:bg-white hover:text-emerald-600 hover:shadow-sm'
                  )}
                >
                  {item.icon}
                  <span className="ml-3">{item.title}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // NO iniciar scraping automáticamente - causaba problemas de rendimiento
  // Los usuarios pueden iniciar manualmente desde la página de Stock

  // Mostrar loader mientras carga el usuario, pero no bloquear toda la UI
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 light">
        {/* Skeleton del sidebar */}
        <aside className="hidden lg:block w-64 border-r border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 shadow-sm">
          <div className="space-y-4 py-6">
            <div className="px-4 py-2">
              <div className="mb-8 flex flex-col items-center">
                <div className="w-48 h-32 bg-emerald-100 animate-pulse rounded-lg"></div>
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-white/60 animate-pulse rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Contenido con loader */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-zinc-700 font-medium">Cargando sesión...</p>
          </div>
        </div>
      </div>
    );
  }

  // Verificar autenticación después de cargar
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Acceso denegado</h1>
          <p className="text-zinc-500">Debe iniciar sesión para acceder</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen light">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 shadow-sm">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <ScrollArea className="h-full">
            <Sidebar />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-sm shadow-sm">
          <div className="flex h-16 items-center gap-4 px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-emerald-500 hover:text-white transition-colors rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-semibold text-zinc-900">{currentUser.name}</p>
                <p className="text-xs font-medium text-emerald-600 capitalize">
                  {currentUser.role}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-emerald-100 hover:text-emerald-600 transition-colors rounded-lg"
              >
                <User className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="hover:bg-red-100 hover:text-red-600 transition-colors rounded-lg"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
