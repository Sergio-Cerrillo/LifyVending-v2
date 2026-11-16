'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-helpers';
import { fetchWithTimeout, withTimeout } from '@/lib/client-timeouts';
import type { DocumentationCatalog } from '@/lib/documentation/pricing';

export function useDocumentationCatalog(defaults: DocumentationCatalog) {
  const [catalog, setCatalog] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(defaults);
  const latest = useRef(catalog);
  latest.current = catalog;
  const saved = useRef(defaults);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const request = useCallback(async (method: string, body?: unknown) => {
    const { data } = await withTimeout(supabase.auth.getSession(), 10_000);
    if (!data.session) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    const response = await fetchWithTimeout('/api/admin/documentation/prices', {
      method, headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron guardar los precios.');
    return result;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await request('GET');
      const merged = { ...defaults, ...result.catalog };
      saved.current = merged;
      setBaseline(merged);
      setCatalog(merged);
      setReady(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.'); }
  }, [defaults, request]);
  useEffect(() => { void load(); }, [load]);

  // Serializa los guardados: una respuesta lenta nunca pisa un precio más reciente.
  const save = useCallback(() => {
    const task = queue.current.catch(() => {}).then(async () => {
      if (!ready) throw new Error('Carga primero el catálogo para guardar precios.');
      const snapshot = latest.current;
      if (alive.current) { setSaving(true); setError(null); }
      try {
        for (const [productKey, prices] of Object.entries(snapshot)) {
          if (JSON.stringify(saved.current[productKey]) === JSON.stringify(prices)) continue;
          await request('PATCH', { productKey, ...prices });
          saved.current = { ...saved.current, [productKey]: prices };
          if (alive.current) setBaseline(saved.current);
        }
      } catch (err) {
        if (alive.current) setError(err instanceof Error ? err.message : 'No se pudieron guardar los precios.');
        throw err;
      } finally { if (alive.current) setSaving(false); }
    });
    queue.current = task;
    return task;
  }, [ready, request]);
  const dirty = JSON.stringify(catalog) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!ready || !dirty) return;
    const timer = setTimeout(() => { void save().catch(() => {}); }, 700);
    return () => clearTimeout(timer);
  }, [catalog, dirty, ready, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return { catalog, setCatalog, ready, saving, dirty, error, load, save };
}
