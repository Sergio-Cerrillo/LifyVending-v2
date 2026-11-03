# Máquina aislada para la portada oscura

Generada con la herramienta integrada `image_gen`, en modo edición y con `transparent_background: true`. No se ha utilizado el CLI ni una clave API.

Referencia: `public/lify_encendido_web/02-encendida.webp`.

Maestro guardado en `public/images/startup/machine-isolated-v2.png`, 1122 × 1402 píxeles RGBA. Los WebP de 560 y 1122 píxeles de ancho conservan el canal alfa y están en la misma carpeta. La geometría y la posición son idénticas entre las capas del encendido porque todas reutilizan este mismo maestro; no se generan máquinas apagadas y encendidas independientes.

## Prompt final utilizado

```text
Use case: background-extraction. Asset type: premium vending-machine website hero, transparent PNG cutout. Edit target: the supplied Lify vending machine photograph. Extract ONLY the entire closed vending machine visible in the right half of the reference, preserving its exact three-quarter front/right view, straight proportions, black metal body, turquoise side graphics, existing Lify logo, product shelves, payment terminal, delivery hatch and illuminated turquoise LED contours. Remove the gym, walls, ceiling, all exercise equipment, dumbbell icon, bottle, bench, floor and floor reflections completely. This must be a single isolated freestanding vending machine on GENUINE TRANSPARENT ALPHA, not a black background and not a checkerboard printed into the picture. Full machine from top edge to bottom feet, no cropping, centered on a portrait canvas, about 8 percent transparent margin all around. Photorealistic product photography. Fully lit clean final state: tasteful turquoise perimeter LEDs and soft white internal shelf illumination, realistic black materials still visible. Do not add props, particles, smoke, a circular platform, a halo, a ring, exterior text or any additional logo. Preserve the reference machine identity and geometry as faithfully as possible. Produce one single machine, not a comparison sheet. This will be composited on a near-black website; edges should be clean and natural with subtle turquoise light on the machine itself, no huge external glow.
```

No se dibuja el titular dentro de la imagen: el texto sigue siendo HTML accesible y se ilumina con la misma duración que la máquina. Las demás secciones y el área privada mantienen su composición.
