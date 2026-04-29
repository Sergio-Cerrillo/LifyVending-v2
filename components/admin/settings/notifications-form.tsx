// =====================================================
// Sección: Configuración de Notificaciones
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
import { Loader2, Save, Bell } from 'lucide-react';

import type { NotificationsSettings } from '@/lib/types/settings';

const formSchema = z.object({
  email_notifications_enabled: z.boolean(),
  notify_on_scrape_failure: z.boolean(),
  notify_on_machine_offline: z.boolean(),
  notify_on_low_stock: z.boolean(),
  notify_on_new_client: z.boolean(),
  admin_email: z.string().email('Email inválido'),
  smtp_host: z.string().optional(),
  smtp_port: z.number().optional(),
  smtp_user: z.string().optional(),
  smtp_from_name: z.string().optional(),
  smtp_from_email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface NotificationsFormProps {
  initialData: NotificationsSettings;
}

export function NotificationsForm({ initialData }: NotificationsFormProps) {
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
        body: JSON.stringify({ type: 'notifications', data: values }),
      });
      
      if (response.ok) {
        toast.success('Configuración de notificaciones guardada correctamente');
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
          <Bell className="h-5 w-5" />
          Configuración de Notificaciones
        </CardTitle>
        <CardDescription>
          Alertas por email y configuración SMTP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Settings */}
            <FormField
              control={form.control}
              name="email_notifications_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Notificaciones Email Habilitadas</FormLabel>
                    <FormDescription>
                      Activar el sistema de notificaciones por email
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

            {/* Notification Types */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tipos de Notificaciones</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="notify_on_scrape_failure"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Fallos de Scraping</FormLabel>
                        <FormDescription>
                          Notificar cuando falle el scraping
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
                  name="notify_on_machine_offline"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Máquina Offline</FormLabel>
                        <FormDescription>
                          Notificar cuando una máquina esté offline
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
                  name="notify_on_low_stock"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Stock Bajo</FormLabel>
                        <FormDescription>
                          Notificar cuando el stock sea bajo
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
                  name="notify_on_new_client"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Nuevo Cliente</FormLabel>
                        <FormDescription>
                          Notificar cuando se registre un cliente
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
            </div>

            {/* Admin Email */}
            <FormField
              control={form.control}
              name="admin_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Administrador</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@empresa.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Email principal para recibir notificaciones
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* SMTP Configuration */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium">Configuración SMTP</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="smtp_host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor SMTP</FormLabel>
                      <FormControl>
                        <Input placeholder="smtp.gmail.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puerto SMTP</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="587"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_user"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario SMTP</FormLabel>
                      <FormControl>
                        <Input placeholder="usuario@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_from_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Remitente</FormLabel>
                      <FormControl>
                        <Input placeholder="LifyVending" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_from_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email del Remitente</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="noreply@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
