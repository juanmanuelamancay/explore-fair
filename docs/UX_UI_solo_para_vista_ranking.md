# Sistema de Diseño UX/UI: Estética High-Tech & Gamificación Corporativa
**Referencia Visual:** Campaña "Feria de Agentes de IA" (Estilo BBVA Tech)  
**Propósito:** Guía maestra de arquitectura UX, tokens de diseño UI y especificaciones técnicas para el desarrollo de aplicaciones web, landing pages y plataformas interactivas.

---

## 1. Visión General y Dirección de Arte
El lenguaje visual fusiona la **confianza institucional corporativa** con una **estética futurista, inmersiva y gamificada**. En lugar de utilizar el tradicional diseño bancario plano y claro (*Light Mode*), este sistema adopta un **Modo Oscuro Escénico (*Stage Dark UI*)** donde la luz actúa como jerarquía visual.

### Pilares de Diseño
1. **Inmersión Escénica:** Los fondos no son planos; simulan un escenario tecnológico con iluminación volumétrica, haces de luz (*spotlights*) y desenfoque de profundidad de campo (*bokeh*).
2. **Tecnología Humanizada:** El uso de un personaje 3D carismático (Agente Robot) como hilo conductor reduce la fricción cognitiva y guía emocionalmente al usuario en cada estado del sistema.
3. **Claridad de Alto Contraste:** Toda la información crítica de lectura se ubica sobre zonas de sombra controlada (Azul Noche Profundo) utilizando tipografía blanca y acentos en Cian Neón para garantizar accesibilidad (WCAG AAA en titulares).
4. **Interfaces Holográficas (*Glassmorphism*):** Los elementos secundarios e iconográficos flotan en el espacio tridimensional dentro de contenedores translúcidos con bordes luminosos.

---

## 2. Tokens de Color (Color System)

### 2.1 Paleta Principal y Fondos
| Token | Nombre | HEX | RGB | Uso en la Interfaz |
| :--- | :--- | :--- | :--- | :--- |
| `--color-bg-deep` | **Core Navy (Fondo Base)** | `#040B26` | `4, 11, 38` | Fondo principal detrás de bloques de texto para máxima legibilidad y contraste. |
| `--color-bg-navy` | **BBVA Dark Navy** | `#072146` | `7, 33, 70` | Tono medio para transiciones de degradado y fondos de tarjetas oscuras. |
| `--color-primary-royal` | **Electric Royal Blue** | `#004481` | `0, 68, 129` | Color institucional base, iluminación de ambiente y estructura del escenario. |
| `--color-stage-glow` | **Stage Blue Light** | `#0055FF` | `0, 85, 255` | Haces de luz, resplandores radiales detrás del elemento central 3D. |

### 2.2 Acentos y Textos
| Token | Nombre | HEX | RGB | Uso en la Interfaz |
| :--- | :--- | :--- | :--- | :--- |
| `--color-accent-cyan` | **Cyber Cyan (Acento Principal)** | `#00E5FF` | `0, 229, 255` | Palabras clave en titulares, subrayados activos, bordes neón, íconos y ojos del robot. |
| `--color-accent-aqua` | **Core Aqua** | `#2DCCCD` | `45, 204, 205` | Variación secundaria para textos del header ("oportunidades") y estados *hover*. |
| `--color-text-primary` | **Pure White** | `#FFFFFF` | `255, 255, 255` | Logotipo, primera línea de titulares H1, subtítulos e íconos principales. |
| `--color-text-muted` | **Ice Blue** | `#B8D8F8` | `184, 216, 248` | Textos legales, etiquetas secundarias o descripciones largas. |

### 2.3 Colores Semánticos y Gamificación (Podio y Estados)
| Token | Nombre | HEX / Gradiente Sugerido | Uso en la Interfaz |
| :--- | :--- | :--- | :--- |
| `--color-rank-gold` | **Winner Gold (1° Lugar)** | `linear-gradient(135deg, #FFF3B0 0%, #FFD700 50%, #B8860B 100%)` | Trofeo principal, bordes de tarjeta de 1° puesto, laureles y confeti. |
| `--color-rank-silver` | **Runner-up Silver (2° Lugar)** | `linear-gradient(135deg, #FFFFFF 0%, #C0C0C0 50%, #7F8C8D 100%)` | Trofeo secundario, bordes y número del 2° puesto. |
| `--color-rank-bronze` | **Third Place Bronze (3° Lugar)** | `linear-gradient(135deg, #F5CBA7 0%, #CD7F32 50%, #873600 100%)` | Trofeo, bordes y número del 3° puesto. |
| `--color-state-warning`| **Maintenance Amber** | `#FFB800` | Luces de alerta en páginas de error 500/mantenimiento y cintas de precaución. |

