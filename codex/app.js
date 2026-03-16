const HISTORY_LIMIT = 50;

const elements = {
  fileInput: document.getElementById("fileInput"),
  pasteButton: document.getElementById("pasteButton"),
  imageMeta: document.getElementById("imageMeta"),
  statusText: document.getElementById("statusText"),
  canvas: document.getElementById("editorCanvas"),
  canvasStage: document.getElementById("canvasStage"),
  canvasScroller: document.getElementById("canvasScroller"),
  emptyState: document.getElementById("emptyState"),
  toolButtons: Array.from(document.querySelectorAll(".tool-button")),
  colorInput: document.getElementById("colorInput"),
  strokeInput: document.getElementById("strokeInput"),
  strokeValue: document.getElementById("strokeValue"),
  fontSizeInput: document.getElementById("fontSizeInput"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  fontFamilySelect: document.getElementById("fontFamilySelect"),
  deleteButton: document.getElementById("deleteButton"),
  undoButton: document.getElementById("undoButton"),
  copyButton: document.getElementById("copyButton"),
  downloadButton: document.getElementById("downloadButton"),
  resetButton: document.getElementById("resetButton"),
  paddingTop: document.getElementById("paddingTop"),
  paddingRight: document.getElementById("paddingRight"),
  paddingBottom: document.getElementById("paddingBottom"),
  paddingLeft: document.getElementById("paddingLeft"),
  applyPaddingButton: document.getElementById("applyPaddingButton"),
  themeToggle: document.getElementById("themeToggle"),
  textEditor: document.getElementById("textEditor"),
  textInput: document.getElementById("textInput"),
  saveTextButton: document.getElementById("saveTextButton"),
  cancelTextButton: document.getElementById("cancelTextButton"),
  confirmModal: document.getElementById("confirmModal"),
  confirmResetButton: document.getElementById("confirmResetButton"),
  cancelResetButton: document.getElementById("cancelResetButton")
};

const context = elements.canvas.getContext("2d");

const state = {
  image: null,
  imageSrc: "",
  imageWidth: 0,
  imageHeight: 0,
  displayScale: 1,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  objects: [],
  selectedId: null,
  tool: "select",
  draft: null,
  dragOffset: null,
  dragSnapshot: null,
  dragMoved: false,
  pointerDown: false,
  history: [],
  textPoint: null,
  theme: "light",
  style: {
    color: "#ff5a36",
    strokeWidth: 4,
    fontSize: 28,
    fontFamily: "Arial, sans-serif"
  }
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneSnapshot() {
  return JSON.parse(JSON.stringify({
    imageSrc: state.imageSrc,
    imageWidth: state.imageWidth,
    imageHeight: state.imageHeight,
    padding: state.padding,
    objects: state.objects
  }));
}

function pushHistory() {
  if (!state.imageSrc) {
    return;
  }

  const snapshot = cloneSnapshot();
  const lastSnapshot = state.history.at(-1);
  if (lastSnapshot && JSON.stringify(lastSnapshot) === JSON.stringify(snapshot)) {
    return;
  }

  state.history.push(snapshot);
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }
  updateActionState();
}

async function restoreSnapshot(snapshot) {
  state.imageSrc = snapshot.imageSrc;
  state.imageWidth = snapshot.imageWidth;
  state.imageHeight = snapshot.imageHeight;
  state.padding = snapshot.padding;
  state.objects = snapshot.objects;
  state.selectedId = null;
  syncPaddingInputs();
  if (state.imageSrc) {
    state.image = await loadImage(state.imageSrc);
  } else {
    state.image = null;
  }
  refreshLayout();
}

async function undo() {
  if (!state.history.length) {
    return;
  }
  const snapshot = state.history.pop();
  await restoreSnapshot(snapshot);
  updateStatus("Undid the last change.");
}

function syncPaddingInputs() {
  elements.paddingTop.value = state.padding.top;
  elements.paddingRight.value = state.padding.right;
  elements.paddingBottom.value = state.padding.bottom;
  elements.paddingLeft.value = state.padding.left;
}

function updateStatus(message) {
  elements.statusText.textContent = message;
}

function updateActionState() {
  const hasImage = Boolean(state.image);
  const hasSelection = Boolean(findSelectedObject());
  elements.undoButton.disabled = state.history.length === 0;
  elements.deleteButton.disabled = !hasSelection;
  elements.copyButton.disabled = !hasImage;
  elements.downloadButton.disabled = !hasImage;
  elements.resetButton.disabled = !hasImage;
}

function setTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

function initializeTheme() {
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(preferred);
}

function setTool(tool) {
  state.tool = tool;
  for (const button of elements.toolButtons) {
    button.classList.toggle("active", button.dataset.tool === tool);
  }
  elements.canvas.style.cursor = tool === "select" ? "default" : "crosshair";
  if (tool !== "text") {
    closeTextEditor();
  }
  updateStatus(tool === "select" ? "Select an existing markup to move or delete it." : `Using the ${tool} tool.`);
}

function getCanvasSize() {
  return {
    width: state.imageWidth + state.padding.left + state.padding.right,
    height: state.imageHeight + state.padding.top + state.padding.bottom
  };
}

function updateDisplayScale(canvasWidth, canvasHeight) {
  const scrollerStyles = window.getComputedStyle(elements.canvasScroller);
  const stageStyles = window.getComputedStyle(elements.canvasStage);
  const scrollerPaddingX = (parseFloat(scrollerStyles.paddingLeft) || 0) + (parseFloat(scrollerStyles.paddingRight) || 0);
  const scrollerPaddingY = (parseFloat(scrollerStyles.paddingTop) || 0) + (parseFloat(scrollerStyles.paddingBottom) || 0);
  const stagePaddingX = (parseFloat(stageStyles.paddingLeft) || 0) + (parseFloat(stageStyles.paddingRight) || 0);
  const stagePaddingY = (parseFloat(stageStyles.paddingTop) || 0) + (parseFloat(stageStyles.paddingBottom) || 0);
  const availableWidth = Math.max(320, elements.canvasScroller.clientWidth - scrollerPaddingX - stagePaddingX);
  const availableHeight = Math.max(240, elements.canvasScroller.clientHeight - scrollerPaddingY - stagePaddingY);
  state.displayScale = Math.min(1, availableWidth / canvasWidth, availableHeight / canvasHeight);
}

function getImageBounds() {
  return {
    x: state.padding.left,
    y: state.padding.top,
    width: state.imageWidth,
    height: state.imageHeight
  };
}

function refreshLayout() {
  const hasImage = Boolean(state.image);
  elements.emptyState.classList.toggle("hidden", hasImage);
  elements.canvasScroller.classList.toggle("hidden", !hasImage);

  if (!hasImage) {
    updateActionState();
    return;
  }

  const { width, height } = getCanvasSize();
  updateDisplayScale(width, height);
  elements.canvas.width = width;
  elements.canvas.height = height;
  elements.canvas.style.width = `${Math.max(1, Math.round(width * state.displayScale))}px`;
  elements.canvas.style.height = `${Math.max(1, Math.round(height * state.displayScale))}px`;
  render();
  elements.imageMeta.textContent = `${state.imageWidth} × ${state.imageHeight}px`;
  updateActionState();
}

function render() {
  context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

  if (!state.image) {
    return;
  }

  const imageBounds = getImageBounds();
  context.drawImage(state.image, imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height);

  for (const object of state.objects) {
    drawObject(context, object, object.id === state.selectedId);
  }

  if (state.draft) {
    drawObject(context, state.draft, false, true);
  }
}

function drawObject(ctx, object, isSelected, isDraft = false) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = object.color;
  ctx.fillStyle = object.color;
  ctx.lineWidth = object.strokeWidth;
  ctx.globalAlpha = isDraft ? 0.72 : 1;

  if (object.type === "rect") {
    const { x, y, width, height } = normalizeRect(object);
    ctx.strokeRect(x, y, width, height);
  } else if (object.type === "ellipse") {
    const { x, y, width, height } = normalizeRect(object);
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (object.type === "line") {
    ctx.beginPath();
    ctx.moveTo(object.x1, object.y1);
    ctx.lineTo(object.x2, object.y2);
    ctx.stroke();
  } else if (object.type === "arrow") {
    drawArrow(ctx, object);
  } else if (object.type === "text") {
    drawText(ctx, object);
  }

  if (isSelected) {
    drawSelectionOutline(ctx, object);
  }

  ctx.restore();
}

function normalizeRect(object) {
  const x = Math.min(object.x1, object.x2);
  const y = Math.min(object.y1, object.y2);
  const width = Math.abs(object.x2 - object.x1);
  const height = Math.abs(object.y2 - object.y1);
  return { x, y, width, height };
}

function drawArrow(ctx, object) {
  const headLength = Math.max(12, object.strokeWidth * 4);
  const angle = Math.atan2(object.y2 - object.y1, object.x2 - object.x1);

  ctx.beginPath();
  ctx.moveTo(object.x1, object.y1);
  ctx.lineTo(object.x2, object.y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(object.x2, object.y2);
  ctx.lineTo(
    object.x2 - headLength * Math.cos(angle - Math.PI / 6),
    object.y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    object.x2 - headLength * Math.cos(angle + Math.PI / 6),
    object.y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawText(ctx, object) {
  ctx.font = `${object.fontSize}px ${object.fontFamily}`;
  ctx.textBaseline = "top";
  const lines = object.text.split("\n");
  const lineHeight = object.fontSize * 1.24;
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], object.x, object.y + index * lineHeight);
  }
}

function getTextMetrics(object) {
  const measureContext = context;
  measureContext.save();
  measureContext.font = `${object.fontSize}px ${object.fontFamily}`;
  const lines = object.text.split("\n");
  const width = Math.max(...lines.map((line) => measureContext.measureText(line || " ").width), 1);
  const height = lines.length * object.fontSize * 1.24;
  measureContext.restore();
  return { width, height };
}

function getObjectBounds(object) {
  if (object.type === "rect" || object.type === "ellipse") {
    return normalizeRect(object);
  }

  if (object.type === "line" || object.type === "arrow") {
    const padding = Math.max(10, object.strokeWidth * 2);
    const x = Math.min(object.x1, object.x2) - padding;
    const y = Math.min(object.y1, object.y2) - padding;
    const width = Math.abs(object.x2 - object.x1) + padding * 2;
    const height = Math.abs(object.y2 - object.y1) + padding * 2;
    return { x, y, width, height };
  }

  if (object.type === "text") {
    const metrics = getTextMetrics(object);
    return { x: object.x - 6, y: object.y - 4, width: metrics.width + 12, height: metrics.height + 8 };
  }

  return { x: 0, y: 0, width: 0, height: 0 };
}

function drawSelectionOutline(ctx, object) {
  const bounds = getObjectBounds(object);
  ctx.save();
  ctx.strokeStyle = "#3d8bff";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function importImage(file) {
  const dataUrl = typeof file === "string" ? file : await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  closeTextEditor();
  state.image = image;
  state.imageSrc = dataUrl;
  state.imageWidth = image.naturalWidth;
  state.imageHeight = image.naturalHeight;
  state.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  state.objects = [];
  state.selectedId = null;
  state.history = [];
  state.draft = null;
  syncPaddingInputs();
  refreshLayout();
  updateStatus("Image loaded. Pick a tool and start annotating.");
}

function findSelectedObject() {
  return state.objects.find((object) => object.id === state.selectedId) || null;
}

function getPointerPosition(event) {
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = elements.canvas.width / rect.width;
  const scaleY = elements.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function createShape(start, end) {
  return {
    id: generateId(),
    type: state.tool,
    color: state.style.color,
    strokeWidth: state.style.strokeWidth,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y
  };
}

function hitTest(point) {
  for (let index = state.objects.length - 1; index >= 0; index -= 1) {
    const object = state.objects[index];
    const bounds = getObjectBounds(object);
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      return object;
    }
  }
  return null;
}

function moveObject(object, dx, dy) {
  if (object.type === "text") {
    object.x += dx;
    object.y += dy;
    return;
  }

  object.x1 += dx;
  object.y1 += dy;
  object.x2 += dx;
  object.y2 += dy;
}

function openTextEditor(point) {
  state.textPoint = point;
  elements.textInput.value = "";
  elements.textEditor.classList.remove("hidden");
  elements.textInput.focus();
  updateStatus("Enter multiline text, then save it to the canvas.");
}

function closeTextEditor() {
  elements.textEditor.classList.add("hidden");
  state.textPoint = null;
}

function commitText() {
  const text = elements.textInput.value.trim();
  if (!text || !state.textPoint) {
    closeTextEditor();
    return;
  }

  pushHistory();
  state.objects.push({
    id: generateId(),
    type: "text",
    color: state.style.color,
    strokeWidth: state.style.strokeWidth,
    fontSize: state.style.fontSize,
    fontFamily: state.style.fontFamily,
    text,
    x: state.textPoint.x,
    y: state.textPoint.y
  });
  state.selectedId = state.objects.at(-1).id;
  closeTextEditor();
  render();
  updateActionState();
  updateStatus("Text added.");
}

function applyStyleToSelection() {
  const selected = findSelectedObject();
  if (!selected) {
    render();
    return;
  }

  const needsUpdate =
    selected.color !== state.style.color ||
    selected.strokeWidth !== state.style.strokeWidth ||
    (selected.type === "text" &&
      (selected.fontSize !== state.style.fontSize || selected.fontFamily !== state.style.fontFamily));

  if (!needsUpdate) {
    return;
  }

  pushHistory();
  selected.color = state.style.color;
  selected.strokeWidth = state.style.strokeWidth;
  if (selected.type === "text") {
    selected.fontSize = state.style.fontSize;
    selected.fontFamily = state.style.fontFamily;
  }
  render();
}

function deleteSelection() {
  const index = state.objects.findIndex((object) => object.id === state.selectedId);
  if (index === -1) {
    return;
  }
  pushHistory();
  state.objects.splice(index, 1);
  state.selectedId = null;
  render();
  updateActionState();
  updateStatus("Deleted the selected markup.");
}

function applyPadding() {
  if (!state.image) {
    return;
  }

  const nextPadding = {
    top: Math.max(0, Number(elements.paddingTop.value) || 0),
    right: Math.max(0, Number(elements.paddingRight.value) || 0),
    bottom: Math.max(0, Number(elements.paddingBottom.value) || 0),
    left: Math.max(0, Number(elements.paddingLeft.value) || 0)
  };

  const deltaX = nextPadding.left - state.padding.left;
  const deltaY = nextPadding.top - state.padding.top;
  if (deltaX !== 0 || deltaY !== 0 || JSON.stringify(nextPadding) !== JSON.stringify(state.padding)) {
    pushHistory();
    for (const object of state.objects) {
      moveObject(object, deltaX, deltaY);
    }
    state.padding = nextPadding;
    refreshLayout();
    updateStatus("Padding applied. You can annotate in the expanded area now.");
  }
}

async function exportBlob() {
  const { width, height } = getCanvasSize();
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportContext = exportCanvas.getContext("2d");
  exportContext.clearRect(0, 0, width, height);
  const imageBounds = getImageBounds();
  exportContext.drawImage(state.image, imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height);
  for (const object of state.objects) {
    drawObject(exportContext, object, false);
  }
  return await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png"));
}

async function copyToClipboard() {
  if (!state.image) {
    return;
  }
  const blob = await exportBlob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  updateStatus("Copied the annotated image to the clipboard.");
}

async function downloadImage() {
  if (!state.image) {
    return;
  }
  const blob = await exportBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quick-image-markup.png";
  link.click();
  URL.revokeObjectURL(url);
  updateStatus("Downloaded the annotated image.");
}

function openResetModal() {
  elements.confirmModal.classList.remove("hidden");
}

function closeResetModal() {
  elements.confirmModal.classList.add("hidden");
}

function resetEditor() {
  closeTextEditor();
  state.image = null;
  state.imageSrc = "";
  state.imageWidth = 0;
  state.imageHeight = 0;
  state.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  state.objects = [];
  state.selectedId = null;
  state.history = [];
  state.draft = null;
  state.dragOffset = null;
  state.dragSnapshot = null;
  state.dragMoved = false;
  state.pointerDown = false;
  syncPaddingInputs();
  elements.fileInput.value = "";
  elements.imageMeta.textContent = "No image loaded";
  closeResetModal();
  refreshLayout();
  updateStatus("Editor reset. Upload or paste a new image to start again.");
}

function syncSelectedStyleUI() {
  const selected = findSelectedObject();
  if (!selected) {
    return;
  }
  elements.colorInput.value = selected.color;
  elements.strokeInput.value = selected.strokeWidth;
  elements.strokeValue.textContent = `${selected.strokeWidth} px`;
  if (selected.type === "text") {
    elements.fontSizeInput.value = selected.fontSize;
    elements.fontSizeValue.textContent = `${selected.fontSize} px`;
    elements.fontFamilySelect.value = selected.fontFamily;
  }
}

function isEditableTarget(target) {
  return Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
}

function handlePointerDown(event) {
  if (!state.image || elements.textEditor.classList.contains("hidden") === false) {
    return;
  }

  const point = getPointerPosition(event);
  state.pointerDown = true;

  if (state.tool === "text") {
    openTextEditor(point);
    return;
  }

  if (state.tool === "select") {
    const hit = hitTest(point);
    state.selectedId = hit ? hit.id : null;
    if (hit) {
      const bounds = getObjectBounds(hit);
      state.dragOffset = { x: point.x - bounds.x, y: point.y - bounds.y, start: point };
      state.dragSnapshot = cloneSnapshot();
      state.dragMoved = false;
      syncSelectedStyleUI();
      updateStatus("Drag the selected markup to reposition it.");
    } else {
      state.dragSnapshot = null;
      state.dragMoved = false;
      updateStatus("Select an existing markup to move or delete it.");
    }
    render();
    updateActionState();
    return;
  }

  state.draft = createShape(point, point);
  render();
}

function handlePointerMove(event) {
  if (!state.image || !state.pointerDown) {
    return;
  }

  const point = getPointerPosition(event);
  if (state.tool === "select") {
    const selected = findSelectedObject();
    if (selected && state.dragOffset) {
      const dx = point.x - state.dragOffset.start.x;
      const dy = point.y - state.dragOffset.start.y;
      state.dragOffset.start = point;
      if (dx !== 0 || dy !== 0) {
        moveObject(selected, dx, dy);
        state.dragMoved = true;
        render();
      }
    }
    return;
  }

  if (state.draft) {
    state.draft.x2 = point.x;
    state.draft.y2 = point.y;
    render();
  }
}

function handlePointerUp() {
  if (!state.image) {
    return;
  }

  if (state.tool === "select") {
    if (state.dragMoved && state.dragSnapshot) {
      state.history.push(state.dragSnapshot);
      if (state.history.length > HISTORY_LIMIT) {
        state.history.shift();
      }
      updateStatus("Moved the selected markup.");
    }
    state.dragOffset = null;
    state.dragSnapshot = null;
    state.dragMoved = false;
    state.pointerDown = false;
    updateActionState();
    return;
  }

  if (state.draft) {
    const draftBounds = getObjectBounds(state.draft);
    if (draftBounds.width > 2 || draftBounds.height > 2) {
      pushHistory();
      state.objects.push(state.draft);
      state.selectedId = state.draft.id;
      updateStatus("Markup added.");
    }
    state.draft = null;
    render();
    updateActionState();
  }

  state.pointerDown = false;
}

async function handlePaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) {
    return;
  }
  event.preventDefault();
  const file = imageItem.getAsFile();
  if (file) {
    await importImage(file);
  }
}

