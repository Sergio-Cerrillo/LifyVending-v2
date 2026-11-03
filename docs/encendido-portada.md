# Encendido de portada y portada móvil de Servicio Técnico

La intervención afecta a la web informativa. No cambia administración, clientes, acceso privado, APIs ni dependencias. La paleta pública compartida se define en `app/public-site.css`: negro y grafito para los fondos, blanco suave para el texto y turquesa para los acentos.

## Portada principal: versión con máquina aislada

- `components/vending-startup.tsx`: secuencia única de 2,2 segundos. Espera a la decodificación de la imagen y activa en el mismo fotograma el encendido de máquina y titular. No se reinicia con cambios de tamaño o renderizados normales. Se pausa si la pestaña se oculta. Si el visitante hace scroll, toca la pantalla o empieza a navegar con el teclado, la secuencia se completa inmediatamente y toda la interfaz queda visible. Los enlaces a secciones internas también omiten la entrada.
- `app/vending-startup.css`: fondo casi negro, cámara con proporción 1122 × 1402, capas alineadas y colores del titular sincronizados con el contorno turquesa y la iluminación interior. La imagen y el contorno proceden del mismo recurso. Se ha retirado la capa atenuada: los primeros 300 ms son negro puro, incluida la cabecera, la máquina, el titular y las llamadas a la acción. Después se revelan de forma coordinada durante la secuencia de 2,2 segundos.
- `components/hero-visual.tsx`: composición reducida a una única máquina, sin círculo, órbitas, café, productos flotantes, notas o sellos. El componente ya no necesita control de puntero, estado de pausa ni animaciones infinitas. Conserva el desplazamiento por scroll.
- `components/hero-section.tsx` y `app/page.tsx`: estado inicial del encendido y clase de página que limita la cabecera oscura al inicio de la portada. El menú móvil comparte el fondo oscuro y el texto claro. Su botón se activa al quedar preparado el componente, para no perder pulsaciones durante la inicialización. Los textos y destinos de los botones no cambian.

Se ha creado una única imagen maestra con transparencia real mediante la herramienta integrada de generación de imágenes. La fotografía anterior solo se utilizó como referencia. Los recursos antiguos de `public/lify_encendido_web` se conservan, pero esta portada ya no los descarga.

Recursos nuevos:

- `public/images/startup/machine-isolated-v2.png`: maestro de 1122 × 1402 píxeles con canal alfa; no se descarga en la portada.
- `public/images/startup/machine-isolated-v2-560.webp`: versión de aproximadamente 54 KiB.
- `public/images/startup/machine-isolated-v2-1122.webp`: versión de aproximadamente 156 KiB.

El navegador elige una resolución con `srcset`; ambas capas reutilizan exactamente la misma URL y una sola descarga. La imagen crítica se carga con prioridad, sin lazy loading. No se añaden vídeos, bibliotecas, Canvas ni un bucle de JavaScript por fotograma. El fondo pertenece al CSS, de modo que no aparece un marco rectangular de fotografía.

Con movimiento reducido se muestran directamente máquina, cabecera y texto iluminados. Sin JavaScript también queda visible el estado final. Si JavaScript está habilitado pero su carga falla, una alternativa CSS muestra el contenido a los cuatro segundos; un temporizador equivalente evita mantener el negro mientras se espera una imagen que no llega. Los botones están disponibles durante toda la secuencia. La cámara reserva sus dimensiones desde el principio y deja de animarse al terminar.

El prompt y el origen del recurso están documentados en `docs/brief-maquina-aislada.md`. La nueva paleta y su alcance se recogen en `docs/identidad-publica.md`.

## Servicio Técnico en móvil

- `app/brand-scenes.css`: composición vertical con titular y botón antes de la fotografía; altura mínima equivalente a la pantalla disponible, sin una altura fija que recorte contenido. Tipografía, márgenes y enlace inferior adaptados al ancho. Se elimina la ampliación de scroll sobre esta fotografía en móvil para conservar el encuadre completo.
- `app/servicio-tecnico/page.tsx`: selección de una imagen específica para móvil.
- `public/images/spaces/servicio-tecnico-mobile.webp`: encuadre optimizado que conserva la máquina abierta y todos sus iconos, retirando espacio vacío del lateral izquierdo. La fotografía original no se modifica.

El despiece y sus controles no cambian.

## Catálogo

Se completa la entrada mediante scroll al cristal de la máquina, con categorías dentro y acceso directo permanente a los productos. La cámara y la apertura comparten coordenadas para evitar desajustes. Los enlaces abren la categoría correspondiente y calculan su destino sin incluir las transformaciones de las animaciones de entrada. Las pantallas de poca altura y la preferencia de movimiento reducido conservan una portada estática y navegación directa.

Archivos: `components/catalogo-hero.tsx`, `components/use-catalog-portal.ts`, `app/catalog-portal.css`, `app/catalogo/page.tsx`, las imágenes optimizadas de `public/images/catalog` y sus referencias en `components/productos-grid.tsx`.

## Verificación

- `scripts/check-vending-startup.cjs`: cinco tamaños en Chromium y WebKit, negro inicial verificado píxel a píxel, transparencia, registro de capas, final sin animaciones activas, descarga única, omisión por teclado/scroll/puntero, movimiento reducido y alternativas sin JavaScript o con su carga bloqueada.
- `scripts/check-hero-motion.cjs`: once tamaños, iluminación coordinada del titular, ausencia de decoración retirada, encuadre, parallax por scroll, menú móvil, cambios de tamaño y movimiento reducido.
- `scripts/check-public-experiences.cjs`: productos, espacios, despiece y enlaces de asistencia en nueve tamaños.
- `scripts/check-catalog-portal.cjs`: portal, categorías, teclado, acceso directo, pantallas compactas y cambios de movimiento reducido en once tamaños.
- `scripts/check-public-theme.cjs`: las cuatro páginas públicas, cuatro tamaños en Chromium y WebKit, contrastes de textos y controles, menú oscuro, footer y ausencia de desbordamiento.
- Revisión visual móvil en Chromium y WebKit; compilación de producción correcta. En las comprobaciones locales de producción con Chromium, el CLS observado durante el encendido fue 0. Esto no sustituye una medición de Core Web Vitals con usuarios reales.
- La comprobación completa de TypeScript mantiene los mismos errores previos en código privado/API y utilidades; no aparecen errores nuevos respecto al registro anterior.
