# Imágenes para un despiece fotorealista con scroll

La foto `public/servicio-tecnico.png` está integrada en la apertura de Servicio técnico. El despiece interactivo utiliza las seis capas de prueba de `public/lify_despiece_capas`, con movimiento por scroll, selección de componentes y controles de montaje. Los PNG originales se conservan. La web aplica una calibración de posición y escala a cada pieza para que encaje dentro de la carcasa, separada de la transformación que la desplaza durante el despiece.

La composición original tiene un cristal opaco y la refrigeración sobresale por debajo de la carcasa. Estos problemas se corrigen en la web mediante una máscara vectorial del cristal y la calibración del montaje. La puerta se ajusta al hueco frontal; las bandejas, la electrónica y el pago también tienen sus propios ajustes. La imagen `00-montada.png` suministrada no se usa como referencia de un cierre correcto.

Scroll y controles comparten un único avance de animación interpolado por fotograma. Las piezas aceleran y frenan con una curva continua; al invertir el movimiento o volver al scroll se conserva la posición actual. Las comprobaciones incluyen los límites pintados de las capas (sin contar su lienzo transparente), el cierre y muestras de fotogramas intermedios.

El propio `LEEME.txt` indica que las piezas proceden de imágenes generadas por separado. La calibración mejora la composición 2D, pero no convierte los archivos en un ensamblaje 3D exacto.

Los requisitos siguientes sirven para preparar una versión refinada y sustituir las capas del prototipo.

## Qué pedir a la IA

Usa la misma imagen de referencia en todas las peticiones. Pide **ediciones de una única escena**, con cámara, perspectiva, escala, iluminación y posición bloqueadas. Generar cada pieza de cero suele producir máquinas diferentes que no encajan al montarlas.

| Archivo              | Contenido                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-montada.png`     | Referencia de la máquina completa y cerrada.                                                                                                         |
| `01-carcasa.png`     | Chasis exterior e interior vacío. Sin puerta, bandejas, panel electrónico ni equipo frigorífico.                                                     |
| `02-puerta.png`      | Solo puerta frontal, con marco y cristal. En su posición cerrada, con el mismo ángulo de cámara que la referencia. Sin productos detrás del cristal. |
| `03-bandejas.png`    | Conjunto de bandejas, espirales y motores de dispensación, sin carcasa ni puerta.                                                                    |
| `04-pago.png`        | Solo módulo de pantalla, lector de pago y botonera, sin duplicarlos en otras capas.                                                                  |
| `05-frio.png`        | Solo conjunto de refrigeración inferior: compresor, ventilador y rejilla.                                                                            |
| `06-electronica.png` | Solo placa de control con su soporte y conexiones inmediatas.                                                                                        |
| `07-sombra.png`      | Solo sombra de contacto sobre un suelo transparente. Opcional; también podemos recrearla con CSS.                                                    |

Todas las capas deben tener **el mismo lienzo de 2048 × 1536 px**, PNG con transparencia real y sin recortar al tamaño de la pieza. Cada componente debe permanecer en la posición que ocuparía dentro de la máquina montada. Al superponer las capas sin desplazamiento, deben reconstruir la referencia. Deja margen alrededor del conjunto para poder separar piezas durante el scroll.

## Prompt base para copiar

> Usa la imagen de referencia de esta máquina Lify para crear un conjunto coherente de capas de producto para una animación web de despiece. Mantén exactamente el diseño, el ángulo de cámara en tres cuartos, la perspectiva, la escala, la posición, los materiales negros y la iluminación turquesa de marca. Lienzo fijo de 2048 × 1536 px. Máquina completa centrada, con margen libre alrededor. Fondo realmente transparente, canal alfa, sin suelo, sin sombra integrada, sin textos añadidos, sin flechas, sin rótulos, sin iconos flotantes y sin líneas técnicas. No dibujes un patrón de cuadros para simular transparencia. No cambies la cámara entre imágenes. No recortes ni centres cada componente por separado: conserva sus coordenadas dentro del lienzo común. Las piezas no deben duplicarse entre capas. Entrega cada capa en un PNG independiente. Primero genera la referencia montada y úsala como fuente bloqueada para todas las extracciones.

Después añade la petición concreta, por ejemplo:

> Entrega únicamente el conjunto de refrigeración inferior de esa misma máquina, completo y aislado. Incluye sus superficies laterales y posteriores, para que se pueda desplazar fuera del chasis sin mostrar cortes. Conserva exactamente su posición, tamaño y perspectiva dentro del lienzo de referencia. El resto del lienzo debe ser transparente.

Para la puerta, pide la puerta en **posición cerrada**. La foto actual tiene la puerta abierta y no permite reconstruir sin más la máquina cerrada. Si quieres una apertura progresiva fiel con giro real de bisagra, lo adecuado es un modelo 3D; las capas 2D permiten un despiece con desplazamientos, profundidad, escala, sombras y puntos interactivos.

## Cómo se integrarán

Al entrar se verá la máquina montada. Con el scroll, la puerta se adelantará, las bandejas se desplazarán, el módulo de pago saldrá hacia un lado y la refrigeración bajará. Los puntos y textos seguirán explicando cada área. Los controles táctiles permitirán explorar y montar la máquina; con movimiento reducido se ofrecerá una vista estable y seleccionable.

Estas imágenes son visualizaciones. Para mostrar componentes de un modelo real con precisión, conviene partir de fotos técnicas o de un modelo 3D del fabricante.