async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
    if (!imageItem) {
      updateStatus("Clipboard does not contain an image.");
      return;
    }
    const imageType = imageItem.types.find((type) => type.startsWith("image/"));
    const blob = await imageItem.getType(imageType);
    await importImage(await readFileAsDataUrl(blob));
  } catch (error) {
    updateStatus("Clipboard paste was blocked. Click the page and try Ctrl/Cmd+V.");
  }
}

elements.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (file) {
    await importImage(file);
  }
});

elements.pasteButton.addEventListener("click", pasteFromClipboard);
elements.toolButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

elements.colorInput.addEventListener("input", () => {
  state.style.color = elements.colorInput.value;
  applyStyleToSelection();
});

elements.strokeInput.addEventListener("input", () => {
  state.style.strokeWidth = Number(elements.strokeInput.value);
  elements.strokeValue.textContent = `${state.style.strokeWidth} px`;
  applyStyleToSelection();
});

elements.fontSizeInput.addEventListener("input", () => {
  state.style.fontSize = Number(elements.fontSizeInput.value);
  elements.fontSizeValue.textContent = `${state.style.fontSize} px`;
  applyStyleToSelection();
});

elements.fontFamilySelect.addEventListener("change", () => {
  state.style.fontFamily = elements.fontFamilySelect.value;
  applyStyleToSelection();
});

