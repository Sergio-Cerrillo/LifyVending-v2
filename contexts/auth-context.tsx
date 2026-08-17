'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User, UserRole } from '@/lib/types';
import { supabase } from '@/lib/supabase-helpers';
import { RequestTimeoutError, withTimeout } from '@/lib/client-timeouts';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_TIMEOUT_MS = 25_000;
const VALID_ROLES: UserRole[] = ['admin', 'client', 'gestor', 'operador', 'reponedor'];

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

function buildUserFromSession(sessionUser: any, profile?: { role?: unknown; display_name?: string | null } | null): User | null {
  const metadataRole = sessionUser.user_metadata?.role;
  const role = isValidRole(profile?.role) ? profile.role : isValidRole(metadataRole) ? metadataRole : null;

  if (!role) return null;

  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: profile?.display_name || sessionUser.user_metadata?.name || sessionUser.email || '',
    role,
    permissions: sessionUser.user_metadata?.permissions || [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadProfile(sessionUser: any) {
    try {
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('role, display_name')
          .eq('id', sessionUser.id)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS,
        'No se pudo cargar el perfil',
      );

      if (profileError) {
        console.warn('No se pudo cargar el perfil:', profileError.message);
      }

      const user = buildUserFromSession(sessionUser, profile);
      if (user) {
        setCurrentUser(user);
        return;
      }

      console.warn('No se encontró un rol válido para el usuario');
      setCurrentUser(null);
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        console.warn('La carga del perfil tardó demasiado; usando metadatos de sesión si están disponibles.');
      } else {
        console.warn('Error cargando perfil:', error);
      }

      const fallbackUser = buildUserFromSession(sessionUser);
      setCurrentUser(fallbackUser);
    }
  }

  // Cargar usuario desde sesión de Supabase
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          'No se pudo validar la sesión',
        );

        if (session?.user) {
          await loadProfile(session.user);
        }
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          console.warn('La validación de sesión tardó demasiado.');
        } else {
          console.warn('Error cargando usuario:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user);
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
