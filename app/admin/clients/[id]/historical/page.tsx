'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingInline } from '@/components/ui/loading-screen';
import { AlertTriangle, ArrowLeft, Calendar, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryEntry {
    id: string;
    machine_id: string;
    machines?: {
        id: string;
        name: string;
        location: string | null;
    } | null;
    year: number;
    month: number;
    amount_total: number;
    notes: string | null;
    updated_at: string;
}

interface MachineOption {
    id: string;
    name: string;
    location: string | null;
}

interface ClientInfo {
    id: string;
    email: string;
    display_name: string | null;
    company_name: string | null;
    commission_hide_percent?: number;
    commission_payment_percent?: number;
}

interface FormState {
    id: string | null;
    machineId: string;
    year: string;
    month: string;
    amountReal: string;
    notes: string;
}

const MONTH_OPTIONS = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
];

function getDefaultForm(): FormState {
    const now = new Date();
    return {
        id: null,
        machineId: '',
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
        amountReal: '0',
        notes: '',
    };
}

export default function ClientHistoricalAdjustmentsPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();

    const clientId = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [client, setClient] = useState<ClientInfo | null>(null);
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);
    const [form, setForm] = useState<FormState>(getDefaultForm());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        loadData();
    }, [clientId]);

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
    }, [entries]);

    const paymentPercent = Number(client?.commission_payment_percent ?? 0);
    const paymentRate = paymentPercent > 1 ? paymentPercent / 100 : paymentPercent;
    const paymentPercentDisplay = paymentRate * 100;
    const hidePercent = Number(client?.commission_hide_percent ?? 0);
    const hideRate = hidePercent > 1 ? hidePercent / 100 : hidePercent;
    const visibleRate = Math.max(0, 1 - hideRate);
    const formRealAmount = Number(form.amountReal || 0);
    const formVisibleAmount = Math.round((formRealAmount * visibleRate) * 100) / 100;
    const formCommission = Math.round((formVisibleAmount * paymentRate) * 100) / 100;

    async function getToken(): Promise<string | null> {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            router.push('/login');
            return null;
        }
        return sessionData.session.access_token;
    }

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const token = await getToken();
            if (!token) return;

            const response = await fetch(`/api/admin/clients/${clientId}/historical-adjustments`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || 'Error cargando histórico');
            }

            setClient(json.client || null);
            setEntries((json.entries || []).map((row: any) => ({
                ...row,
                amount_total: Number(row.amount_total || 0),
            })));
            setMachineOptions(json.machineOptions || []);
            setForm((prev) => ({
                ...prev,
                machineId: prev.machineId || json.machineOptions?.[0]?.id || '',
            }));
        } catch (err: any) {
            setError(err.message || 'Error cargando histórico');
        } finally {
            setLoading(false);
        }
    }

    function startCreate() {
        setForm(getDefaultForm());
    }

    function startEdit(entry: HistoryEntry) {
        const estimatedRealAmount = visibleRate > 0
            ? Math.round((entry.amount_total / visibleRate) * 100) / 100
            : entry.amount_total;

        setForm({
            id: entry.id,
            machineId: entry.machine_id,
            year: String(entry.year),
            month: String(entry.month),
            amountReal: String(estimatedRealAmount),
            notes: entry.notes || '',
        });
    }

    async function saveEntry() {
        try {
            setSaving(true);
            setError(null);

            const token = await getToken();
            if (!token) return;

            const payload = {
                ...(form.id ? { id: form.id } : {}),
                machineId: form.machineId,
                year: Number(form.year),
                month: Number(form.month),
                amountTotal: formVisibleAmount,
                notes: form.notes.trim() || null,
            };

            const method = form.id ? 'PATCH' : 'POST';

            const response = await fetch(`/api/admin/clients/${clientId}/historical-adjustments`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || 'No se pudo guardar el ajuste');
            }

            toast.success(form.id ? 'Mes actualizado' : 'Mes creado');
            setForm(getDefaultForm());
            await loadData();
        } catch (err: any) {
            setError(err.message || 'No se pudo guardar');
            toast.error('Error guardando ajuste', { description: err.message });
        } finally {
            setSaving(false);
        }
    }

    async function deleteEntry(id: string) {
        try {
            setDeletingId(id);
            setError(null);

            const token = await getToken();
            if (!token) return;

            const response = await fetch(`/api/admin/clients/${clientId}/historical-adjustments`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || 'No se pudo eliminar');
            }

            toast.success('Mes eliminado');
            await loadData();
        } catch (err: any) {
            setError(err.message || 'No se pudo eliminar');
            toast.error('Error eliminando ajuste', { description: err.message });
        } finally {
            setDeletingId(null);
        }
    }

    function formatMonth(year: number, month: number): string {
        const date = new Date(year, month - 1, 1);
        return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
    }

    function formatCurrency(value: number): string {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value || 0);
    }

    if (loading) {
        return <LoadingInline message="Cargando ajustes históricos..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Ajuste de Histórico</h1>
                    <p className="text-sm text-zinc-600">
                        {client?.company_name || client?.display_name || client?.email || 'Cliente'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="https://frekuent.io/app/frekuent-spots/points-of-sale"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline">
                            <Calendar className="w-4 h-4 mr-2" />
                            Ir a máquinas Frekuent
                        </Button>
                    </Link>
                    <Link href="/admin/clients-management">
                        <Button variant="outline">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Volver
                        </Button>
                    </Link>
                </div>
            </div>

            {error && (
                <Card className="border-red-300">
                    <CardContent className="pt-6 text-red-700 text-sm">{error}</CardContent>
                </Card>
            )}

            <Card className="border-amber-300 bg-amber-50">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Recordatorio de comisión oculta</p>
                            <p className="text-sm text-amber-800">
                                Este cliente tiene configurado <strong>{Number(client?.commission_hide_percent ?? 0).toFixed(2)}%</strong> oculto.
                                Tenlo en cuenta al crear o editar importes históricos.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{form.id ? 'Editar mes histórico' : 'Nuevo mes histórico'}</CardTitle>
                    <CardDescription>
                        Define un valor mensual persistente para mostrar al cliente en la pestaña de histórico.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="machine">Máquina</Label>
                            <select
                                id="machine"
                                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                                value={form.machineId}
                                onChange={(e) => setForm((prev) => ({ ...prev, machineId: e.target.value }))}
                            >
                                {machineOptions.map((machine) => (
                                    <option key={machine.id} value={machine.id}>
                                        {machine.name}{machine.location ? ` - ${machine.location}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="year">Año</Label>
                            <Input
                                id="year"
                                type="number"
                                min={2000}
                                max={2100}
                                value={form.year}
                                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="month">Mes</Label>
                            <select
                                id="month"
                                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                                value={form.month}
                                onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
                            >
                                {MONTH_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Importe real del mes (€)</Label>
                            <Input
                                id="amount"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.amountReal}
                                onChange={(e) => setForm((prev) => ({ ...prev, amountReal: e.target.value }))}
                            />
                            <p className="text-xs text-zinc-600">
                                Se mostrará al cliente: {formatCurrency(formVisibleAmount)}
                                {' '}(-{(hideRate * 100).toFixed(2)}%)
                            </p>
                            <p className="text-xs text-zinc-600">
                                A abonar {formatCurrency(formCommission)} ({paymentPercentDisplay.toFixed(2)}%)
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                            id="notes"
                            value={form.notes}
                            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder="Ej: Ajuste cerrado con cliente"
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={saveEntry} disabled={saving}>
                            {form.id ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear'}
                        </Button>
                        {form.id && (
                            <Button variant="outline" onClick={startCreate}>
                                Cancelar edición
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Meses creados ({sortedEntries.length})</CardTitle>
                    <CardDescription>
                        Histórico mensual manual visible para el cliente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sortedEntries.length === 0 ? (
                        <p className="text-sm text-zinc-500">No hay meses creados todavía.</p>
                    ) : (
                        <div className="space-y-3">
                            {sortedEntries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="rounded-lg border border-zinc-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-zinc-300">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {formatMonth(entry.year, entry.month)}
                                            </Badge>
                                            <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">
                                                {entry.machines?.name || 'Máquina'}
                                            </Badge>
                                            <span className="font-semibold text-zinc-900">{formatCurrency(entry.amount_total)}</span>
                                            <span className="text-sm text-zinc-600">
                                                A abonar {formatCurrency(entry.amount_total * paymentRate)}
                                            </span>
                                        </div>
                                        {entry.notes && <p className="text-sm text-zinc-600">{entry.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => startEdit(entry)}>
                                            <Pencil className="w-4 h-4 mr-1" />
                                            Editar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => deleteEntry(entry.id)}
                                            disabled={deletingId === entry.id}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            {deletingId === entry.id ? 'Eliminando...' : 'Eliminar'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
