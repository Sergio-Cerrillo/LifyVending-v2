// =====================================================
// Sección: Configuración de Clientes
// =====================================================

'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

import type { ClientsSettings } from '@/lib/types/settings';

const formSchema = z.object({
  default_percentage: z.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100'),
  allow_custom_percentage: z.boolean(),
  auto_refresh_enabled: z.boolean(),
  refresh_interval_minutes: z.number().min(1).max(1440, 'El intervalo debe estar entre 1 y 1440 minutos'),
  max_refresh_requests_per_day: z.number().min(1).max(100),
  require_approval_for_new_clients: z.boolean(),
  allow_client_registration: z.boolean(),
  client_portal_enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ClientsFormProps {
  initialData: ClientsSettings;
}

export function ClientsForm({ initialData }: ClientsFormProps) {
  const [isLoading, setIsLoading] = useState(false);

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
        body: JSON.stringify({ type: 'clients', data: values }),
      });
      
      if (response.ok) {
        toast.success('Configuración de clientes guardada correctamente');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Clientes</CardTitle>
        <CardDescription>
          Valores por defecto y reglas para clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Portal Settings */}
            <FormField
              control={form.control}
              name="client_portal_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Portal Cliente Habilitado</FormLabel>
                    <FormDescription>
                      Permitir acceso al portal de clientes
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

            {/* Percentage Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="default_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentaje Por Defecto</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Porcentaje asignado a nuevos clientes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allow_custom_percentage"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Permitir Porcentaje Personalizado</FormLabel>
                      <FormDescription>
                        Los admins pueden asignar % diferente
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

            {/* Auto-Refresh Settings */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="auto_refresh_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Auto-Refresh Habilitado</FormLabel>
                      <FormDescription>
                        Actualización automática de datos para clientes
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="refresh_interval_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo de Refresco (minutos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Frecuencia de actualización automática
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_refresh_requests_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. Peticiones/Día</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Límite de peticiones manuales por cliente
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Registration Settings */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="allow_client_registration"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Permitir Auto-Registro</FormLabel>
                      <FormDescription>
                        Permitir que nuevos clientes se registren
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
                name="require_approval_for_new_clients"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Requiere Aprobación</FormLabel>
                      <FormDescription>
                        Nuevos clientes deben ser aprobados por admin
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
  );
}
