# Quick Markup

A lightweight, browser-based image annotation tool. No installation, no sign-up — open it and start marking up images instantly.

## Features

| Feature | Details |
|---|---|
| **Drawing tools** | Arrow, Rectangle, Circle, Freehand pen, Text |
| **Select & move** | Click any markup to select it, drag to reposition, Delete/Backspace to remove |
| **Appearance** | Per-markup color picker and line thickness (1–20 px) |
| **Text styling** | Font family, font size, bold toggle |
| **Font preview** | Live "Aa" badge and per-option font rendering in the dropdown |
| **Canvas expand** | Add padding around the image for extra annotation space |
| **Export** | Copy to clipboard or download as PNG |
| **Chrome extension** | Install once, open from the toolbar in any Chrome window |

---

## Web Version

Open `index.html` directly in any modern browser — no server required.

---

## Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** and select the `chrome-extension/` folder
4. The Quick Markup icon appears in the Chrome toolbar — click it to open the tool in a new tab

---

## Usage

### Loading an image
- Click **Upload Image** (or **Choose Image** on the start screen)
- Or paste an image from your clipboard with **Ctrl/Cmd + V**

### Drawing tools

| Button | Tool | How to use |
|---|---|---|
| 👆 | Select | Click a markup to select it; drag to move; Delete/Backspace to delete |
| ➜ | Arrow | Click and drag to draw a directional arrow |
| ▭ | Rectangle | Click and drag to draw a rectangle |
| ○ | Circle | Click the center point and drag to set the radius |
| T | Text | Click where you want the text; type in the modal; Enter to place |
| ✏️ | Pen | Click and drag for freehand drawing |

### Text tool details
- **Shift + Enter** — new line inside the text modal
- **Enter** — confirm and place text
- **Escape** — cancel
- The modal is draggable by its title bar
- Set font, size, and bold **before** clicking to place text — each annotation captures the style at the time it is placed

### Appearance controls
- **Color picker** — sets the color for the next markup drawn
- **Line slider / number input** — sets stroke thickness (synced)
- **Font family** — dropdown with live preview; each option is rendered in its own font
- **B (bold)** — toggle bold for text; dark background = bold is on
- **Font size** — size in pixels for the next text annotation

### Canvas
- **Expand** — adds padding (default 100 px) around the entire canvas; existing markups shift accordingly

### Export
- **Copy** — writes the marked-up image to the clipboard as PNG (button turns green briefly to confirm)
- **Download** — saves `marked-up-image.png` to your downloads

### Clearing work
- **Clear** — removes all markups, keeps the image
- **Reset** — removes the image and all markups, returns to the start screen
