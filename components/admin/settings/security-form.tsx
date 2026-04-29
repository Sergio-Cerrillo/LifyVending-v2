// =====================================================
// Sección: Configuración de Seguridad
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
import { Loader2, Save, Shield } from 'lucide-react';

import type { SecuritySettings } from '@/lib/types/settings';

const formSchema = z.object({
  password_min_length: z.number().min(6).max(32),
  password_require_uppercase: z.boolean(),
  password_require_lowercase: z.boolean(),
  password_require_numbers: z.boolean(),
  password_require_special: z.boolean(),
  session_timeout_minutes: z.number().min(5).max(10080), // 5 min to 7 days
  max_login_attempts: z.number().min(1).max(20),
  lockout_duration_minutes: z.number().min(1).max(1440),
  require_email_verification: z.boolean(),
  two_factor_enabled: z.boolean(),
  ip_whitelist_enabled: z.boolean(),
  allowed_ips: z.string().optional(),
  rate_limit_enabled: z.boolean(),
  rate_limit_requests_per_minute: z.number().min(1).max(1000),
});

type FormValues = z.infer<typeof formSchema>;

interface SecurityFormProps {
  initialData: SecuritySettings;
}

export function SecurityForm({ initialData }: SecurityFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...initialData,
      allowed_ips: initialData.allowed_ips?.join(', ') || '',
    },
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      // Convert allowed_ips string to array
      const processedValues = {
        ...values,
        allowed_ips: values.allowed_ips
          ? values.allowed_ips.split(',').map(ip => ip.trim()).filter(Boolean)
          : [],
      };

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'security', data: processedValues }),
      });
      
      if (response.ok) {
        toast.success('Configuración de seguridad guardada correctamente');
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configuración de Seguridad
          </CardTitle>
          <CardDescription>
            Políticas de autenticación y protección
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Password Policy */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Política de Contraseñas</h3>
                
                <FormField
                  control={form.control}
                  name="password_min_length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitud Mínima</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={6}
                          max={32}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Número mínimo de caracteres (6-32)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password_require_uppercase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Mayúsculas</FormLabel>
                          <FormDescription>
                            Requerir al menos una mayúscula
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
                    name="password_require_lowercase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Minúsculas</FormLabel>
                          <FormDescription>
                            Requerir al menos una minúscula
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
                    name="password_require_numbers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Números</FormLabel>
                          <FormDescription>
                            Requerir al menos un número
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
                    name="password_require_special"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Caracteres Especiales</FormLabel>
                          <FormDescription>
                            Requerir al menos un símbolo
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

              {/* Session Management */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-medium">Gestión de Sesiones</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="session_timeout_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeout de Sesión (minutos)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={5}
                            max={10080}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Tiempo de inactividad antes de cerrar sesión
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_login_attempts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intentos Máximos de Login</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Antes de bloquear la cuenta
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lockout_duration_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duración del Bloqueo (minutos)</FormLabel>
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
                          Tiempo de bloqueo tras intentos fallidos
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Authentication Options */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-medium">Opciones de Autenticación</h3>
                
                <FormField
                  control={form.control}
                  name="require_email_verification"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Verificación de Email</FormLabel>
                        <FormDescription>
                          Requerir verificación de email para nuevas cuentas
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
                  name="two_factor_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Autenticación de Dos Factores (2FA)</FormLabel>
                        <FormDescription>
                          Habilitar 2FA para administradores
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

              {/* IP Whitelist */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-medium">Restricciones de IP</h3>
                
                <FormField
                  control={form.control}
                  name="ip_whitelist_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Whitelist de IPs Habilitada</FormLabel>
                        <FormDescription>
                          Restringir acceso solo a IPs permitidas
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
                  name="allowed_ips"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IPs Permitidas</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="192.168.1.1, 10.0.0.5"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Lista de IPs separadas por comas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Rate Limiting */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-medium">Limitación de Tasa</h3>
                
                <FormField
                  control={form.control}
                  name="rate_limit_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Rate Limiting Habilitado</FormLabel>
                        <FormDescription>
                          Limitar peticiones por minuto por usuario
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
                  name="rate_limit_requests_per_minute"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peticiones Por Minuto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Máximo número de peticiones permitidas por minuto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-6">
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
