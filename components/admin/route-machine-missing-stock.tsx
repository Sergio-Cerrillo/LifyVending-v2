'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getFreshAccessToken } from '@/lib/auth-session';
import { fetchWithTimeout } from '@/lib/client-timeouts';

interface MissingStock {
  machineName: string;
  location: string | null;
  requestedAt: string;
  totalUnits: number;
  products: Array<{ productName: string; units: number; lines: string[] }>;
}

export function RouteMachineMissingStock({ routeMachineId, machineName }: { routeMachineId: string; machineName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MissingStock | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const token = await getFreshAccessToken();
        if (cancelled) return;
        const response = await fetchWithTimeout(`/api/admin/routes/stock?${new URLSearchParams({ routeMachineId })}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        }, 60_000);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo consultar el stock');
        if (!cancelled) setData(result);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo consultar el stock'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [open, routeMachineId, attempt]);

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-label={`Ver faltantes de ${machineName}`}
      className="col-span-2 min-h-12 h-auto whitespace-normal rounded-2xl bg-white px-3 py-2 font-black text-zinc-950 shadow-sm">
      <ClipboardList className="mr-2 h-5 w-5 shrink-0" />Ver faltantes
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="break-words">Qué llevar · {machineName}</DialogTitle>
          <DialogDescription>Productos y unidades que faltan para completar la máquina. Esta consulta no modifica el stock ni el estado de la ruta.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto" aria-live="polite">
          {loading && <div role="status" className="flex items-center gap-2 py-8 text-sm text-zinc-600"><Loader2 className="h-5 w-5 animate-spin" />Consultando productos en el proveedor…</div>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {!loading && data && <>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Para cargar en la furgoneta</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{data.totalUnits} unidades · {data.products.length} productos</p>
            </div>
            {data.products.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm">Según el stock consultado, no falta ningún producto en esta máquina.</p> : <ul className="space-y-2">
              {data.products.map(product => <li key={product.productName} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3">
                <div className="min-w-0"><p className="break-words font-semibold text-zinc-950">{product.productName}</p>{product.lines.length > 0 && <p className="mt-1 break-words text-xs text-zinc-500">Líneas: {product.lines.join(', ')}</p>}</div>
                <span className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1 font-black text-emerald-800">{product.units} uds.</span>
              </li>)}
            </ul>}
            <p className="text-xs text-zinc-500">Consulta: {new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.requestedAt))}. Las cantidades pueden cambiar con nuevas ventas.</p>
          </>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" disabled={loading} onClick={() => setAttempt(current => current + 1)}><RefreshCw className="mr-2 h-4 w-4" />{error ? 'Reintentar' : 'Actualizar'}</Button>
          <Button type="button" onClick={() => setOpen(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
