# Portada móvil y acceso privado

## Portada móvil

La composición de escritorio se conserva. Por debajo de 768 px, el titular se centra y pasa a dos líneas: «Tu pausa.» y «Nuestra energía.». La máquina queda en el mismo eje, entre el titular y el texto de apoyo; el botón y la indicación de scroll quedan debajo.

Se reutiliza el mismo maestro transparente y la secuencia de iluminación de 2,2 segundos. Un aumento moderado de la cámara aprovecha los márgenes transparentes sin cortar la parte visible de la máquina. El fondo inicial sigue siendo negro puro y se mantienen las alternativas de movimiento reducido, navegación inmediata y ausencia de JavaScript.

Archivos: `components/hero-section.tsx` y `app/vending-startup.css`.

## Login

`app/login/page.tsx`, `app/login/login.css` y `components/login-scene.tsx` forman la nueva pantalla de acceso. El fondo, las tipografías, los campos y los botones siguen la paleta oscura y turquesa de la web informativa. La escena reutiliza la imagen de la máquina, con un marco de neón SVG que se dibuja al entrar. El formulario está disponible durante la animación.

Al validar credenciales y perfil, se ilumina el acceso y se abre una transición visual de 420 ms antes de navegar. Con movimiento reducido la navegación no espera esa transición. Las animaciones decorativas de entrada terminan; la exploración luminosa solo continúa mientras hay una petición de acceso en curso, se contiene en la escena y se pausa si esta queda fuera de vista.

Se añade mostrar/ocultar contraseña, autocompletado de credenciales y un mensaje accesible de estado fuera de la región ocupada del formulario. Los campos siguen desactivándose mientras se valida el acceso; tras aprobarlo permanecen desactivados hasta la navegación para impedir envíos duplicados.

Se mantienen la llamada de autenticación de Supabase, la consulta de perfil, la salida de sesión ante un perfil inválido, los mensajes de error y los destinos originales:

- `admin`: `/admin/dashboard`
- `client`: `/client/dashboard`
- `operador`: `/admin/inicio`
- `reponedor`: `/admin/gestion-rutas`

La proyección de la consulta de perfil declara explícitamente su campo `role` como cadena para corregir la inferencia de TypeScript; no cambia la petición ni la comprobación de los roles admitidos. No se modifica el interior de los paneles, el backend, el proveedor de autenticación, los estilos globales ni las dependencias.

## Validación

- `scripts/check-hero-motion.cjs`: once tamaños, alineación del titular, máquina y botón, orden visual móvil, parallax, alternativas de accesibilidad y ausencia de desbordamiento.
- `scripts/check-vending-startup.cjs`: Chromium y WebKit, negro inicial, capas alineadas, descarga única y estados alternativos.
- `scripts/check-login-experience.cjs`: diez tamaños en Chromium y WebKit, campos táctiles, contraseña visible/oculta, animaciones finitas y autocompletado. Las respuestas de autenticación se simulan: se comprueban los cuatro roles, errores de credenciales, perfil ausente, rol no admitido, estados de carga y recuperación. Las peticiones a los destinos se interceptan antes de cargar los paneles; no se utilizan cuentas reales ni se accede a sus datos.

La comprobación global de TypeScript mantiene errores anteriores de otros módulos; los seis errores anteriores de inferencia de perfil del login quedan resueltos y no aparecen errores nuevos en los archivos de esta intervención.