---

## 3. Sistema Tipográfico (Typography)

### Familias Tipográficas Recomendadas
* **Corporativa Original:** *Benton Sans* (Propiedad de BBVA).
* **Alternativas Web (Google Fonts):**
  * **Titulares (Display):** `Montserrat` o `Plus Jakarta Sans` (Pesos: *700 Bold*, *800 ExtraBold*, *900 Black*).
  * **Cuerpo y UI:** `Inter` o `DM Sans` (Pesos: *400 Regular*, *500 Medium*, *600 SemiBold*).
  * **Acento Manuscrito (Opcional para cierres):** `Caveat` o `Pacifico` con efecto de sombra neón.

### Escala y Jerarquía Tipográfica (Desktop)

1. **Kicker / Eyebrow (`FERIA DE AGENTES DE IA`):**
   * **Tamaño:** `1.125rem` (`18px`) a `1.25rem` (`20px`)
   * **Peso:** `700 (Bold)`
   * **Transformación:** `UPPERCASE`
   * **Tracking (Espaciado):** `0.08em`
   * **Elemento decorativo obligatorio:** Barra inferior sólida de `48px` de ancho por `4px` de alto en color `--color-accent-cyan` (`#00E5FF`), separada a `8px` del texto.

2. **Hero Headline - H1 (`BIENVENIDOS` / `NUESTROS GANADORES`):**
   * **Tamaño:** `3.5rem` (`56px`) a `4.5rem` (`72px`) — `clamp(2.5rem, 5vw, 4.5rem)`
   * **Peso:** `900 (Black)`
   * **Line Height:** `1.05` (muy compacto para impacto visual)
   * **Regla Bicolor:**
     * *Línea 1:* Blanco Puro (`#FFFFFF`).
     * *Línea Destacada:* Cian Neón (`#00E5FF`).
   * **Variante Estado de Error:** En pantallas de soporte técnico, se utiliza *Sentence case* (primera letra mayúscula y resto minúsculas) con peso `800 (ExtraBold)` para dar un tono más conversacional y calmado (`Estamos presentando` / `algunos problemas técnicos`).

3. **Lead / Subtítulo (`El talento que impulsa nuevas oportunidades.`):**
   * **Tamaño:** `1.5rem` (`24px`) a `1.75rem` (`28px`)
   * **Peso:** `400 (Regular)`
   * **Line Height:** `1.4`
   * **Color:** `#FFFFFF` (Opacidad `90%`)

4. **Etiquetas de Iconografía (`EXPLORA | CONECTA | APLICA | TRANSFORMA`):**
   * **Tamaño:** `0.875rem` (`14px`)
   * **Peso:** `600 (SemiBold)`
   * **Transformación:** `UPPERCASE`
   * **Tracking:** `0.05em`

---

## 4. Arquitectura de Layout y Retícula (UX Layout Patterns)

El sistema utiliza dos patrones de composición principales según el objetivo de la vista:

### Patrón A: Escenario Asimétrico 45 / 55 (Vistas de Bienvenida, Éxito y Cierre)
Ideal para *Hero Sections*, *Landing Pages* y pantallas de anuncio.
* **Columna Izquierda (45% del viewport):**
  * Alineación totalmente a la izquierda.
  * Fondo con viñeta oscura (`#040B26`) para asegurar que ningún elemento brillante del fondo interfiera con la lectura.
  * Orden vertical estricto:
    1. *Brand Header* (Logo + divisor vertical + eslogan).
    2. *Espaciador amplio* (`48px` - `64px`).
    3. *Kicker* + línea cian.
    4. *H1 Bicolor*.
    5. *Subtítulo / Copy*.
    6. *Footer de sección / Pilares iconográficos o CTA*.
* **Columna Derecha (55% del viewport):**
  * Composición piramidal centrada en el personaje 3D sobre una plataforma circular luminosa.
  * Marco geométrico de neón cian rotado ligeramente (`-5deg` a `8deg`) detrás del sujeto principal para encuadrar la acción.
  * Elementos flotantes (*Glass Cards*) distribuidos en arco alrededor del personaje.

