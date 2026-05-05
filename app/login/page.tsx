'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase-helpers';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null); // Limpiar errores anteriores

    try {
      // Login con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Manejo específico de errores de autenticación
      if (error) {
        // Log solo en desarrollo (opcional para debugging)
        if (process.env.NODE_ENV === 'development') {
          console.log('[LOGIN] Error de autenticación:', error.message);
        }
        
        // Mensajes de error personalizados según el tipo
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid email or password')) {
          const msg = 'Email o contraseña incorrectos';
          setErrorMessage(msg);
          toast.error(msg, {
            description: 'Por favor verifica tus credenciales e intenta de nuevo',
            duration: 4000
          });
          return;
        } else if (error.message.includes('Email not confirmed')) {
          const msg = 'Email no confirmado';
          setErrorMessage(msg);
          toast.error(msg, {
            description: 'Por favor confirma tu email antes de iniciar sesión',
            duration: 4000
          });
          return;
        } else if (error.message.includes('Too many requests')) {
          const msg = 'Demasiados intentos';
          setErrorMessage(msg);
          toast.error(msg, {
            description: 'Por favor espera unos minutos antes de intentar de nuevo',
            duration: 5000
          });
          return;
        } else {
          setErrorMessage('Error al iniciar sesión');
          toast.error('Error al iniciar sesión', {
            description: error.message,
            duration: 4000
          });
          return;
        }
      }

      if (!data.user) {
        const msg = 'No se pudo obtener la información del usuario';
        setErrorMessage(msg);
        toast.error('Error al iniciar sesión', {
          description: msg,
          duration: 4000
        });
        return;
      }

      // Obtener perfil para verificar rol
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // Si no existe perfil, el usuario no está autorizado
      if (profileError || !profile) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LOGIN] Perfil no encontrado para usuario:', data.user.id);
        }
        console.error('[LOGIN] Perfil no encontrado para usuario:', data.user.id);
        
        // Cerrar sesión ya que no tiene perfil válido
        await supabase.auth.signOut();
        
        const msg = 'Tu cuenta no tiene un perfil asignado';
        setErrorMessage(msg);
        toast.error('Usuario no autorizado', {
          description: msg + '. Contacta al administrador.',
          duration: 5000
        });
        return;
      }

      console.log('[LOGIN] Perfil encontrado, rol:', profile.role);

      // Redirigir según rol
      // Redirigir según rol
      if (profile.role === 'admin') {
        toast.success('Bienvenido, administrador');
        router.push('/admin/dashboard');
      } else if (profile.role === 'client') {
        toast.success('Bienvenido');
        router.push('/client/dashboard');
      } else if (profile.role === 'operador') {
        toast.success('Bienvenido, operador');
        router.push('/admin/inicio'); // Operadores van a página de inicio
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[LOGIN] Rol no válido:', profile.role);
        }
        toast.error(msg, {
          description: 'Contacta al administrador para resolver este problema',
          duration: 4000
        });
        return;
      }

    } catch (error: any) {
      // Captura de errores inesperados
      setErrorMessage('Error inesperado al iniciar sesión');
      toast.error('Error inesperado', {
        description: 'Error inesperado al iniciar sesión. Intenta de nuevo.',
        duration: 4000
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('[LOGIN] Error inesperado:', error);
      }
    } finally {
      // SIEMPRE liberar el estado de loading
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-primary/5 to-background p-4">
      <div className="absolute inset-0 bg-grid-white/10" />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <Card className="border-2 shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-20 h-20">
                <Image
                  src="/logo.png"
                  alt="Lify Vending Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                />
              </div>
            </div>
            <div className="text-center">
              <CardTitle className="text-3xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Área Privada
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Panel de administración Lify Vending
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mensaje de error visible */}
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-800">
                      Error de autenticación
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null); // Limpiar error al escribir
                    }}
                    className="pl-10 border-2"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null); // Limpiar error al escribir
                    }}
                    className="pl-10 border-2"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg text-base py-6"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Entrar al Panel'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Acceso exclusivo para personal autorizado
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Lify Vending. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </main>
  );
}
