# Lify Vending — recursos para encendido de portada

## Archivos
- `01-apagada.webp`: misma fotografía del gimnasio, oscurecida y con interior atenuado.
- `02-encendida.webp`: fotografía original, sin cambios de cámara ni posición.
- `03-resplandor.png`: capa RGBA de brillo turquesa orientativa, para animar opacidad (puede omitirse).
- `referencia-original.png`: original para reexportaciones.

## Uso en Codex
Superponer `01-apagada.webp` y `02-encendida.webp` en un contenedor con idéntico tamaño y `object-fit: cover` y **el mismo `object-position`**. Iniciar con encendida a opacity 0, animar a 1 en 0.8-1.2 s. Opcionalmente superponer `03-resplandor.png` con opacidad transitoria; si se usa, aplicar el mismo recorte/escala. Sincronizar el titular y CTA con el encendido. Mantener una imagen visible sin JavaScript y respetar `prefers-reduced-motion`.

## Importante
Son capas fotográficas para un fundido de encendido, NO elementos físicos recortados ni una simulación 3D. El efecto de iluminación interior es una aproximación visual. La fotografía de referencia conserva su logo únicamente en la propia máquina.