### Patrón B: Composición de Estado del Sistema 50 / 50 (Mantenimiento / Error 404 / 500)
* **Header Superior Centrado:** El logo y el *kicker* (`FERIA DE AGENTES DE IA`) se unifican en una sola línea horizontal en la parte superior central.
* **Columna Izquierda (50%):** El personaje 3D abandona el podio y se sitúa a nivel del suelo interactuando con el problema (reparando una laptop con una llave inglesa y caja de herramientas).
* **Columna Derecha (50%):** Mensaje de estado alineado a la izquierda, divisor cian inferior y un indicador de tiempo (`Volvemos en breve` + ícono de reloj en cian), acompañado en la esquina inferior derecha por utilería 3D contextual (conos y valla de mantenimiento con luz ámbar).

---

## 5. Especificaciones de Componentes UI

### 5.1 Header de Co-Branding Institucional
Compuesto por tres elementos en disposición horizontal (`display: flex; align-items: center; gap: 16px;`):
1. **Logotipo Principal:** Blanco puro.
2. **Divisor Vertical:** Línea de `1px` o `2px` de ancho, `40px` de alto, color blanco con `50%` de opacidad.
3. **Tagline de Campaña:** Tres líneas de texto pequeño (`14px`), donde las líneas 1 y 3 son blancas y la línea central ("oportunidades") está en color `--color-accent-aqua`.

### 5.2 Tarjetas Flotantes Holográficas (Floating Glass Cards)
Son los distintivos visuales más reconocibles del sistema. Representan capacidades técnicas o reacciones sociales.
* **Dimensiones:** Cuadradas, de `72px × 72px` a `96px × 96px`.
* **Bordes:** `border-radius: 20px`, borde sólido de `2px` en `#00E5FF`.
* **Fondo:** `rgba(0, 85, 255, 0.25)` con `backdrop-filter: blur(12px)`.
* **Resplandor (Glow):** `box-shadow: 0 0 25px rgba(0, 229, 255, 0.5), inset 0 0 15px rgba(0, 229, 255, 0.3)`.
* **Rotación Dinámica:** Cada tarjeta tiene una inclinación individual entre `-15deg` y `+15deg` para dar sensación de ingravidez.
* **Contenido:** Ícono vectorial blanco centrado (`</>` código, engranajes, bombilla, gráfico de barras, burbuja de chat, corazón, estrella, llave inglesa, alerta).

### 5.3 Componente de Podio y Ranking (Leaderboard UI)
Para pantallas de gamificación, hackathons o premiaciones:
* **Píldoras de Nombre (Nameplates):**
  * Contenedor en forma de estadio (`border-radius: 9999px`), fondo azul muy oscuro (`#03091E`).
  * Borde metálico de `3px` según posición (Oro para el 1°, Plata para el 2°, Bronce para el 3°).
  * Decoración interna: Ramas de laurel vectoriales a ambos lados del nombre del ganador.
  * Texto del ganador en blanco, mayúsculas y peso *Bold*.
* **Pedestales:**
  * Cilindros/prismas azul rey iluminados desde abajo con tiras LED cian en la base.
  * Números gigantes (`1`, `2`, `3`) con textura metálica 3D abrazados por coronas de laurel.

### 5.4 Barra de Pilares de Valor (Process Steps)
Ubicada en la parte inferior izquierda (vista en la pantalla de agradecimiento):
* **Estructura:** Fila horizontal de 4 pasos separados por una línea vertical sutil (`1px solid rgba(255, 255, 255, 0.2)`).
* **Ícono:** Círculo de `56px × 56px`, borde de `1.5px` en `#00E5FF`, fondo ligeramente translúcido y pictograma lineal en cian (Brújula, Comunidad, Bombilla, Crecimiento).
* **Etiqueta:** Texto en blanco centrado debajo del círculo (`EXPLORA`, `CONECTA`, `APLICA`, `TRANSFORMA`).

### 5.5 Base / Plataforma Escénica (Stage Podium Base)
* Estructura elíptica en la parte inferior de la pantalla con anillos concéntricos.
* Incorpora segmentos de luz neón cian (`box-shadow` intenso) que simulan luces de pista o de escenario futurista, anclando al personaje 3D para que no parezca "pegado" sobre el fondo.

---

## 6. Psicología UX y Micro-Narrativa del Personaje (Agente IA)

El éxito de esta interfaz radica en el uso consistente de su mascota (el robot blanco y azul con pantalla facial negra y ojos cian):

