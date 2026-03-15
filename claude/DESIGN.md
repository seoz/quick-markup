# Quick Markup — System Design

## Framework & Technology Choices

### No framework — vanilla HTML/CSS/JS

Quick Markup intentionally uses no JavaScript framework (no React, Vue, Svelte, etc.) and no build toolchain (no bundler, no transpiler, no package manager).

**Why:**

- **Zero-friction distribution.** The entire web version is a single `index.html` file that runs by double-clicking it. Any framework would require a build step and a `node_modules` tree, eliminating this property entirely.
- **No runtime overhead.** The hot path is `redraw()`, called on every `mousemove`. A virtual DOM or reactivity layer would add reconciliation cost between every mouse event and the actual canvas draw call, with no benefit — the canvas API is imperative by nature and does not map onto declarative component models.
- **DOM surface area is tiny.** The UI is a toolbar with ~15 controls and one modal. The complexity threshold where a component framework pays off (shared state across many components, code-split routes, SSR) is never reached.
- **Canvas is not the DOM.** Frameworks manage DOM trees. The core of this application is a `<canvas>` element whose contents are managed entirely through the Canvas 2D API — outside the framework's model regardless. A framework would own the toolbar HTML but nothing else.

### HTML5 Canvas 2D API

Chosen over SVG and WebGL:

- **SVG** would represent each annotation as a live DOM node, enabling free selection and styling after placement. The trade-off is that SVG export to a flat PNG requires serialisation through an `<img>` element, and hit testing is handled by the browser per-element rather than by application code. For a tool where export quality and simplicity matter more than post-placement editability, Canvas is a better fit.
- **WebGL** provides GPU-accelerated rendering but requires shader authorship for every primitive. The annotation shapes here (lines, arcs, text) are all first-class Canvas 2D operations. WebGL would add significant complexity with no perceptible performance benefit at typical image sizes.

### Web APIs used directly

| API | Purpose |
|---|---|
| Canvas 2D (`CanvasRenderingContext2D`) | All rendering — background, shapes, selection box |
| File API (`FileReader`) | Read uploaded image files into DataURLs |
| Clipboard API (`ClipboardEvent`, `navigator.clipboard`) | Paste image in; copy annotated image out |
| `OffscreenCanvas` | Generate extension icon in the service worker (no DOM available) |
| Chrome Extensions API (`chrome.action`, `chrome.tabs`) | Icon management and new-tab launch |

---

## Overview

Quick Markup is a zero-dependency, client-side image annotation tool delivered as both a standalone HTML file and a Chrome extension. All rendering, state management, and I/O happen entirely in the browser with no backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Tab                     │
│                                                      │
│  ┌──────────┐   events   ┌────────────────────────┐  │
│  │ Toolbar  │ ─────────► │   Application State    │  │
│  │   UI     │            │  currentTool, drawings, │  │
│  └──────────┘            │  selectedDrawing, ...   │  │
│                          └──────────┬───────────────┘  │
│  ┌──────────┐   mouse    │  redraw()│                  │
│  │  Canvas  │ ─────────► │          ▼                  │
│  │ (HTML5)  │ ◄───────── │   Render Pipeline       │  │
│  └──────────┘            │  (clear → bg → shapes   │  │
│                          │   → selection box)       │  │
│  ┌──────────┐            └─────────────────────────┘  │
│  │Clipboard │                                          │
│  │ File API │                                          │
│  └──────────┘                                          │
└─────────────────────────────────────────────────────┘
```

### Deployment targets

| Target | Entry point | Notes |
|---|---|---|
| Web | `index.html` | Single self-contained file, open directly in any browser |
| Chrome extension | `chrome-extension/` | Manifest V3; service worker opens a new tab with `index.html` |

The Chrome extension is a thin wrapper. All application logic lives in `app.js` / the inline `<script>` of `index.html`; the extension adds only an icon, a manifest, and a one-line tab-opener in `background.js`.

---

## Data Model

Each annotation is a plain object stored in the `drawings` array:

```js
// Shapes
{ type: 'arrow' | 'rectangle' | 'circle' | 'pen',
  x1, y1,          // start point (mousedown)
  x2, y2,          // end point (mouseup / last mousemove)
  color,            // hex string
  thickness }       // integer px

