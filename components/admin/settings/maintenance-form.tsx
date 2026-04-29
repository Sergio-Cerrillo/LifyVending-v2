// =====================================================
// Sección: Mantenimiento
// =====================================================

'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle, Wrench } from 'lucide-react';

import type { MaintenanceSettings } from '@/lib/types/settings';

const formSchema = z.object({
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().optional(),
  allow_admin_access: z.boolean(),
  scheduled_maintenance: z.boolean(),
  maintenance_start: z.string().optional(),
  maintenance_end: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface MaintenanceFormProps {
  initialData: MaintenanceSettings;
}

export function MaintenanceForm({ initialData }: MaintenanceFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  });

  const maintenanceMode = form.watch('maintenance_mode');

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'maintenance', data: values }),
      });
      
      if (response.ok) {
        toast.success('Configuración de mantenimiento guardada correctamente');
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
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Mantenimiento
        </CardTitle>
        <CardDescription>
          Control del modo de mantenimiento de la aplicación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Warning Alert */}
            {maintenanceMode && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El modo de mantenimiento está activo. Los usuarios no podrán acceder a la aplicación.
                </AlertDescription>
              </Alert>
            )}

            {/* Maintenance Mode Toggle */}
            <FormField
              control={form.control}
              name="maintenance_mode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-destructive/5">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Modo de Mantenimiento</FormLabel>
                    <FormDescription>
                      Activar para deshabilitar el acceso de usuarios
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

            {/* Maintenance Message */}
            <FormField
              control={form.control}
              name="maintenance_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensaje de Mantenimiento</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Estamos realizando tareas de mantenimiento. Volveremos pronto."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mensaje mostrado a los usuarios durante el mantenimiento
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Admin Access */}
            <FormField
              control={form.control}
              name="allow_admin_access"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Permitir Acceso a Administradores</FormLabel>
                    <FormDescription>
                      Los administradores pueden acceder durante el mantenimiento
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

            {/* Scheduled Maintenance */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium">Mantenimiento Programado</h3>

              <FormField
                control={form.control}
                name="scheduled_maintenance"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Programar Mantenimiento</FormLabel>
                      <FormDescription>
                        Activar/desactivar automáticamente según horario
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

              {form.watch('scheduled_maintenance') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4">
                  <FormField
                    control={form.control}
                    name="maintenance_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha y Hora de Inicio</FormLabel>
                        <FormControl>
                          <input
                            type="datetime-local"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Cuándo comenzar el mantenimiento
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maintenance_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha y Hora de Finalización</FormLabel>
                        <FormControl>
                          <input
                            type="datetime-local"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Cuándo finalizar el mantenimiento
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Information Box */}
            <Alert>
              <AlertDescription>
                <strong>Nota:</strong> Cuando el modo de mantenimiento está activo, solo los administradores (si está habilitado) podrán acceder al sistema. Todos los demás usuarios verán el mensaje de mantenimiento.
              </AlertDescription>
            </Alert>

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
