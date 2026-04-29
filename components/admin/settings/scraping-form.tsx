// =====================================================
// Sección: Configuración de Scraping
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, PlayCircle, Activity } from 'lucide-react';
import type { ScrapingSettings, ScrapingStatus } from '@/lib/types/settings';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  enabled: z.boolean(),
  orain_enabled: z.boolean(),
  televend_enabled: z.boolean(),
  default_interval_hours: z.number().min(1, 'Mínimo 1 hora').max(168, 'Máximo 168 horas (7 días)'),
  retry_attempts: z.number().min(0).max(10),
  retry_delay_minutes: z.number().min(1).max(60),
  timeout_seconds: z.number().min(10).max(300),
  concurrent_scrapes: z.number().min(1).max(10),
  headless_mode: z.boolean(),
  screenshot_on_error: z.boolean(),
  notification_on_failure: z.boolean(),
  log_level: z.enum(['error', 'warn', 'info', 'debug']),
});

type FormValues = z.infer<typeof formSchema>;

interface ScrapingFormProps {
  initialData: ScrapingSettings;
}

export function ScrapingForm({ initialData }: ScrapingFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggeringManual, setIsTriggeringManual] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<ScrapingStatus | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'scraping', data: values }),
      });
      
      if (response.ok) {
        toast.success('Configuración de scraping guardada correctamente');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualTrigger() {
    setIsTriggeringManual(true);
    try {
      const response = await fetch('/api/admin/force-scrape', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('Scraping manual iniciado correctamente');
        // Refresh status after a delay
        setTimeout(loadScrapingStatus, 2000);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al iniciar el scraping manual');
      }
    } catch (error) {
      console.error('Error triggering manual scraping:', error);
      toast.error('Error al iniciar el scraping manual');
    } finally {
      setIsTriggeringManual(false);
    }
  }

  async function loadScrapingStatus() {
    try {
      const response = await fetch('/api/admin/settings/status');
      if (response.ok) {
        const status = await response.json();
        setScrapingStatus(status);
      }
    } catch (error) {
      console.error('Error loading scraping status:', error);
    }
  }

  // Load status on mount
  useEffect(() => {
    loadScrapingStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Status Card */}
      {scrapingStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Estado del Scraping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Ejecuciones</div>
                <div className="text-2xl font-bold">{scrapingStatus.total_runs}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Exitosas</div>
                <div className="text-2xl font-bold text-green-600">{scrapingStatus.successful_runs}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Fallidas</div>
                <div className="text-2xl font-bold text-red-600">{scrapingStatus.failed_runs}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tasa de Éxito</div>
                <div className="text-2xl font-bold">{scrapingStatus.success_rate.toFixed(1)}%</div>
              </div>
            </div>

            {scrapingStatus.last_run_at && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Última Ejecución</div>
                    <div className="text-sm font-medium">
                      {new Date(scrapingStatus.last_run_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <Badge variant={scrapingStatus.last_run_status === 'success' ? 'default' : 'destructive'}>
                    {scrapingStatus.last_run_status === 'success' ? 'Exitosa' : 'Fallida'}
                  </Badge>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                onClick={handleManualTrigger}
                disabled={isTriggeringManual}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isTriggeringManual ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Ejecutar Scraping Manual
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Scraping</CardTitle>
          <CardDescription>
            Control de la extracción automática de datos de máquinas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Master Switch */}
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Scraping Habilitado</FormLabel>
                      <FormDescription>
                        Activar o desactivar el sistema de scraping global
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Provider Switches */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orain_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Orain-Frekuent Habilitado</FormLabel>
                        <FormDescription>Scraping de máquinas Orain-Frekuent</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="televend_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Televend Habilitado</FormLabel>
                        <FormDescription>Scraping de máquinas Televend</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Interval and Retry Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="default_interval_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo Por Defecto (horas)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Frecuencia de scraping automático
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retry_attempts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intentos de Reintento</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Número de reintentos en caso de fallo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retry_delay_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay Entre Reintentos (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeout_seconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (segundos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={300}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Tiempo máximo de espera por scrape
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="concurrent_scrapes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scrapes Concurrentes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Número máximo de scrapes simultáneos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="log_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nivel de Log</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona nivel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="warn">Warning</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="debug">Debug</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Options */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="headless_mode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Modo Headless</FormLabel>
                        <FormDescription>
                          Ejecutar navegador sin interfaz gráfica (recomendado)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="screenshot_on_error"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Captura en Error</FormLabel>
                        <FormDescription>
                          Guardar screenshot cuando falla el scraping
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_on_failure"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Notificar Fallos</FormLabel>
                        <FormDescription>
                          Enviar email cuando falla el scraping
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
