'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase-helpers';
import { fetchWithTimeout, withTimeout } from '@/lib/client-timeouts';
import { toast } from 'sonner';

interface Entry {
  id: string;
  machine_id: string;
  year: number;
  month: number;
  amount_total: number;
  gross_amount_internal: number | null;
  generated_by: string | null;
  notes: string | null;
  machines: { name: string; location: string | null } | null;
}
interface HistoryData {
  entries: Entry[];
  machineOptions: Array<{ id: string; name: string; location: string | null }>;
  client: { commission_hide_percent: number };
}
const emptyForm = { machineId: '', period: '', amount: '', amountType: 'gross', notes: '' };
const currency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

export function ClientRevenueHistory({ clientId }: { clientId: string }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const endpoint = `/api/admin/clients/${clientId}/historical-adjustments`;

  const request = useCallback(async (method = 'GET', body?: unknown): Promise<any> => {
    const { data: session, error } = await withTimeout(supabase.auth.getSession(), 10_000);
    if (error || !session.session) throw new Error('La sesión ha caducado. Vuelve a iniciar sesión.');
    const response = await fetchWithTimeout(endpoint, {
      method,
      headers: { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
  }, [endpoint]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await request()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar el histórico.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);

  const nowPeriod = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(new Date());
  const [currentYear, currentMonth] = nowPeriod.split('-').map(Number);
  const previous = new Date(currentYear, currentMonth - 2, 1);
  const maxPeriod = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  const amount = Number(form.amount.replace(',', '.'));
  const preview = form.amountType === 'gross' ? Math.round(amount * (1 - Number(data?.client.commission_hide_percent || 0) / 100) * 100) / 100 : amount;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const [year, month] = form.period.split('-').map(Number);
      if (!form.amount.trim() || !Number.isFinite(amount) || amount < 0) throw new Error('Introduce un importe válido.');
      await request(editingId ? 'PATCH' : 'POST', {
        ...(editingId ? { id: editingId } : {}), machineId: form.machineId, year, month,
        amountTotal: amount, amountType: form.amountType, notes: form.notes,
      });
      setForm({ ...emptyForm, machineId: form.machineId, period: form.period });
      setEditingId(null);
      toast.success('Histórico guardado. Ya está disponible para el cliente.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }

  function edit(entry: Entry) {
    setEditingId(entry.id);
    setError(null);
    // Editar el importe visible guardado evita recalcular meses anteriores si han cambiado los porcentajes.
    setForm({ machineId: entry.machine_id, period: `${entry.year}-${String(entry.month).padStart(2, '0')}`, amount: String(entry.amount_total), amountType: 'visible', notes: entry.notes || '' });
    document.getElementById('history-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await request('DELETE', { id: deleting.id });
      if (editingId === deleting.id) { setEditingId(null); setForm(emptyForm); }
      setDeleting(null);
      toast.success('Entrada manual eliminada.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo eliminar.'); setDeleting(null); }
    finally { setBusy(false); }
  }

  return (
    <Card id="historical">
      <CardHeader>
        <CardTitle>Histórico mensual por máquina</CardTitle>
        <CardDescription>Añade los meses anteriores de un cliente, aunque aún no estuviera dado de alta. El cierre mensual automático sigue activo y respeta las entradas existentes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button variant="outline" onClick={load} disabled={loading || busy}>Actualizar histórico y máquinas</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p role="status">Cargando histórico…</p> : data && <>
          {data.machineOptions.length === 0 ? <p className="text-sm text-muted-foreground">Asigna máquinas al cliente y guarda los cambios antes de cargar sus históricos.</p> : (
            <form id="history-form" onSubmit={save} className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">{editingId ? 'Editar entrada manual' : 'Añadir mes a mano'}</h3>
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="history-machine">Máquina</Label>
                  <select id="history-machine" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
                    <option value="">Selecciona una máquina</option>
                    {data.machineOptions.map(m => <option key={m.id} value={m.id}>{m.name}{m.location ? ` · ${m.location}` : ''}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="history-period">Mes</Label>
                  <Input id="history-period" type="month" required min="2000-01" max={maxPeriod} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="history-type">Tipo de importe</Label>
                  <select id="history-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.amountType} onChange={e => setForm({ ...form, amountType: e.target.value })}>
                    <option value="gross">Bruto: aplicar porcentaje oculto</option>
                    <option value="visible">Final: ya ajustado para el cliente</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="history-amount">Importe (€)</Label>
                  <Input id="history-amount" inputMode="decimal" required placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="history-notes">Nota visible para el cliente (opcional)</Label>
                  <Textarea id="history-notes" maxLength={2000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </fieldset>
              <p className="text-sm text-muted-foreground">{form.amountType === 'gross' ? `Se aplicará el ${data.client.commission_hide_percent}% oculto guardado en la configuración.` : 'El importe ya está ajustado. Se mostrará tal cual, sin volver a descontar el porcentaje oculto.'} Guarda antes cualquier cambio de porcentajes o asignaciones.</p>
              {form.amount.trim() && Number.isFinite(preview) && amount >= 0 && <p className="text-sm font-semibold">El cliente verá: {currency(preview)}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editingId ? 'Guardar entrada' : 'Añadir histórico'}</Button>
                {editingId && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar edición</Button>}
              </div>
            </form>
          )}
          {data.entries.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay meses guardados. Puedes añadir el primero arriba.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Histórico mensual manual y automático del cliente</caption>
                <thead><tr className="border-b"><th className="p-3">Mes</th><th className="p-3">Máquina</th><th className="p-3">Visible para el cliente</th><th className="p-3">Origen</th><th className="p-3">Acciones</th></tr></thead>
                <tbody>{data.entries.map(entry => <tr key={entry.id} className="border-b">
                  <td className="p-3 whitespace-nowrap">{new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(entry.year, entry.month - 1, 1))}</td>
                  <td className="p-3">{entry.machines?.name || 'Máquina'}{entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}</td>
                  <td className="p-3 whitespace-nowrap font-medium">{currency(Number(entry.amount_total))}</td>
                  <td className="p-3"><Badge variant="outline">{entry.generated_by === 'system' ? 'Automático' : 'Manual'}</Badge></td>
                  <td className="p-3">{entry.generated_by !== 'system' && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(entry)}>Editar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(entry)}>Eliminar</Button></div>}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </>}
        <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Eliminar entrada manual</AlertDialogTitle><AlertDialogDescription>Se eliminará el importe de {deleting?.machines?.name} de {deleting?.month}/{deleting?.year} del histórico del cliente. Si corresponde al mes anterior, el cierre automático podrá volver a generarlo.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void remove(); }}>{busy ? 'Eliminando…' : 'Eliminar'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
