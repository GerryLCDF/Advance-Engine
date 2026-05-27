# Advance Studio — Launcher

Motor de desarrollo para proyectos de Game Boy Advance.  
Versión actual: **V alfa 0.0.05**

---

## Tabla de contenidos

1. [Requisitos](#requisitos)
2. [Instalación](#instalación)
3. [Comandos de desarrollo](#comandos-de-desarrollo)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Arquitectura técnica](#arquitectura-técnica)
6. [Sistema de cartuchos](#sistema-de-cartuchos)
7. [Estado global — Zustand](#estado-global--zustand)
8. [IPC — Comunicación Electron ↔ Renderer](#ipc--comunicación-electron--renderer)
9. [Pantallas y navegación](#pantallas-y-navegación)
10. [Componentes reutilizables](#componentes-reutilizables)
11. [Assets y recursos](#assets-y-recursos)
12. [Persistencia de datos](#persistencia-de-datos)
13. [Decisiones de diseño y bugs resueltos](#decisiones-de-diseño-y-bugs-resueltos)

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| Windows | 10 / 11 (probado) |

---

## Instalación

```bash
# Clonar o abrir la carpeta del proyecto
cd advance-engine

# Instalar todas las dependencias
npm install
```

---

## Comandos de desarrollo

| Comando | Descripción |
|---|---|
| `npm run dev` | Lanza Vite + Electron en paralelo (modo desarrollo) |
| `npm run build:renderer` | Compila el renderer con Vite → `dist/renderer/` |
| `npm run build:electron` | Compila el proceso principal con tsc → `dist/electron/` |
| `npm run build` | Build completo de producción (renderer primero, luego electron) |

### Cómo funciona `npm run dev`

1. `vite` arranca el servidor de desarrollo en `http://localhost:5173`
2. `wait-on` espera a que el puerto 5173 responda
3. `build:electron` compila `electron/main.ts` y `electron/preload.ts` a CommonJS
4. `electron .` lanza la ventana con `NODE_ENV=development`, que apunta a `http://localhost:5173`
5. Se abre una ventana de DevTools separada para depuración

> **Importante:** Siempre cierra los procesos anteriores antes de correr `npm run dev` de nuevo. Si el puerto 5173 ya está ocupado el servidor no arrancará.

---

## Estructura del proyecto

```
advance-engine/
│
├── electron/                        # Proceso principal de Electron
│   ├── main.ts                      # BrowserWindow, IPC handlers, persistencia JSON
│   └── preload.ts                   # contextBridge → window.advanceAPI
│
├── src/renderer/                    # Aplicación React (renderer process)
│   ├── main.tsx                     # Punto de entrada React + ErrorBoundary
│   ├── index.css                    # Variables CSS globales, reset, clases compartidas
│   ├── global.d.ts                  # Tipos de window.advanceAPI para TypeScript
│   │
│   ├── types/
│   │   └── index.ts                 # Project, TemplateId, TEMPLATES, ActiveScreen, CreditEntry
│   │
│   ├── store/
│   │   └── useAppStore.ts           # Store Zustand — estado global + acciones
│   │
│   ├── components/                  # Componentes reutilizables
│   │   ├── AppHeader.tsx            # Cabecera: logo, título, versión, controles de ventana
│   │   ├── TabBar.tsx               # Barra inferior de pestañas (Reciente / Crear / importar)
│   │   ├── CartuchoDisplay.tsx      # Renderizado por capas del cartucho GBA
│   │   └── CartuchoPanel.tsx        # Panel izquierdo compartido (preview + Modificar Cartucho)
│   │
│   └── screens/                     # Pantallas de la aplicación
│       ├── Launcher.tsx             # Orquestador — monta todas las pantallas
│       ├── RecientesScreen.tsx      # Últimos 3 proyectos + engranajes + Todos
│       ├── TodosProyectosScreen.tsx # Lista completa de proyectos
│       ├── CrearScreen.tsx          # Formulario de creación de proyecto
│       ├── ImportarScreen.tsx       # Formulario de importación de proyecto
│       ├── EditarScreen.tsx         # Edición + eliminación de proyecto
│       ├── ModificarPortadaScreen.tsx # Selector de portada y plantilla de cartucho
│       ├── CreditosScreen.tsx       # Scroll de créditos con hover glow
│       └── EditorPlaceholderScreen.tsx # Pantalla "En Proceso" del editor
│
├── public/
│   └── recursos/                    # Assets servidos estáticamente por Vite
│       ├── cartucho.png             # Marco del cartucho (ventana blanca interior)
│       ├── cartuchotransparente.png # Marco con portada azul por defecto
│       ├── cartucho_color.png       # Marco variante de color
│       └── portada.png              # Portada por defecto
│
├── index.html                       # HTML raíz (Vite entry point)
├── vite.config.ts                   # Configuración Vite
├── tsconfig.json                    # TypeScript para el renderer (moduleResolution: bundler)
├── tsconfig.electron.json           # TypeScript para Electron (module: CommonJS)
└── package.json
```

---

## Arquitectura técnica

### Separación de procesos

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process  (Node.js / CommonJS)         │
│  electron/main.ts → dist/electron/main.js            │
│                                                       │
│  • Crea BrowserWindow (820×580, no resizable)        │
│  • Lee/escribe projects.json en userData             │
│  • Expone IPC handlers                               │
└──────────────────┬──────────────────────────────────┘
                   │ contextBridge (IPC seguro)
┌──────────────────▼──────────────────────────────────┐
│  Preload Script  (electron/preload.ts)               │
│                                                       │
│  Expone window.advanceAPI con:                       │
│  • projects.{getAll, create, update, delete}         │
│  • dialog.{openFolder, openImage}                    │
│  • shell.openExternal                                │
│  • window.{minimize, close}                          │
└──────────────────┬──────────────────────────────────┘
                   │ window.advanceAPI
┌──────────────────▼──────────────────────────────────┐
│  Renderer Process  (React + Vite)                    │
│  src/renderer/ → dist/renderer/                      │
│                                                       │
│  • React 18 + Framer Motion + Zustand               │
│  • Sin acceso directo a Node.js                     │
│  • Se comunica con el main SOLO por advanceAPI      │
└─────────────────────────────────────────────────────┘
```

### Configuraciones TypeScript

Existen dos configuraciones separadas para evitar conflictos ESM/CommonJS:

| Archivo | Destino | `module` | `moduleResolution` |
|---|---|---|---|
| `tsconfig.json` | Renderer (Vite) | ESNext | bundler |
| `tsconfig.electron.json` | Electron (Node) | CommonJS | node |

El renderer usa `noEmit: true` — Vite hace la transpilación. El proceso electron emite a `dist/electron/`.

---

## Sistema de cartuchos

`CartuchoDisplay.tsx` implementa un sistema de **4 capas CSS** para renderizar el cartucho GBA con portada personalizable:

```
┌────────────────────────────────────────────┐
│  Layer 3: Nombre del proyecto (opcional)   │  zIndex: 3
│  position: absolute — dentro de la ventana │
├────────────────────────────────────────────┤
│  Layer 2: Marco del cartucho (PNG)  ──────  │  zIndex: 2
│  Mismo PNG que Layer 0, tapa los bordes    │  ← TAPA la portada
│  de la portada gracias al área opaca       │
├────────────────────────────────────────────┤
│  Layer 1: Portada del usuario / default ── │  zIndex: 1
│  Posicionada dentro de la ventana:         │
│  top:11% left:12% right:12% bottom:18%    │
├────────────────────────────────────────────┤
│  Layer 0: Marco del cartucho (PNG base) ── │  zIndex: 0
│  cartucho.png o variante según template    │
└────────────────────────────────────────────┘
```

El truco clave es que el **marco se dibuja dos veces**: una como fondo (Layer 0) y otra encima de la portada (Layer 2). La segunda capa tiene el área interior transparente en el PNG, por lo que la portada se ve a través de ella, pero el marco opaco tapa cualquier desbordamiento de la imagen de portada.

### Plantillas disponibles

| ID | Label | Archivo |
|---|---|---|
| `cartucho` | Transparente | `cartuchotransparente.png` |
| `cartucho_color` | Color plano | `cartucho_color.png` |
| `cartuchotransparente` | Color Transparente | `cartucho.png` |

### Props de CartuchoDisplay

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `name` | `string` | `''` | Nombre mostrado en Layer 3 |
| `showName` | `boolean` | `false` | Activar/desactivar Layer 3 |
| `template` | `TemplateId` | `'cartuchotransparente'` | Variante del marco |
| `coverPath` | `string` | `''` | Ruta a la portada (vacío = default) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Tamaño: 96×72 / 192×144 / 240×180 |
| `onClick` | `() => void` | — | Si se pasa, activa hover/tap animation |

---

## Estado global — Zustand

El store principal vive en `src/renderer/store/useAppStore.ts`.

### Estructura del estado

```ts
interface AppState {
  // Navegación
  activeScreen: ActiveScreen   // pantalla activa (discriminated union)
  activeTab: LauncherTab       // 'recientes' | 'crear' | 'importar'

  // Proyectos
  projects: Project[]
  isLoadingProjects: boolean
  loadProjects()               // carga desde IPC al montar
  addProject(data)
  updateProject(id, data)
  deleteProject(id)
  openProject(id)              // actualiza lastOpened + navega al editor

  // Draft (formularios Crear / Editar / Importar)
  draftName: string
  draftAuthor: string
  draftPath: string
  draftTemplate: TemplateId
  draftCoverPath: string
  setDraft(fields)             // actualización parcial
  resetDraft()
  loadDraftFromProject(p)      // rellena el draft desde un proyecto existente

  // Créditos
  credits: CreditEntry[]
}
```

### Tipo `ActiveScreen`

```ts
type ActiveScreen =
  | { type: 'launcher' }
  | { type: 'todos-proyectos' }
  | { type: 'editar'; projectId: string }
  | { type: 'modificar-portada'; projectId: string }
  | { type: 'creditos' }
  | { type: 'editor'; projectId: string }
```

### Regla crítica de selectores

Los selectores que devuelvan arrays **deben retornar la referencia estable** del store. Cualquier transformación (sort, filter, slice) debe hacerse con `useMemo` en el componente:

```ts
// store — selector estable
export const selectProjects = (state: AppState) => state.projects;

// componente — transformación memoizada
const projects = useAppStore(selectProjects);
const recent = useMemo(
  () => [...projects].sort(...).slice(0, 3),
  [projects]
);
```

> Si el selector devuelve un nuevo array en cada llamada (ej: `[...state.projects].sort()`) Zustand detecta cambio de referencia en cada render → loop infinito de re-renders.

---

## IPC — Comunicación Electron ↔ Renderer

Todos los canales IPC están definidos en `electron/main.ts` y expuestos en `electron/preload.ts`.

### Proyectos

| Canal | Dirección | Descripción |
|---|---|---|
| `projects:getAll` | invoke | Devuelve todos los proyectos del JSON |
| `projects:create` | invoke | Crea proyecto y lo guarda |
| `projects:update` | invoke | Actualiza campos de un proyecto |
| `projects:delete` | invoke | Elimina un proyecto por ID |
| `projects:setLastOpened` | invoke | Actualiza la fecha de último acceso |

### Diálogos del sistema

| Canal | Dirección | Descripción |
|---|---|---|
| `dialog:openFolder` | invoke | Abre selector de carpeta → retorna `string \| null` |
| `dialog:openImage` | invoke | Abre selector de PNG → retorna `string \| null` |

### Shell y ventana

| Canal | Dirección | Descripción |
|---|---|---|
| `shell:openExternal` | invoke | Abre URL en el navegador del sistema |
| `window-minimize` | send | Minimiza la ventana |
| `window-close` | send | Cierra la ventana |

### Uso desde el renderer

```ts
// Todos los métodos están disponibles en window.advanceAPI
const result = await window.advanceAPI.projects.create({ name, author, path, template, coverPath });
const folder = await window.advanceAPI.dialog.openFolder();
window.advanceAPI.window.close();
```

---

## Pantallas y navegación

La navegación usa un sistema de **pantallas superpuestas** con `AnimatePresence` de Framer Motion — no usa React Router.

### Jerarquía de capas

```
┌────────────────────────────────────────────────────────┐
│ EditorPlaceholderScreen   position:fixed  zIndex:100   │ ← fullscreen
├────────────────────────────────────────────────────────┤
│ CreditosScreen            position:absolute zIndex:10  │
│ ModificarPortadaScreen    position:absolute zIndex:10  │ ← overlays
│ EditarScreen              position:absolute zIndex:10  │
│ TodosProyectosScreen      position:absolute zIndex:10  │
├────────────────────────────────────────────────────────┤
│ AppHeader                 height fija                  │
│ ─────────── contenido base ────────────               │
│ RecientesScreen / CrearScreen / ImportarScreen         │ ← tabs
│ TabBar                    height fija                  │
└────────────────────────────────────────────────────────┘
```

### Flujo de navegación

```
Recientes ──[clic cartucho]──────────────────────→ EditorPlaceholder
          ──[clic engranaje]──────────────────────→ Editar
          ──[Todos los proyectos]──────────────────→ TodosProyectos

Editar ───[Modificar Cartucho]───────────────────→ ModificarPortada
       ──[Eliminar]────────────────────────────── → (modal confirmar → Recientes)
       ──[← Volver]───────────────────────────── → Recientes

ModificarPortada ──[Cambiar portada]─────────────→ (modal instrucciones → FileDialog)
                 ──[Save]──────────────────────── → Editar
                 ──[Cancel]─────────────────────→ Editar

AppHeader ──[Creditos]──────────────────────────→ CreditosScreen
```

---

## Componentes reutilizables

### `AppHeader`
Barra superior con fondo lila (`#c4a0f0`). Contiene:
- Placeholder de logo (cuadrado blanco 56×56)
- Título "Advance Studio" + versión
- Botones "Documentacion" y "Creditos"
- Controles de ventana (minimizar / cerrar) — `WebkitAppRegion: no-drag`
- Toda la barra es drag region para mover la ventana frameless

### `TabBar`
Tres pestañas en la parte inferior. La pestaña activa tiene fondo `#5a3fa0` y un indicador animado (`layoutId="tab-indicator"`) que desliza entre pestañas con Framer Motion spring.

### `CartuchoPanel`
Panel izquierdo de 260px compartido entre `CrearScreen`, `EditarScreen` e `ImportarScreen`. Recibe:
- `name`, `template`, `coverPath` → pasa a `CartuchoDisplay` para preview en tiempo real
- `onModificarCartucho` → callback del botón
- `footer` → slot React para botones adicionales (ej: "Eliminar" en EditarScreen)

### `CartuchoDisplay`
Ver [Sistema de cartuchos](#sistema-de-cartuchos).

---

## Assets y recursos

Los assets están en `public/recursos/` y son servidos por Vite como archivos estáticos en `/recursos/`:

| Archivo | Uso |
|---|---|
| `cartucho.png` | Marco base del cartucho (ventana interior blanca) |
| `cartuchotransparente.png` | Marco con portada azul incluida |
| `cartucho_color.png` | Variante de color del marco |
| `portada.png` | Portada por defecto cuando no hay ninguna asignada |

### Especificaciones para portadas personalizadas

- **Dimensiones:** 240 × 270 píxeles
- **Formato:** PNG (`.png`)
- **Modo de color:** RGB o RGBA
- La imagen se recortará automáticamente con `objectFit: cover` para ajustarse a la ventana del cartucho

---

## Persistencia de datos

### Proyectos — `projects.json`

Los proyectos se guardan en el directorio de datos del usuario de Electron:

- **Windows:** `%APPDATA%\advance-engine\projects.json`

Estructura de cada proyecto:

```json
{
  "id": "1716900000000",
  "name": "Mi Juego GBA",
  "author": "Nombre del autor",
  "path": "C:/proyectos/mi-juego",
  "template": "cartuchotransparente",
  "coverPath": "",
  "lastOpened": "2026-05-27T20:00:00.000Z"
}
```

### Preferencias UI — `localStorage`

| Clave | Tipo | Descripción |
|---|---|---|
| `advance-studio:skip-cover-hint` | `"true" \| null` | Omitir el modal de instrucciones al cambiar portada |

---

## Decisiones de diseño y bugs resueltos

### Bug 1 — Pantalla en blanco (causa raíz)
**Problema:** `NODE_ENV` nunca era `"development"` en Windows porque el script usaba `NODE_ENV=development electron .` sin `cross-env`, que no funciona en PowerShell/CMD.

**Solución:** Instalar `cross-env` y usarlo en el script. Además, añadir `|| !app.isPackaged` como fallback:
```json
"dev:electron": "npm run build:electron && cross-env NODE_ENV=development electron ."
```

### Bug 2 — `app.getPath()` antes de `whenReady()`
**Problema:** `app.getPath('userData')` se llamaba en el scope del módulo, antes de que la app estuviera lista, causando un crash silencioso.

**Solución:** Mover la inicialización de rutas a una función `initPaths()` llamada dentro de `app.whenReady()`.

### Bug 3 — `global.d.ts` rompía Vite
**Problema:** El archivo importaba tipos desde `../../electron/preload`, fuera del directorio `src/`. Vite intentaba resolver ese path y fallaba.

**Solución:** Reescribir `global.d.ts` con tipos inline, sin importar desde `electron/`.

### Bug 4 — Loop infinito de re-renders
**Problema:** Los selectores de Zustand `selectRecentProjects` y `selectAllProjects` usaban `[...state.projects].sort()` directamente. Cada llamada creaba un nuevo array con referencia diferente → Zustand lo detectaba como cambio → re-render → infinito.

**Solución:** Los selectores devuelven `state.projects` sin transformar. El sort/slice se hace con `useMemo` en cada componente.

### Bug 5 — CSP bloqueaba recursos en desarrollo
**Problema:** La Content Security Policy del `index.html` no permitía `'unsafe-eval'` (necesario para el HMR de Vite) ni recursos de `http://localhost:5173`.

**Solución:** Actualizar el CSP para incluir esos orígenes en modo desarrollo.

### Decisión — Sistema de capas del cartucho
El cartucho se dibuja con el marco **dos veces**: una como fondo y otra encima de la portada. Esto permite que la portada quede "enmarcada" dentro de la ventana del cartucho sin usar `clip-path` ni canvas, aprovechando las transparencias del PNG del marco.

### Decisión — No usar React Router
La navegación entre pantallas se implementa con un campo `activeScreen` en el store Zustand y `AnimatePresence` de Framer Motion. Las pantallas secundarias usan `position: absolute, inset: 0` para superponerse al contenido base. Esto simplifica la arquitectura y permite transiciones fluidas sin configurar rutas.

### Decisión — Draft global para formularios
En lugar de estado local en cada formulario, los campos de Crear/Editar/Importar escriben en el store global (`draftName`, `draftAuthor`, etc.). Esto permite que el `CartuchoPanel` refleje los cambios en tiempo real aunque sea un componente completamente separado.

---

## Roadmap — Próximas funcionalidades

- [ ] Implementación del editor principal (reemplaza `EditorPlaceholderScreen`)
- [ ] Scaffolding real de carpetas al crear proyecto
- [ ] Validación de dimensiones de imagen de portada (240×270)
- [ ] Soporte para más plantillas de cartucho
- [ ] Pantalla de Documentación
- [ ] Auto-updater del Launcher
- [ ] Build de producción con `electron-builder`
