# Recuperación de contraseña

Configuración pendiente en el proyecto de Supabase utilizado por producción:

- Authentication → URL Configuration → Site URL: `https://www.lify-vending.com`
- Redirect URLs: `https://www.lify-vending.com/restablecer-contrasena`
- Si se permite acceder sin `www`, añadir también `https://lify-vending.com/restablecer-contrasena`.

Guardar los cambios y solicitar un correo nuevo. Los correos anteriores pueden conservar su destino antiguo. Cambiar `.env.local` no actualiza la configuración de Supabase; `NEXT_PUBLIC_SITE_URL` no controla los correos enviados desde su panel.

Desplegar primero estas rutas del proyecto:

- `/recuperar-contrasena`: solicita el correo y fija explícitamente el destino en el dominio actual.
- `/restablecer-contrasena`: consume la sesión de recuperación, valida la confirmación y guarda la contraseña mediante Supabase Auth. Muestra errores para enlaces inválidos o caducados.

La portada redirige los enlaces con `type=recovery` a la página de nueva contraseña, conservando los tokens. Así se admiten también los correos predeterminados enviados desde el panel de Supabase, cuyo destino es Site URL. Se utiliza el flujo implícito del cliente Supabase existente; la plantilla de correo debe conservar el enlace estándar `{{ .ConfirmationURL }}`.

Verificación local con respuestas de autenticación simuladas (no envía correos ni modifica usuarios):

```sh
npm run dev -- --port 3100
node scripts/check-password-recovery.cjs
```

Tras publicar y configurar Supabase, verificar el flujo con un correo nuevo de una cuenta de prueba. Esta comprobación real no está cubierta por las pruebas simuladas.
