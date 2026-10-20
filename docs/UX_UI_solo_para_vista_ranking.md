# Guía UX/UI de la vista Ranking (pantalla proyectada)

Última actualización: 2026-10-19

**Alcance:** solo la vista `RANKING` (`appscript/ranking-view.html`, `ranking-style.html`, `ranking-script.html`). El resto de la app sigue [reglas/ux-ui.md](reglas/ux-ui.md) (estilo Google, claro). Esta guía manda únicamente mientras `body.pantalla-grande` está activo, es decir, mientras la vista de ranking está abierta.

**Referencia visual:** campaña "Feria de Agentes de IA" (escenario oscuro, luz azul, acentos cian y podio metálico).

---

## 0. Qué se corrigió de la versión anterior de este documento

La versión anterior era un sistema de diseño genérico para landings, páginas de error y pantallas de cierre. Al aplicarlo a una pantalla de ranking proyectada tenía estos problemas:

| # | Problema | Corrección |
|---|---|---|
| 1 | Describía patrones que la vista no tiene: Patrón A 45/55, Patrón B de error 404/500, barra "Explora · Conecta · Aplica · Transforma", tarjetas flotantes, robot 3D y su micro-narrativa. | Se movieron a "Fuera de alcance" (§10). La vista no tiene recursos 3D ni del robot. |
| 2 | Dos nombres para los mismos tokens: la tabla usaba `--color-bg-deep`, el CSS `--bg-core-navy`. | Una sola tabla, con los nombres de variable que usa el código (§3). |
| 3 | Las medidas del texto y las del CSS de ejemplo no coincidían (barra del kicker 48 × 4 px a 8 px vs. 52 px a 10 px; borde de las píldoras 3 px vs. 2,5 / 2 px; círculo de paso 56 vs. 54 px; etiqueta 14 vs. 12 px). | Una sola medida por elemento, la que usa la vista (§4 y §6). |
| 4 | Usaba degradados como "color" (`--color-rank-gold: linear-gradient(...)`). Un degradado no sirve en `color` ni en `border-color`. | Cada metal tiene un color sólido (borde, texto) y un degradado (solo para fondos o texto con `background-clip: text`). |
| 5 | H1 de 56–72 px y subtítulo de 24–28 px: en una pantalla de ranking eso le quita filas a la cuadrícula, que es lo que la gente busca (su nombre). | La cabecera es compacta (§4); la jerarquía la llevan el podio y los puntos. |
| 6 | `backdrop-filter: blur()` recomendado para todo el vidrio. Con 50–300 filas en pantalla, en el portátil que proyecta, cuesta mucho y no se nota (el fondo de la fila es casi opaco). | Desenfoque solo en elementos sueltos (botones de cabecera y panel de ajustes), nunca en las filas (§9). |
| 7 | Animaciones infinitas (levitación, pulso) sin mención a `prefers-reduced-motion`. | Toda animación se apaga con movimiento reducido (§7). |
| 8 | Breakpoint de 1024 px. | La app usa 900 px (§5.6). |
| 9 | "WCAG AAA en titulares" sin medir. | Se midieron los pares reales (§8). Todos pasan AA; los textos principales pasan AAA. |
| 10 | Configuración de Tailwind. El proyecto es Apps Script con CSS propio, sin Tailwind. | Eliminada. |
| 11 | No decía nada de cómo se lee un ranking de 500 personas a distancia: nombres truncados, empates, qué tramo se está viendo. | Reglas de lectura a distancia, desempate y pie (§2, §6.3–6.5). |

---

## 1. Contexto de uso

- **Dónde se ve:** proyector o TV en el salón de la feria, a 3–10 m. Lo opera el admin; el público solo mira.
- **Qué busca el público:** primero, quién va ganando (podio). Después, **su propio nombre** y su puesto (cuadrícula).
- **Cómo cambia:** se refresca solo cada `segundos_refresco_board` (mínimo 10 s). Quien sube de puntaje destella y muestra "+N".
- **Sin interacción del público:** nada en la pantalla debe parecer tocable salvo los dos botones del admin (ajustes y actualizar).

