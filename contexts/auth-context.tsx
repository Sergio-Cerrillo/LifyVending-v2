'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User, UserRole } from '@/lib/types';
import { supabase } from '@/lib/supabase-helpers';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Cargar usuario desde sesión de Supabase
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Obtener perfil
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, display_name')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const user = {
              id: session.user.id,
              email: session.user.email || '',
              name: profile.display_name || session.user.email || '',
              role: profile.role as UserRole,
              permissions: session.user.user_metadata?.permissions || [],
            };
            
            setCurrentUser(user);
          } else {
            console.error('No se encontró perfil para el usuario');
          }
        }
      } catch (error) {
        console.error('Error cargando usuario:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, display_name')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email || '',
              name: profile.display_name || session.user.email || '',
              role: profile.role as UserRole,
              permissions: session.user.user_metadata?.permissions || [],
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Error en login:', error);
        return false;
      }

      return !!data.user;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      sessionStorage.clear();
      router.push('/');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const hasRole = (roles: UserRole[]): boolean => {
    return currentUser ? roles.includes(currentUser.role) : false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
