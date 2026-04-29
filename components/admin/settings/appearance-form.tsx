// =====================================================
// Sección: Configuración de Apariencia
// =====================================================

'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, Palette } from 'lucide-react';
import { updateAppearanceConfig } from '@/lib/services/settings-service';
import type { AppearanceSettings } from '@/lib/types/settings';

const formSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  primary_color: z.string().min(4).max(7),
  logo_url: z.string().url('URL inválida').optional().or(z.literal('')),
  favicon_url: z.string().url('URL inválida').optional().or(z.literal('')),
  company_logo_url: z.string().url('URL inválida').optional().or(z.literal('')),
  show_branding: z.boolean(),
  custom_css: z.string().optional(),
  welcome_message: z.string().optional(),
  footer_text: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AppearanceFormProps {
  initialData: AppearanceSettings;
}

export function AppearanceForm({ initialData }: AppearanceFormProps) {
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
        body: JSON.stringify({ type: 'appearance', data: values }),
      });
      
      if (response.ok) {
        toast.success('Configuración de apariencia guardada correctamente');
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
          <Palette className="h-5 w-5" />
          Configuración de Apariencia
        </CardTitle>
        <CardDescription>
          Personalización visual de la aplicación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Theme Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tema</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tema" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Oscuro</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Tema de color de la aplicación
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Primario</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="color" {...field} className="w-20 h-10" />
                      </FormControl>
                      <Input
                        type="text"
                        placeholder="#3b82f6"
                        value={field.value}
                        onChange={field.onChange}
                        className="flex-1"
                      />
                    </div>
                    <FormDescription>
                      Color principal de la interfaz (hex)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Branding */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium">Branding</h3>

              <FormField
                control={form.control}
                name="show_branding"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Mostrar Branding</FormLabel>
                      <FormDescription>
                        Mostrar logotipos y marca de la empresa
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

              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Logo (Panel Admin)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com/logo.png"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Logo visible en el panel de administración
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Logo de Empresa</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com/company-logo.png"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Logo de empresa para documentos y emails
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="favicon_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Favicon</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com/favicon.ico"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Icono mostrado en la pestaña del navegador
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Content Customization */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium">Personalización de Contenido</h3>

              <FormField
                control={form.control}
                name="welcome_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje de Bienvenida</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Bienvenido al Panel de Administración de LifyVending"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Mensaje mostrado al iniciar sesión
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="footer_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Texto del Pie de Página</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="© 2026 LifyVending. Todos los derechos reservados."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Texto mostrado en el pie de página
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced Customization */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium">CSS Personalizado (Avanzado)</h3>

              <FormField
                control={form.control}
                name="custom_css"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSS Personalizado</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder=".custom-class { color: #3b82f6; }"
                        className="resize-none font-mono text-sm"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Estilos CSS personalizados aplicados globalmente
                    </FormDescription>
                    <FormMessage />
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