## 2. Dirección de arte

Modo oscuro "de escenario": la luz marca la jerarquía.

1. **Escenario:** fondo azul noche con un halo de luz azul arriba, detrás del podio. Nunca plano.
2. **El podio es el protagonista:** metales (oro, plata, bronce) y brillos solo en los tres primeros. La cuadrícula es sobria: blanco y azul hielo, sin cian neón ni resplandores.
3. **Alto contraste:** texto blanco o hielo sobre azul noche; cian solo para acentos y cifras.
4. **Legible a distancia antes que decorativo:** un nombre recortado o un número pequeño es un error de diseño, aunque el efecto se vea bien.
5. **Un solo acento:** el cian. No se mezclan los colores de Google (franja superior, estrellas amarillas) con el tema.

## 3. Tokens de color

Se definen en `body.pantalla-grande` (`ranking-style.html`) sobre las mismas variables que usa la app, así los componentes comunes toman el tema sin reglas extra.

### 3.1 Fondo y texto

| Variable | Valor | Uso |
|---|---|---|
| `--fondo` | `#040B26` | Azul noche: fondo base |
| — | `#072146` | Azul marino: segunda parada del degradado y fondo de filas |
| — | `#004481` | Azul rey: pedestales del podio |
| — | `#0055FF` | Luz de escenario: halo y botón principal del panel |
| `--superficie` | `rgba(7, 33, 70, .6)` | Superficies secundarias (chips, estados) |
| `--texto` | `#FFFFFF` | Nombres, títulos |
| `--texto-2` | `#B8D8F8` | Hielo: hora, pie, "pts", etiquetas |
| `--borde` | `rgba(0, 229, 255, .3)` | Bordes de vidrio |
| `--borde-suave` | `rgba(184, 216, 248, .16)` | Bordes secundarios |

### 3.2 Acentos

| Variable | Valor | Uso |
|---|---|---|
| `--azul` | `#00E5FF` | Cian: título, puestos, puntos, barra del kicker |
| `--azul-suave` | `rgba(0, 229, 255, .12)` | Fondos de selección |
| `--verde` | `#2DCCCD` | Aqua: "+N" y destello de quien subió |
| `--verde-suave` | `rgba(45, 204, 205, .18)` | Fondo del destello |
| `--rojo` | `#FF8A80` | Errores (legible sobre oscuro) |

### 3.3 Metales del podio

Cada metal tiene un **sólido** (bordes, texto, coronas) y un **degradado** (solo fondos o texto recortado).

| Puesto | Sólido (borde) | Texto | Degradado | Brillo |
|---|---|---|---|---|
| 1 Oro | `#FFD700` | `#FFD700` | `135deg, #FFF3B0, #FFD700, #B8860B` | `rgba(255, 215, 0, .5)` |
| 2 Plata | `#C0C0C0` | `#E6EAEE` | `135deg, #FFFFFF, #C0C0C0, #7F8C8D` | `rgba(192, 192, 192, .4)` |
| 3 Bronce | `#CD7F32` | `#F0B07A` | `135deg, #F5CBA7, #CD7F32, #873600` | `rgba(205, 127, 50, .5)` |

En el código son `--m-borde`, `--m-texto`, `--m-fondo` y `--m-glow` sobre las clases `oro`, `plata` y `bronce`.

## 4. Tipografía

- **Display:** Montserrat 700 / 800 / 900 (título, nombres del podio, números de pedestal, puntos).
- **Texto:** Inter 400 / 500 / 600 (nombres de la cuadrícula, pie, hora).
- **Cifras que cambian** (puntos, puestos, hora, segundos): `font-variant-numeric: tabular-nums`.
- **Tamaño mínimo a distancia:** nada que el público deba leer baja de 14 px en 1080p; los nombres de la cuadrícula parten en 16 px y los puntos en 22 px (ajustables).

