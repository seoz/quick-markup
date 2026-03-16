# System Design: Quick Image Markup

This document outlines the system architecture and design choices for the **Quick Image Markup** extension and web application. It is intended for senior engineers and system design reviewers to understand the core mechanics, state management, and rendering pipelines of the application.

## 1. High-Level Architecture

The application is built entirely as a client-side Single Page Application (SPA), requiring no backend (besides static file hosting). 

**Tech Stack:**
- **UI/Structure:** Vanilla HTML5, CSS3.
- **Logic:** Vanilla JavaScript (ES6+).
- **Rendering Engine:** [Fabric.js](http://fabricjs.com/) (v5). Fabric provides an object model on top of the native HTML5 `<canvas>`, making it significantly easier to handle interactivity, selection, z-indexing, and modification of geometric objects.
- **Environment Context:** Runs as a standard web application OR a Google Chrome Extension V3 (using `manifest.json` and a minimal `background.js` service worker).

## 2. Core Components

### 2.1 File & Image Ingestion Pipeline
The application supports multiple entry points for an image:
- **Drag & Drop:** Handled by standard HTML5 Drag and Drop API (`dragover`, `dragleave`, `drop`) on the initial drop-zone.
- **File Input & Browse:** Standard `<input type="file">`.
- **Clipboard Paste:** A global `window.addEventListener('paste')` parses `clipboardData` to extract the file blob.

**Processing:**
Files are read via `FileReader` using `readAsDataURL()`. The resulting base64 URI is then fed to `fabric.Image.fromURL()`. The image is locked as the **background image** of the canvas, preventing users from accidentally selecting or moving the source image.

### 2.2 Fabric.js Canvas Wrapper
The `setupCanvasForImage` function orchestrates the canvas bounding boxes.
- Responsive scaling is achieved by calculating the ratio between the browser window available space and the original image size (`currentScale = Math.min(...)`).
- The canvas visual dimensions (`width`, `height`) are set to the scaled values, and `canvas.setZoom(currentScale)` is applied.
- This ensures the user interacts with a perfectly sized preview, but all internal Fabric.js coordinates (and resulting exports) remain at a 1:1 ratio relative to the origin image.

### 2.3 The Tool State Machine
The application acts as a shallow state machine driven by the `currentTool` variable (`select`, `draw`, `arrow`, `rect`, `circle`, `text`).
- Changing the tool loops through all canvas objects updating their `selectable` and `evented` properties.
- **Free Drawing (`draw`)**: Delegates completely to `canvas.isDrawingMode = true`.
- **Parametric Shapes (`rect`, `circle`, `arrow`)**: Relies on a three-phase manual tracking process overriding Fabric's default drag behaviors:
  1. `onMouseDown`: Records `startX`, `startY`, instantiates a shadow shape with `0` width/height/radius, and adds it to the canvas.
  2. `onMouseMove`: Updates the shadow shape's dimensions mathematically (e.g. Euclidean distance for circles `sqrt(dx^2 + dy^2)`).
  3. `onMouseUp`: Finalizes the shape, calculates coordinates, and resets the mouse state.

### 2.4 Mathematical Rendering Details
**The Arrow Implementation:**
Drawing an arrow introduces complex bounding box logic. Fabric.js naturally offsets elements within a `Group` by computing a unified bounding rectangle. Because diagonal lines have varying height/width ratios, their offset within a group fluctuates unpredictably.
- **Solution:** We instantiate the line segment explicitly calculating the midpoint: `left: (start + end) / 2`, `top: (start + end) / 2`, and setting `originX/Y: 'center'`. We then apply trigonometric functions (`Math.atan2`) to position the triangle (arrowhead) at the exact end-point and apply rotation (`angle: angle + 90`). 
- Finally, these are combined into a rigid `fabric.Group` preventing internal offsets.

## 3. State Management & "Undo"

Because Fabric.js objects are stateful and inherently mutable, implementing "Undo" cannot rely solely on DOM state.

- **Storage:** Handled via a Last-In-First-Out (LIFO) array stack (`undoStack`). It maintains a strict garbage collected limit (`undoStack.length >= 50` drops the oldest frame).
- **Capture Mechanism (`saveHistory`)**: Every significant canvas mutation event (`path:created`, `object:modified`, `text:changed`, scaling padding) triggers a state capture.
- **Serialization**: Fabric's native `canvas.getObjects().map(o => o.toObject())` is used to dump a JSON-serializable representation of every object.
- **Deserialization (`undo`)**: The stack is popped, the canvas is wiped (`canvas.remove(...)`), and `fabric.util.enlivenObjects()` asynchronously rebuilds and injects the preserved objects back onto the canvas.

## 4. Export & Output Pipeline

When exporting back to the user, we must undo the responsive scaling applied to the UI to retrieve the high-fidelity original result.

- **Extraction**: We use `canvas.toDataURL`. 
- **Resolution Override**: A custom multiplier parameter (`multiplier: 1 / currentScale`) is injected. This mathematically reverses the `canvas.setZoom()` call, forcing the buffer to render at 100% original pixel density.
- **Clipboard Output**: The base64 output is `fetch`ed and transformed into a `Blob`. The modern `navigator.clipboard.write` API is used to push an `image/png` payload directly into the OS clipboard.

## 5. Styling & Theming Architecture

The UI is built utilizing Vanilla CSS leveraging CSS Variable (`:root { ... }`) tokenization.
- **Theme support:** All graphical properties (backgrounds, surfaces, borders, text colors) are strictly bound to variables (`--bg-dark`, `--panel-bg`, `--text-main`). Implementing dynamic Light/Dark mode transitions relies purely on swapping these variables dynamically inside the DOM.
- **Layout:** Standard CSS Grid (`grid-template-columns`) handles fixed toolbars and action arrays, while Flexbox handles inner alignments and centering.

## 6. Resilience and UX Protections
- **Event Locks:** Editing text flags an object state (`activeObj.isEditing`). The global keyboard listeners for `Delete/Backspace` check this flag to prevent accidental deletion of a text node while the user is inside an input field typing.
- **Action Confirmation:** Irreversible actions (Reset/Delete All) are gated behind a custom Vanilla JS modal (`showConfirmDialog`), capturing callback actions via a `pendingConfirmAction` reference payload that gets invoked only when the user accepts.