elements.deleteButton.addEventListener("click", deleteSelection);
elements.undoButton.addEventListener("click", undo);
elements.copyButton.addEventListener("click", async () => {
  try {
    await copyToClipboard();
  } catch (error) {
    updateStatus("Copy failed. Chrome may require clipboard access for this action.");
  }
});
elements.downloadButton.addEventListener("click", downloadImage);
elements.resetButton.addEventListener("click", openResetModal);
elements.cancelResetButton.addEventListener("click", closeResetModal);
elements.confirmResetButton.addEventListener("click", resetEditor);
elements.applyPaddingButton.addEventListener("click", applyPadding);
elements.themeToggle.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
});
elements.saveTextButton.addEventListener("click", commitText);
elements.cancelTextButton.addEventListener("click", closeTextEditor);

elements.canvas.addEventListener("pointerdown", handlePointerDown);
elements.canvas.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("paste", handlePaste);
window.addEventListener("keydown", async (event) => {
  if (isEditableTarget(event.target) && event.key !== "Escape") {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    await undo();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelection();
  }

  if (event.key === "Escape") {
    closeTextEditor();
    closeResetModal();
    state.draft = null;
    render();
  }
});

initializeTheme();
syncPaddingInputs();
updateActionState();
window.addEventListener("resize", refreshLayout);