| Elemento | Tamaño | Peso | Notas |
|---|---|---|---|
| Nombre en el podio | `--rp-nombre-top` (16 px; 1.º: × 1,25). Ajuste propio, no se achica con el podio | 700 | Mayúsculas, dentro de la píldora |
| Puntos en el podio | 18 px × escala, mínimo 16 px (1.º: 22 px, mínimo 18 px) | 800 | Blanco, "520 pts" en una línea |
| Número del pedestal | 88 / 62 / 50 px × escala (1.º / 2.º / 3.º) | 900 | Degradado vertical del metal, canto oscuro y ramas de laurel a los lados (§6.2) |
| Nombre en la cuadrícula | `--rp-fuente` (16 px) | 500 | Blanco suave `#F2F6FB` |
| Puntos en la cuadrícula | `--rp-puntos` (22 px) | 700 | Blanco, sin brillo; "pts" en la misma línea, como en el podio |
| Pie | 14 px | 400 | Hielo |

## 5. Layout de la vista

De arriba abajo, centrado con un ancho máximo de 1.680 px.

### 5.0 Reglas de orden (presupuesto de pantalla)

Estas reglas salen de revisar la vista con una pantalla real de 1534 × 710 px (1920 × 888 con zoom del 125 %), donde el podio ocupaba el 60 % del alto, la cuadrícula quedaba en media fila y sobraban 90 px vacíos sobre el menú.

1. **La vista mide exactamente el alto de la pantalla.** Ni sobra espacio bajo el pie ni la página se desplaza. Con el menú oculto, gana ese alto.
2. **La cuadrícula manda; el podio cede.** El podio nunca deja menos de **3 filas completas** a la cuadrícula. Si no caben, el podio se achica entero en proporción (hasta el 50 % del "Tamaño del top"), nunca se cortan filas.
3. **El texto no se achica por debajo del mínimo legible**, aunque el podio se achique: nombres del podio 14 px, puntos 16 px.
4. **El podio es proporcionado:** cada pedestal mide como mucho 300 px × "Tamaño del top" de ancho. En pantallas anchas no se estira en losas planas.
5. **Ninguna celda baja de 280 px de ancho.** Si las columnas del ajuste no caben con ese mínimo, se pinta una menos (en 1920 px: 5 columnas, sin nombres recortados; en 1534 px: 5).
6. **Ritmo vertical:** 12 px de margen arriba, podio 24 arriba y 24 abajo, pie 12.
7. **Sin barra horizontal:** el halo del podio se recorta en los bordes de la vista.
8. **Sin cabecera.** Ni marca ("Explore Fair · Admin") ni título visible: en la pantalla gigante todo el alto es para el ranking. El título "Ranking" queda solo para lectores de pantalla.

### 5.1 Controles flotantes
En la esquina superior derecha, sin ocupar alto: la hora de la última actualización (12 px, `aria-live`), el botón de ajustes y el de actualizar (44 × 44 px, vidrio con borde cian). Van casi transparentes (18 %) para no distraer en la proyección y se encienden al pasar el mouse o al llegar con el teclado.

### 5.2 Podio
- De izquierda a derecha: 2.º, 1.º (más alto), 3.º. Con menos de tres personas, solo los que haya.
- Halo radial azul detrás. Sin base elíptica debajo: los pedestales se apoyan directo sobre el escenario.
- Cada puesto: avatar con iniciales y corona del metal → píldora con el nombre → puntos → chip de tiempo → pedestal. El ritmo es el mismo en los tres: píldora · 8 px · puntos · 6 px · tiempo · 14 px · pedestal (× escala).
- Ancho y escala propios (`--rp-ancho-top`, `--rp-escala`): no dependen de la cuadrícula. El script baja `--rp-escala` cuando falta alto (regla 2); `--rp-escala-base` guarda el valor del ajuste para el ancho.