| Etapa del Usuario (User Journey) | Postura y Utilería del Robot | Iconos Flotantes Asociados | Impacto Psicológico (UX) |
| :--- | :--- | :--- | :--- |
| **1. Bienvenida / Onboarding** | Sostiene una tablet corporativa con una mano y extiende la otra invitando a entrar. | `</>`, Engranajes, Bombilla, Gráfico, Chat. | Genera curiosidad, profesionalismo y reduce la barrera de entrada tecnológica. |
| **2. Competencia / Ganadores** | Brazos levantados en señal de victoria en lo más alto del podio junto a las copas. | Confeti dorado, destellos de luz y haces de reflectores. | Despierta orgullo, celebración y sentido de logro comunitario. |
| **3. Cierre / Agradecimiento** | Brazos completamente abiertos en gesto de abrazo bajo un cartel neón de "¡Gracias!". | Corazón, Usuarios, Bombilla, Gráfico, Estrella. | Fomenta recordación positiva de marca y conexión emocional. |
| **4. Error / Mantenimiento** | Sentado en el suelo frente a una laptop, sosteniendo una llave inglesa con expresión feliz/calmada. | Engranaje, Llave inglesa, Triángulo de advertencia (`!`). | Transforma un momento de frustración técnica en una experiencia empática y transparente. |

---

## 7. Guía de Implementación en Código (CSS3 / Tailwind Ready)

Puedes copiar este bloque CSS base en tu proyecto web para disponer de todas las variables, utilidades de cristal, textos neón y fondos escénicos listos para usar:

```css
/* ==========================================================================
   DESIGN SYSTEM TOKENS - FERIA DE AGENTES IA
   ========================================================================== */
:root {
  /* Colores Base */
  --bg-core-navy: #040B26;
  --bg-dark-navy: #072146;
  --primary-royal: #004481;
  --stage-electric: #0055FF;
  
  /* Acentos */
  --accent-cyan: #00E5FF;
  --accent-aqua: #2DCCCD;
  --text-white: #FFFFFF;
  --text-muted: #B8D8F8;
  
  /* Semánticos & Gamificación */
  --gold-main: #FFD700;
  --silver-main: #C0C0C0;
  --bronze-main: #CD7F32;
  --warning-amber: #FFB800;

  /* Efectos de Cristal y Neón */
  --glass-surface: rgba(0, 68, 129, 0.35);
  --glass-border: rgba(0, 229, 255, 0.65);
  --neon-shadow: 0 0 20px rgba(0, 229, 255, 0.5), inset 0 0 12px rgba(0, 229, 255, 0.25);
  --neon-text-glow: 0 0 15px rgba(0, 229, 255, 0.4);

  /* Tipografía */
  --font-display: 'Montserrat', system-ui, -apple-system, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
}

/* ==========================================================================
   ESTILOS DE ESCENARIO Y LAYOUT
   ========================================================================== */
body {
  background-color: var(--bg-core-navy);
  color: var(--text-white);
  font-family: var(--font-body);
  margin: 0;
  overflow-x: hidden;
}

/* Contenedor Hero con Iluminación de Escenario */
.stage-hero-container {
  position: relative;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 5fr 7fr;
  align-items: center;
  padding: 4rem 6vw;
  background: 
    radial-gradient(circle at 72% 48%, rgba(0, 85, 255, 0.55) 0%, rgba(0, 68, 129, 0.2) 35%, rgba(4, 11, 38, 0.98) 70%),
    linear-gradient(125deg, #040B26 0%, #072146 50%, #040B26 100%);
}

/* ==========================================================================
   COMPONENTES TIPOGRÁFICOS
   ========================================================================== */
.ui-kicker {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-white);
  display: inline-block;
  margin-bottom: 1.5rem;
}

.ui-kicker::after {
  content: "";
  display: block;
  width: 52px;
  height: 4px;
  background-color: var(--accent-cyan);
  margin-top: 10px;
  box-shadow: 0 0 10px var(--accent-cyan);
}

.ui-title-hero {
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 5vw, 4.5rem);
  font-weight: 900;
  line-height: 1.05;
  text-transform: uppercase;
  margin: 0 0 1.5rem 0;
}

.ui-title-hero .highlight-cyan {
  color: var(--accent-cyan);
  display: block;
  text-shadow: var(--neon-text-glow);
}

.ui-subtitle {
  font-size: clamp(1.125rem, 1.8vw, 1.625rem);
  font-weight: 400;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.92);
  max-width: 540px;
}

/* ==========================================================================
   COMPONENTES HOLOGRÁFICOS Y TARJETAS
   ========================================================================== */
.ui-glass-icon-card {
  width: 84px;
  height: 84px;
  background: var(--glass-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 2px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--neon-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-white);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease;
}

.ui-glass-icon-card:hover {
  transform: translateY(-6px) rotate(0deg) scale(1.06) !important;
  box-shadow: 0 0 32px rgba(0, 229, 255, 0.85), inset 0 0 18px rgba(0, 229, 255, 0.4);
}

/* Marco de Neón Trasero (Detrás del Robot) */
.ui-neon-frame {
  border: 3px solid var(--accent-cyan);
  border-radius: 28px;
  background: rgba(0, 40, 100, 0.25);
  box-shadow: 0 0 35px rgba(0, 229, 255, 0.45), inset 0 0 25px rgba(0, 229, 255, 0.2);
  transform: rotate(-6deg);
}

/* Píldora de Ganador en Podio */
.ui-podium-badge {
  background: linear-gradient(180deg, #071936 0%, #03091A 100%);
  border-radius: 9999px;
  padding: 0.75rem 2.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  color: var(--text-white);
  letter-spacing: 0.06em;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
}

.ui-podium-badge--gold {
  border: 2.5px solid var(--gold-main);
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.35);
}

.ui-podium-badge--silver {
  border: 2px solid var(--silver-main);
  box-shadow: 0 0 20px rgba(192, 192, 192, 0.25);
}

.ui-podium-badge--bronze {
  border: 2px solid var(--bronze-main);
  box-shadow: 0 0 20px rgba(205, 127, 50, 0.25);
}

/* ==========================================================================
   PASOS DE PROCESO (EXPLORA | CONECTA | APLICA | TRANSFORMA)
   ========================================================================== */
.ui-steps-row {
  display: flex;
  align-items: center;
  margin-top: 2.5rem;
}

.ui-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 1.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.ui-step-item:first-child { padding-left: 0; }
.ui-step-item:last-child { border-right: none; }

.ui-step-circle {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 1.5px solid var(--accent-cyan);
  background: rgba(0, 229, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-cyan);
  margin-bottom: 0.65rem;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
}

.ui-step-label {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

---

## 8. Configuración Rápida para Tailwind CSS (`tailwind.config.js`)

Si trabajas con React, Vue, Next.js o Astro usando Tailwind CSS, extiende tu configuración con este bloque:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        bbva: {
          deep: '#040B26',
          navy: '#072146',
          royal: '#004481',
          stage: '#0055FF',
          cyan: '#00E5FF',
          aqua: '#2DCCCD',
        },
        podium: {
          gold: '#FFD700',
          silver: '#C0C0C0',
          bronze: '#CD7F32',
        }
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 229, 255, 0.5), inset 0 0 12px rgba(0, 229, 255, 0.25)',
        'neon-cyan-lg': '0 0 35px rgba(0, 229, 255, 0.8), inset 0 0 20px rgba(0, 229, 255, 0.4)',
        'neon-gold': '0 0 25px rgba(255, 215, 0, 0.4)',
      },
      backgroundImage: {
        'stage-radial': 'radial-gradient(circle at 72% 48%, rgba(0, 85, 255, 0.55) 0%, rgba(0, 68, 129, 0.2) 35%, rgba(4, 11, 38, 0.98) 70%)',
      }
    },
  },
  plugins: [],
}
```

---

## 9. Reglas de Animación y Micro-interacciones (Motion UI)

Para llevar estas imágenes estáticas a una experiencia web viva:
1. **Levitación Continua (`Floating Animation`):** Aplica una animación infinita suave (`translateY(-10px)` durante `3s` con `ease-in-out` alternado) a los íconos flotantes y un desfase (`animation-delay`) distinto a cada tarjeta para que no se muevan al mismo tiempo.
2. **Parpadeo Ocular del Robot:** Si el robot se integra como SVG o Lottie, programa un parpadeo de sus ojos cian cada `4.5s` y un ligero pulso de brillo en el logo de su pecho.
3. **Resplandor de Pista (`Stage Pulse`):** Las luces rectangulares cian de la plataforma inferior deben alternar su opacidad entre `0.6` y `1.0` para simular energía corriendo por el escenario.
4. **Adaptabilidad Móvil (Responsive Breakpoints):**
   * En pantallas `< 1024px` (Tablet/Mobile), la retícula `5fr 7fr` pasa a una sola columna vertical (`1fr`).
   * El bloque de texto se centra en la parte superior y el escenario con el robot se ubica inmediatamente debajo, reduciendo el número de tarjetas flotantes de 5 a 3 para no saturar el ancho del dispositivo móvil.