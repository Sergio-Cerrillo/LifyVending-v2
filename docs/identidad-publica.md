# Identidad visual de la web pública

La interfaz pública usa una paleta común definida en `app/public-site.css` y limitada a `.public-site`.

| Función | Variable | Color |
| --- | --- | --- |
| Fondo principal | `--surface` | `#080f11` |
| Paneles y secciones alternas | `--surface-raised` | `#101d20` |
| Bloques destacados y contacto | `--surface-accent` | `#0b2624` |
| Texto principal | `--paper` | `#eef6f3` |
| Texto secundario | `--muted` | `#b3c6bf` |
| Turquesa corporativo | `--brand` | `#13dfbc` |
| Texto sobre botones turquesa | `--ink` | `#041613` |
| Separadores | `--line` | Blanco verdoso al 20 % |

`--green` y `--mint` se conservan como alias de los acentos y superficies nuevos para mantener la compatibilidad con los componentes existentes.

## Alcance

- Inicio: textos, franja móvil, máquina interactiva, botones, selectores, inversión cero, proceso y contacto. Las fotos de café, agua y snacks ocupan el fondo del texto del producto, con opacidad y máscaras de fundido en todos los bordes; se cargan a la resolución del panel y mantienen legibles los controles.
- Nosotros: cabecera, historia, valores, preguntas y llamada a la acción.
- Catálogo: portada, acceso directo, máquina, interior y listado de categorías.
- Servicio Técnico: fondo de sección, textos, navegación de piezas y botones del despiece. La portada termina en un degradado hacia el color de la siguiente sección. La máquina desmontable se integra sin fondo de recuadro, borde, esquinas redondeadas ni recorte; conserva las coordenadas de sus capas, sus controles y su movimiento.
- Navegación y footer compartidos: cabecera oscura al hacer scroll, menú móvil oscuro, bordes, enlaces y crédito de SCWebStudio con su recurso blanco existente. El crédito sigue centrado.

Se mantienen los colores naturales de alimentos, fotografías y productos. La identidad se aplica a la interfaz y a los materiales de las máquinas ilustradas; no se tiñen las fotografías ni el mapa de Google.

No cambian la distribución de las secciones, sus textos, destinos, animaciones de scroll ni la administración o el área de clientes. No se añaden dependencias.

## Entrada desde negro

La portada de inicio tiene un fondo negro puro (`#000`) y comienza con opacidad cero en máquina, cabecera, titular, información secundaria y botones. El primer contorno aparece aproximadamente a los 300 ms. La iluminación completa dura 2,2 segundos y luego no quedan animaciones de entrada activas.

La entrada es una animación de los propios elementos; no hay una pantalla superpuesta que capture eventos ni bloqueo del desplazamiento. El teclado, el puntero o el scroll completan la secuencia de inmediato. Con movimiento reducido o sin JavaScript se muestra directamente la interfaz completa. Una alternativa CSS y un límite de espera de cuatro segundos evitan mantener el negro si fallan los recursos de inicialización.