### 5.3 Cuadrícula (4.º en adelante)
- Hasta `--rp-cols` columnas (menos si una celda bajaría de `--rp-celda-min`, 280 px), filas de `--rp-alto`, separación `--rp-espacio`. Se llena con lo que cabe en pantalla (o con "Personas por pantalla").
- Cada fila: círculo con el puesto → nombre y, debajo, el chip de tiempo → puntos a la derecha. Como todas las filas llevan las dos líneas, todas quedan alineadas a la misma altura.
- **El nombre nunca comparte línea con el chip:** con 6 columnas, un chip en la misma línea deja nombres como "G…" o "R…", que no sirven a nadie.

### 5.4 Pie
- Dice qué tramo se ve, en palabras que no se malinterpreten: **"Puestos 1 a 21 de 40"** (no "Mostrando puestos 21 de 40").
- Explica la regla de desempate una sola vez.

### 5.5 Estados
- **Cargando / error:** los comunes de la app, con el tema oscuro.
- **Sin puntajes:** ícono de trofeo en un círculo de vidrio cian, "Esperando los primeros puntajes". Nunca un círculo gris claro sobre el escenario.

### 5.6 Pantalla angosta (< 900 px)
La cuadrícula pasa a una columna y el podio ocupa todo el ancho, con avatares más chicos. Las reglas de alto (5.0) se aplican igual. Es un caso de respaldo: la vista está pensada para proyectar.

## 6. Componentes

### 6.1 Píldora de nombre (podio)
`border-radius: 9999px`, fondo `linear-gradient(180deg, #071936, #03091A)`, borde sólido de 2,5 px del metal, texto blanco en mayúsculas, brillo exterior del metal y sombra interior. A cada lado del nombre, una **ramita de laurel** del metal (la misma `RAMA` del pedestal, a 1,5 em de alto), como en el diseño de referencia. El nombre se recorta con puntos suspensivos si no cabe, nunca salta de línea; las ramitas no se recortan. Por debajo de 900 px las ramitas se ocultan para dejarle el ancho al nombre, y los números del pedestal bajan a 56 / 44 / 38 px.

### 6.2 Pedestal
**Bloque sólido, no vidrio** (diseño de referencia): un prisma azul rey opaco (`#1A55D6 → #0F3FB0 → #0A2E85`) con:

- **Borde superior en arco, de lado a lado:** el centro es el punto más alto y la curva cae de forma continua hasta los dos extremos (14 px × escala más abajo), sin tramos rectos. Caída = `curva × (2x − 1)²`, muestreada cada 5 % en el `clip-path`.
- **Caras laterales** (el 11 % de cada lado): oscuras en el borde exterior y más claras junto a la cara frontal, como una cara que se aleja; una arista fina de luz las separa del frente.
- **Centro en sombra:** la cara frontal se oscurece hacia el centro, detrás del número, y recibe un reflejo azul claro de la tapa justo debajo de ella. El número de metal resalta sobre esa sombra.
- **Tapa toda de metal** de 16 px × escala que sigue el mismo arco por arriba y por abajo, así su grosor es parejo de punta a punta. Es de **metal pulido como un aro**: reflejos horizontales simétricos (`--m-aro`) con los extremos oscuros, filos claros, dos bandas oscuras y un reflejo claro al centro. Van en horizontal a propósito: un degradado vertical no sigue la curva de la tapa y dejaba el centro casi blanco y los lados oscuros, sin leerse como metal.
- **Sombra proyectada** como `filter: drop-shadow` en el puesto entero (el recorte del arco cortaría un `box-shadow`); el 1.º lleva además sombra sobre sus vecinos.
- **Zócalo** de 10 px × escala en la base, de la misma familia de azules que el cuerpo (`#1747B8 → #0B2C7A`) con un filo de luz azul clara arriba (`#8DBBFF`) y un brillo azul suave. No cian: el cian puro (`#00E5FF`) chocaba con el azul rey de los pedestales.
- Los tres pedestales van **pegados**, como un solo podio; el 1.º queda delante.
- **Opacos de verdad:** el halo va detrás de los pedestales (`isolation: isolate` en el podio y `z-index: -1`). Antes se pintaban encima y los pedestales parecían de vidrio.

