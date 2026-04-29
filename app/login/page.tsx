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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Login con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('No se pudo autenticar');
      }

      console.log('Usuario autenticado:', data.user.id, data.user.email);

      // Obtener perfil para verificar rol
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      console.log('Resultado query profiles:', { profile, profileError });

      // Si no existe perfil, el usuario no está autorizado
      if (profileError || !profile) {
        console.error('Perfil no encontrado para usuario:', data.user.id);
        // Cerrar sesión ya que no tiene perfil válido
        await supabase.auth.signOut();
        throw new Error(
          'Usuario no autorizado. Por favor contacta al administrador para obtener acceso.'
        );
      }

      // Redirigir según rol
      if (profile.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (profile.role === 'client') {
        router.push('/client/dashboard');
      } else if (profile.role === 'operador') {
        router.push('/admin/inicio'); // Operadores van a página de inicio
      } else {
        throw new Error('Rol de usuario no válido');
      }

      toast.success('Sesión iniciada correctamente');
    } catch (error: any) {
      console.error('Error en login:', error);
      toast.error(error.message || 'Error al iniciar sesión');
    } finally {
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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