// Text
{ type: 'text',
  x1, y1,          // placement point
  text,             // raw string, may contain \n
  color,
  fontSize,         // integer px
  fontFamily,       // CSS font family string
  bold }            // boolean
```

**Key design decisions:**

- **Value semantics** — drawing objects are plain data with no methods. All rendering logic is kept in standalone functions (`drawShape`, `getDrawingBounds`). This makes serialisation, undo, and testing straightforward to add later.
- **Style captured at placement time** — color, thickness, font, and bold are copied into the drawing object when it is pushed to `drawings`, not read from UI controls at render time. This means changing the color picker after placing a shape does not retroactively change it.
- **Pen tool as line segments** — each `mousemove` during freehand drawing pushes a separate `{type:'pen', x1,y1, x2,y2}` segment. This avoids storing a variable-length points array per stroke and keeps every drawing object structurally uniform. The trade-off is a larger `drawings` array for long pen strokes.

---

## Rendering Pipeline

The renderer is a **full redraw on every frame** — no dirty-region tracking, no retained-mode scene graph.

```
redraw()
  │
  ├─ ctx.clearRect(0, 0, w, h)
  ├─ ctx.drawImage(backgroundImage, imageOffsetX, imageOffsetY)
  └─ drawings.forEach(drawing, index)
       ├─ drawShape(drawing)
       └─ if index === selectedDrawing → drawSelectionBox(drawing)
```

`redraw()` is called on every mouse event that changes visual state. For the pen tool this means one redraw per `mousemove` pixel, which is acceptable because the canvas is bounded by the original image dimensions and no compositing work is done outside the canvas.

### Coordinate system

The canvas is sized to the **original image's pixel dimensions** (`canvas.width = img.width`). CSS `max-width: 100%` scales it down to fit the viewport, so mouse coordinates must be mapped back to canvas-space:

```js
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas.height / rect.height)
    };
}
```

This ensures annotations are stored and exported at full resolution regardless of display zoom.

### Canvas expansion

When the user adds padding, the canvas is resized in-place:

```
newWidth  = canvas.width  + padding * 2
newHeight = canvas.height + padding * 2
imageOffsetX += padding
imageOffsetY += padding
drawings[*].x1 += padding  (and x2, y2 if present)
```

There is no pixel copy — the background image is re-drawn at the new offset on the next `redraw()`. This means the expansion is non-destructive and maintains full image quality.

---

## Hit Testing & Selection

Selection uses **axis-aligned bounding box (AABB) hit testing** with a 10 px padding margin:

```js
function isPointInDrawing(drawing, x, y) {
    const bounds = getDrawingBounds(drawing);
    return x >= bounds.minX - 10 && x <= bounds.maxX + 10 &&
           y >= bounds.minY - 10 && y <= bounds.maxY + 10;
}
```

`getDrawingBounds` is shape-specific:

| Shape | Bounds computation |
|---|---|
| Arrow / Rectangle | `min/max(x1,x2)`, `min/max(y1,y2)` |
| Circle | centre ± radius |
| Text | `ctx.measureText` per line to find max width; `fontSize * 1.2` line height |
| Pen segment | `min/max` of the two endpoints |

**Note on pen selection:** Each pen segment has its own independent bounding box, which means clicking anywhere near any segment of a stroke selects only that one segment — not the whole stroke. This is a known limitation of the current data model (see Trade-offs).

When iterating for a click, the `drawings` array is traversed **in reverse** so the topmost (most recently drawn) shape takes priority.

**Drag** is implemented by recording `(pos - drawing.x1)` as `dragOffset` on mousedown, then on each mousemove:

```
delta = currentPos - dragOffset - drawing.x1
drawing.x1 += delta; drawing.y1 += delta
drawing.x2 += delta; drawing.y2 += delta   // if present
```

---

## State Machine (implicit)

The application has no explicit state machine, but the interaction logic follows a clear implicit model:

```
         tool change