**Placa del número** (igual en los tres puestos, como en el diseño de referencia): el número grande al centro, entre **dos ramas de laurel**, una a cada lado.

- **Número:** Montserrat 900, 88 / 62 / 50 px × escala para el 1.º / 2.º / 3.º. Degradado vertical del metal (claro arriba, profundo abajo) recortado al texto y un **canto** oscuro de 5 % del tamaño debajo, que le da volumen, más un brillo del metal.
- **Ramas:** cada una es un arco abierto como "(" con 8 nudos de dos hojas en punta (afuera y adentro) que se afinan hacia arriba, y una hoja en la punta. Miden 1,2 veces el alto del número y van del color del metal con el mismo canto. La derecha es la izquierda en espejo. Es un SVG dibujado una vez en `ranking-script.html` (`RAMA`).

**Metal enchapado, no opaco.** Todo lo que es de metal (número, tapa, ramas de laurel y borde de la píldora) usa el mismo degradado pulido de siete paradas: claro, medio, una **banda oscura de reflejo** al 52 % y otra vez claro. Esa alternancia de luz y sombra es la que hace leer la pieza como metal brillante y no como un color plano.

| Metal | Degradado pulido (0 · 18 · 38 · 52 · 64 · 78 · 100 %) | Canto |
|---|---|---|
| Oro | `#FFFDE8 · #FFE680 · #FFC400 · #A86E00 · #FFD84D · #FFF3B0 · #C98A00` | `#8A5A00` |
| Plata | `#FFFFFF · #F1F4F7 · #C9D1D8 · #6F7A84 · #D9E0E6 · #FFFFFF · #8E99A3` | `#4F5861` |
| Bronce | `#FFE9D6 · #F6B87E · #D9853F · #7E3C10 · #E9A267 · #FFD9B5 · #9A5220` | `#5E2C0B` |

- **Número:** el degradado en vertical (`--m-num`). **Tapa:** el mismo metal en bandas horizontales (`--m-aro`, §6.2). Sobre el número pasa además un **destello** blanco en diagonal cada 4,5 s, desfasado 1,5 s entre puestos; se apaga con movimiento reducido.
- **Ramas de laurel:** el mismo degradado como `linearGradient` SVG (`#rp-metal-oro`, `-plata`, `-bronce` en `ranking-view.html`). Se aplica a cada hoja por separado, así cada una brilla en los filos y se oscurece en el nervio.
- **Borde de la píldora:** el degradado en horizontal (`--m-brillo`), con el truco de doble fondo (relleno oscuro en `padding-box`, metal en `border-box`).
- **Avatar:** una variante sin la banda oscura (`--m-fondo`), para que las iniciales oscuras siempre queden sobre metal claro.

### 6.3 Fila de la cuadrícula
Fondo `linear-gradient(90deg, rgba(10,34,72,.7), rgba(6,18,48,.55))`, borde azul hielo al 12 %, radio 16 px, **sin** `backdrop-filter`. Puesto en un círculo apagado (fondo y borde azul hielo, número `#B8D8F8`), sin resplandor. Nada de cian neón: compite con el podio y se ve poco elegante en cientos de filas.

### 6.4 Chip de tiempo
Reloj + tiempo total en sus quizzes, en minutos y segundos como en la vista Tabla (`6 min 00 seg`; bajo un minuto, `45 seg`; `formatoSeg` en `comun-script.html`), que es el criterio de desempate. **Lo lleva todo el mundo, también el top 3**: así cada puesto tiene la misma estructura (nombre, puntos y tiempo), las filas quedan alineadas y el público ve el desempate antes de que ocurra. En la cuadrícula va debajo del nombre; en el podio, debajo de los puntos. Tamaño `--rp-tiempo`.

### 6.5 "+N" y destello
Quien sumó puntos desde el último refresco: la fila destella en aqua con una franja a la izquierda y aparece "+N" que sube y se desvanece (2,4 s). Solo se anima quien cambió.

