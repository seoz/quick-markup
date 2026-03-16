# Quick Markup

A lightweight, browser-based image annotation tool. No installation, no sign-up — open it and start marking up images instantly.

This repository contains two independently developed versions of the tool:

| Version | Directory | Renderer |
|---|---|---|
| **claude** | `claude/` | HTML5 Canvas 2D, vanilla JS, no dependencies |
| **antigravity** | `antigravity/` | Fabric.js canvas library |

---

## Versions

### claude (`claude/`)

Pure vanilla HTML/CSS/JS with no external dependencies. Available as both a standalone web page and a Chrome extension.

**Features:**
- Arrow, Rectangle, Circle, Freehand pen, Text tools
- Select, drag, and delete individual markups
- Per-markup color picker and line thickness (1–20 px)
- Font family with live preview, font size, bold toggle
- Canvas expand — add padding around the image
- Undo (Ctrl/Cmd+Z or Undo button, up to 50 history states)
- Copy to clipboard or download as PNG
- Chrome extension (Manifest V3)

**Versions:** `manifest.json` reports `1.0.0`

---

### antigravity (`antigravity/`)

Built on [Fabric.js](http://fabricjs.com/) for object-based canvas management. Chrome extension only.

**Features (superset of claude):**
- Arrow, Rectangle, Circle, Freehand pen, Text tools
- Undo (Ctrl/Cmd+Z or Undo button, capped at 50 history states)
- Expanded color palette with modernized color picker
- Bold font toggle for text annotations
- Font family selector with per-option live preview
- Confirmation modal for destructive actions (Clear, Reset)
- Custom icon drawn programmatically

**Version:** `manifest.json` reports `1.0`

---

## Installation

### Web version (claude only)

Open `claude/index.html` directly in any modern browser — no server required.

### Chrome extension

Both versions ship as a Chrome extension.

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** and select the extension folder:
   - `claude/chrome-extension/` for the claude version
   - `antigravity/` for the antigravity version
4. The icon appears in the Chrome toolbar — click it to open the tool in a new tab

---

## Usage

### Loading an image
- Click **Upload Image** to load from disk
- Paste from clipboard with **Ctrl/Cmd + V**

### Drawing tools

| Tool | How to use |
|---|---|
| Select | Click a markup to select it; drag to move; Delete/Backspace to remove |
| Arrow | Click and drag to draw a directional arrow |
| Rectangle | Click and drag to draw a rectangle |
| Circle | Click the center and drag to set the radius |
| Text | Click to place; type in the modal; Enter to confirm |
| Pen | Click and drag for freehand drawing |

### Text tool
- **Shift + Enter** — new line inside the text modal
- **Enter** — confirm and place
- **Escape** — cancel

### Export
- **Copy** — writes the annotated image to the clipboard as PNG
- **Download** — saves `marked-up-image.png` to your downloads

### Clearing work
- **Undo** — step back one action (Ctrl/Cmd+Z)
- **Clear** — remove all markups, keep the image
- **Reset** — remove image and all markups, return to start screen