IDLE ──────────────────► IDLE (different tool active)
  │
  │ mousedown (draw tool)
  ▼
DRAWING ──► mousemove: preview shape
  │
  │ mouseup
  ▼
IDLE  (shape pushed to drawings[])

         mousedown (select tool, hit)
IDLE ──────────────────────────────► DRAGGING
                                        │ mouseup
                                        ▼
                                      IDLE

         mousedown (text tool)
IDLE ──────────────────────────────► TEXT_MODAL
                                        │ OK / Cancel / Escape
                                        ▼
                                      IDLE
```

The key state variables are `currentTool`, `isDrawing`, `isDragging`, and `selectedDrawing` (index or `null`).

---

## Chrome Extension Design

```
chrome-extension/
├── manifest.json      # Manifest V3 declaration
├── background.js      # Service worker
├── index.html         # Full app (CSS inline, no external deps)
└── app.js             # All application JS (extracted from inline script)
```

### Why a new tab instead of a popup

The tool needs a large canvas area. Chrome popup windows are constrained to ~800×600 px maximum. Opening a new tab gives the full browser viewport and avoids the popup's input focus quirks (clipboard paste, keyboard shortcuts).

### Icon generation

No PNG files are shipped. `background.js` draws the icon programmatically using `OffscreenCanvas` and sets it via `chrome.action.setIcon({ imageData })`. This keeps the repository clean and makes the icon trivially editable in code.

### Manifest V3 CSP constraint

MV3 extension pages disallow inline `<script>` tags. The JS is therefore extracted into `app.js`. Inline event handlers (`onclick="..."`) were also removed — replaced with `addEventListener` in `app.js`. Inline `<style>` is permitted and kept in `index.html`.

### Feature parity strategy

Both targets share identical HTML structure and CSS. The only differences between `index.html` (web) and `chrome-extension/index.html` are:

1. No inline `<script>` block — replaced by `<script src="app.js">`
2. Upload buttons use `id`-based listeners instead of inline `onclick`

All application logic is authoritatively in `index.html`'s inline script (web) and kept in sync manually with `chrome-extension/app.js`.

---

## I/O

| Operation | API used | Notes |
|---|---|---|
| Load from file | `FileReader.readAsDataURL` → `Image` | File never leaves the browser |
| Load from clipboard | `ClipboardEvent.clipboardData.items` | Paste handler on `document` |
| Export to clipboard | `canvas.toBlob` → `ClipboardItem` → `navigator.clipboard.write` | Requires HTTPS or localhost (or an extension page) |
| Export to file | `canvas.toDataURL('image/png')` → synthetic `<a>` click | No server involvement |

Image data flows: `File/Blob → DataURL → HTMLImageElement → Canvas`. Quality is preserved end-to-end because the canvas dimensions match the source image.

---

## Known Limitations & Trade-offs

| Area | Current behaviour | Alternative |
|---|---|---|
| **Undo** | Not supported | Could be added cheaply: snapshot `drawings` array before each mutation |
| **Pen stroke grouping** | Each mousemove segment is a separate drawing object | Group segments into a `{type:'stroke', points:[]}` object for better selection and move semantics |
| **Hit testing** | AABB only — imprecise for diagonal arrows or thin shapes | Per-pixel hit testing via `ctx.isPointInPath`, or distance-to-line math |
| **Pen AABB** | A single segment's bounding box is just two points — extremely small hit target | Bounding box should be computed across all segments of a stroke |
| **Persistence** | State lost on page refresh | `localStorage` or `IndexedDB` for session recovery |
| **Text bounds** | Top edge uses `y1 - fontSize` (ascender approximation) | Use `ctx.measureText` `actualBoundingBoxAscent` for pixel-accurate bounds |
| **Concurrency** | Single-user, no sync | N/A for the current scope |
| **Mobile** | Mouse events only; no touch support | Add `touchstart/touchmove/touchend` handlers mapping to equivalent mouse logic |