### 6.6 Corona y estrellas del 1.º
Corona del metal sobre el avatar. El 1.º lleva además un brillo que respira y dos destellos en forma de estrella, en **oro del tema** (`#FFE066` / `#FFD700`), no en el amarillo de Google.

### 6.7 Panel de ajustes
Hoja inferior de vidrio azul (`rgba(7,33,70,.78)` + blur 8 px). Mientras se mueve un deslizador se vuelve casi transparente para ver el efecto en el ranking. Botón principal `#0055FF`, botón de texto cian.

### 6.8 Navegación y franja superior
- La barra de navegación toma el fondo azul noche; con "Ocultar menú de navegación" desaparece.
- La franja de cuatro colores de Google se oculta en esta vista: rompe el escenario y compite con el podio.

## 7. Movimiento

| Animación | Duración | Dónde |
|---|---|---|
| Brillo del avatar del 1.º | 2,8 s, infinito | Podio |
| Destellos de estrella del 1.º | 1,8 s, infinito, desfasados 0,9 s | Podio |
| Destello de fila que subió | 1,6 s, una vez | Cuadrícula y podio |
| "+N" que sube y se desvanece | 2,4 s, una vez | Cuadrícula y podio |

Con `prefers-reduced-motion: reduce` todas se apagan. No se agregan levitaciones ni pulsos permanentes en la cuadrícula: distraen de la lectura y cuestan en pantallas con cientos de filas.

## 8. Accesibilidad y contraste

Contraste medido sobre el fondo base (`#040B26`), la fila (`≈ #061A3D`) y el punto más brillante del halo (`≈ #022F8F`):

| Texto | Fondo base | Fila | Halo |
|---|---|---|---|
| Blanco | 19,4 | 17,2 | 11,6 |
| Cian `#00E5FF` | 12,6 | 11,2 | 7,6 |
| Hielo `#B8D8F8` | 13,2 | 11,6 | 7,9 |
| Aqua `#2DCCCD` | 9,8 | 8,7 | 5,9 |
| Oro `#FFD700` | 13,9 | 12,2 | 8,3 |
| Plata `#E6EAEE` | 16,1 | 14,2 | 9,6 |
| Bronce `#F0B07A` | 10,4 | 9,2 | 6,2 |

Todo pasa AA (4,5:1); salvo el aqua y el bronce sobre el halo, pasa AAA (7:1). Las iniciales del avatar (`#040B26`) sobre el centro del metal: oro 13,9, plata 10,7, bronce 6,2.

- El puesto siempre se muestra como número: el metal nunca es la única pista.
- Botones sin texto con `aria-label`; la hora con `aria-live="polite"`.

## 9. Rendimiento

- Sin `backdrop-filter` en las filas ni en nada que se repita; sí en botones de cabecera y en el panel de ajustes.
- Sombras y brillos estáticos; las animaciones infinitas solo en el 1.º.
- Fondo con `background-attachment: fixed` y dos degradados, sin imágenes.

## 10. Fuera de alcance de esta vista

Se conservan como referencia de la campaña, pero **no** se implementan en el ranking:

- Robot 3D y su micro-narrativa (no hay recursos del personaje en el proyecto).
- Patrón A (escenario asimétrico 45/55) y Patrón B (estado de error 50/50).
- Tarjetas flotantes holográficas, barra de pilares "Explora · Conecta · Aplica · Transforma" y cartel de "¡Gracias!".
- Confeti.
- Tipografía corporativa Benton Sans (propiedad de BBVA): se usa Montserrat + Inter como alternativa web.

## 11. Dónde está en el código

| Archivo | Qué contiene |
|---|---|
| `appscript/ranking-view.html` | Controles flotantes de la vista y el contenedor `#rp-contenido` |
| `appscript/ranking-style.html` | Medidas base (arriba) y tema escénico (`body.pantalla-grande`, abajo) |
| `appscript/ranking-script.html` | Podio, cuadrícula, chip de desempate, "+N", pie y panel de ajustes |
| `appscript/comun-script.html` | `avatarDePuesto`, `metalDe`, `CORONA` (compartidos con la sala de espera) |
