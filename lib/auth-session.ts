'use client';

import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-helpers';
import { withTimeout } from '@/lib/client-timeouts';

const SESSION_TIMEOUT_MS = 12_000;
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

export async function getFreshSession(): Promise<Session> {
  const { data: sessionData, error } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_TIMEOUT_MS,
    'No se pudo validar la sesión',
  );

  if (error) {
    throw new Error(error.message || 'No se pudo validar la sesión');
  }

  let session = sessionData.session;
  if (!session) {
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
  const shouldRefresh = expiresAt !== null && expiresAt - Date.now() < REFRESH_BEFORE_EXPIRY_MS;

  if (shouldRefresh) {
    const { data: refreshedData, error: refreshError } = await withTimeout(
      supabase.auth.refreshSession(),
      SESSION_TIMEOUT_MS,
      'No se pudo renovar la sesión',
    );

    if (refreshError) {
      throw new Error(refreshError.message || 'No se pudo renovar la sesión');
    }

    if (!refreshedData.session) {
      throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    }

    session = refreshedData.session;
  }

  return session;
}

export async function getFreshAccessToken(): Promise<string> {
  const session = await getFreshSession();
  return session.access_token;
}
