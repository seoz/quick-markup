# Quick Image Markup

A modern Chrome extension and web service that allows users to quickly add markups (arrows, rectangles, circles, text, freehand) over images. It's built to maintain image quality while offering an intuitive and visually appealing interface.

## Main Features

- **Upload & Paste Support:** Easily upload an image from a file or paste directly from the clipboard.
- **Rich Annotation Tools:**
  - **Arrows**: Point out specific details with aligned arrows.
  - **Rectangles & Circles**: Highlight areas of interest.
  - **Freehand Drawing**: Draw custom shapes with an adjustable brush thickness (default 10px).
  - **Multiline Text**: Add descriptive text with customizable fonts.
- **Color & Style Customization:** Pick from an expanded, diverse color palette and adjust markup thickness to your liking.
- **Flexible Canvas:** Need more room to draw? Expand the canvas easily.
- **Undo & History:** Integrated undo features (via Ctrl/Cmd+Z or UI button) keeping up to 50 states of history.
- **Save & Share:** Copy the final marked-up image straight to the clipboard or download it to your device preserving original quality.
- **Dark & Light Mode UI:** Built-in theme switcher for better accessibility and user preference.
- **Editing Actions:** Move, resize, and delete individual markups, or safely reset the canvas (includes a confirmation popup for destructive actions).

## How to Use

### Installation as a Chrome Extension

Since it is currently in development, you can load it locally:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top-right corner.
4. Click on **"Load unpacked"** and select the directory where this extension is located (`antigravity` folder).
5. The **Quick Image Markup** icon will appear in your Chrome toolbar. Click it to start your markup!

### Running as a Local Web App

You can also run this locally as a standard web application:

1. Navigate to the project directory in your terminal.
2. Serve the directory using any local web server. For instance using Node.js:
   ```bash
   npx serve ./ -p 3000
   ```
3. Open `http://localhost:3000` in your browser.

### Usage Guide

1. **Load an Image:** Start by clicking "Upload Image" or simply paste an image (`Ctrl+V` / `Cmd+V`) directly into the window.
2. **Select a Tool:** Use the toolbar to choose between Text, Draw, Arrow, Rectangle, or Circle.
3. **Customize Attributes:** Change the color, thickness, and font using the provided UI controls.
4. **Annotate the Image:** Click and drag on the image to place shapes. For text, click where you want the text to appear.
5. **Undo Mistakes:** Click the Undo button or use `Ctrl+Z` / `Cmd+Z` to revert your last action.
6. **Select and Edit:** Click the Pointer tool to select previously drawn markups. You can move, resize, or delete them (Backspace / Delete key).
7. **Export:** Once done, click **Copy to Clipboard** to paste it effortlessly into your chat or email, or click **Download** to save the file.

## Technologies

- HTML, CSS (Vanilla), JavaScript
- [Fabric.js](http://fabricjs.com/) for robust canvas manipulation and drawing capabilities.
