const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const colorPicker = document.getElementById('colorPicker');
const thicknessSlider = document.getElementById('thicknessSlider');
const thicknessValue = document.getElementById('thicknessValue');
const fontSizeInput = document.getElementById('fontSize');
const fontFamilySelect = document.getElementById('fontFamily');
const fontPreview = document.getElementById('fontPreview');

// Font preview
fontFamilySelect.addEventListener('change', () => {
    fontPreview.style.fontFamily = fontFamilySelect.value;
});

let currentTool = 'select';
let isDrawing = false;
let startX, startY;
let backgroundImage = null;
let drawings = [];
let currentDrawing = null;
let selectedDrawing = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let imageOffsetX = 0;
let imageOffsetY = 0;

// Upload buttons (formerly inline onclick handlers)
document.getElementById('uploadImageBtn').addEventListener('click', () => {
    fileInput.click();
});
document.getElementById('chooseImageBtn').addEventListener('click', () => {
    fileInput.click();
});

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTool = e.target.dataset.tool;
        selectedDrawing = null;

        // Update cursor
        if (currentTool === 'select') {
            canvas.classList.add('select-mode');
        } else {
            canvas.classList.remove('select-mode');
        }

        redraw();
    });
});

// Set default tool
document.getElementById('tool-select').classList.add('active');
canvas.classList.add('select-mode');

// Sync thickness slider and input
thicknessSlider.addEventListener('input', (e) => {
    thicknessValue.value = e.target.value;
});

thicknessValue.addEventListener('input', (e) => {
    thicknessSlider.value = e.target.value;
});

// File upload
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadImage(file);
    }
});

// Paste from clipboard
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            loadImage(file);
            break;
        }
    }
});

// Load image
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Set canvas size to image size to preserve quality
            canvas.width = img.width;
            canvas.height = img.height;

            backgroundImage = img;
            drawings = [];
            redraw();

            uploadZone.classList.add('hidden');
            canvas.style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Redraw canvas
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image with offset
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, imageOffsetX, imageOffsetY);
    }

    // Draw all saved drawings
    drawings.forEach((drawing, index) => {
        drawShape(drawing);

        // Draw selection highlight
        if (selectedDrawing === index) {
            drawSelectionBox(drawing);
        }
    });
}

// Draw selection box around selected shape
function drawSelectionBox(drawing) {
    const bounds = getDrawingBounds(drawing);
    if (!bounds) return;

    const padding = 10;
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
        bounds.minX - padding,
        bounds.minY - padding,
        bounds.maxX - bounds.minX + padding * 2,
        bounds.maxY - bounds.minY + padding * 2
    );
    ctx.setLineDash([]);
}

// Get bounding box of a drawing
function getDrawingBounds(drawing) {
    const { type, x1, y1, x2, y2, text, fontSize, fontFamily } = drawing;

    if (type === 'text') {
        ctx.font = `${fontSize}px ${fontFamily || 'Arial'}`;
        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;
        let maxWidth = 0;
        lines.forEach(line => {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        });
        return {
            minX: x1,
            minY: y1 - fontSize,
            maxX: x1 + maxWidth,
            maxY: y1 + (lines.length - 1) * lineHeight
        };
    } else if (type === 'circle') {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        return {
            minX: x1 - radius,
            minY: y1 - radius,
            maxX: x1 + radius,
            maxY: y1 + radius
        };
    } else if (type === 'pen') {
        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        };
    } else {
        // arrow, rectangle
        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        };
    }
}

// Check if point is inside drawing bounds
function isPointInDrawing(drawing, x, y) {
    const bounds = getDrawingBounds(drawing);
    if (!bounds) return false;

    const padding = 10;
    return x >= bounds.minX - padding &&
           x <= bounds.maxX + padding &&
           y >= bounds.minY - padding &&
           y <= bounds.maxY + padding;
}

// Draw shape
function drawShape(drawing) {
    const { type, x1, y1, x2, y2, color, thickness, text, fontSize, fontFamily } = drawing;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'arrow') {
        drawArrow(x1, y1, x2, y2);
    } else if (type === 'rectangle') {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'circle') {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (type === 'text') {
        ctx.font = `${fontSize}px ${fontFamily || 'Arial'}`;
        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;
        lines.forEach((line, index) => {
            ctx.fillText(line, x1, y1 + (index * lineHeight));
        });
    } else if (type === 'pen') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}

// Draw arrow
function drawArrow(x1, y1, x2, y2) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

// Get mouse position relative to canvas
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    if (!backgroundImage) return;

    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    if (currentTool === 'select') {
        // Check if clicking on a selected drawing first
        if (selectedDrawing !== null && isPointInDrawing(drawings[selectedDrawing], pos.x, pos.y)) {
            isDragging = true;
            const drawing = drawings[selectedDrawing];
            dragOffsetX = pos.x - drawing.x1;
            dragOffsetY = pos.y - drawing.y1;
        } else {
            // Find clicked drawing (reverse order to select top-most)
            selectedDrawing = null;
            for (let i = drawings.length - 1; i >= 0; i--) {
                if (isPointInDrawing(drawings[i], pos.x, pos.y)) {
                    selectedDrawing = i;
                    const drawing = drawings[i];
                    dragOffsetX = pos.x - drawing.x1;
                    dragOffsetY = pos.y - drawing.y1;
                    isDragging = true;
                    break;
                }
            }
            redraw();
        }
    } else {
        isDrawing = true;

        if (currentTool === 'text') {
            showTextModal(startX, startY);
            isDrawing = false;
        } else if (currentTool === 'pen') {
            currentDrawing = {
                type: 'pen',
                x1: startX,
                y1: startY,
                x2: startX,
                y2: startY,
                color: colorPicker.value,
                thickness: parseInt(thicknessValue.value)
            };
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!backgroundImage) return;

    const pos = getMousePos(e);

    if (currentTool === 'select' && isDragging && selectedDrawing !== null) {
        // Move the selected drawing
        const drawing = drawings[selectedDrawing];
        const deltaX = pos.x - dragOffsetX - drawing.x1;
        const deltaY = pos.y - dragOffsetY - drawing.y1;

        drawing.x1 += deltaX;
        drawing.y1 += deltaY;
        if (drawing.x2 !== undefined) {
            drawing.x2 += deltaX;
            drawing.y2 += deltaY;
        }

        redraw();
    } else if (isDrawing) {
        if (currentTool === 'pen') {
            // For pen tool, save each segment
            drawings.push({
                type: 'pen',
                x1: startX,
                y1: startY,
                x2: pos.x,
                y2: pos.y,
                color: colorPicker.value,
                thickness: parseInt(thicknessValue.value)
            });
            startX = pos.x;
            startY = pos.y;
            redraw();
        } else {
            // For other tools, show preview
            redraw();
            drawShape({
                type: currentTool,
                x1: startX,
                y1: startY,
                x2: pos.x,
                y2: pos.y,
                color: colorPicker.value,
                thickness: parseInt(thicknessValue.value)
            });
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (currentTool === 'select') {
        isDragging = false;
        return;
    }

    if (!isDrawing || !backgroundImage || currentTool === 'text') return;

    const pos = getMousePos(e);

    if (currentTool !== 'pen') {
        drawings.push({
            type: currentTool,
            x1: startX,
            y1: startY,
            x2: pos.x,
            y2: pos.y,
            color: colorPicker.value,
            thickness: parseInt(thicknessValue.value)
        });
        redraw();
    }

    isDrawing = false;
});

// Delete selected drawing on Delete/Backspace key
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawing !== null && currentTool === 'select') {
        // Check if we're not typing in an input field
        if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            drawings.splice(selectedDrawing, 1);
            selectedDrawing = null;
            redraw();
        }
    }
});

// Clear all
document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear all markups?')) {
        drawings = [];
        selectedDrawing = null;
        redraw();
    }
});

// Reset - clear image and markups
document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset and start from scratch? This will clear the image and all markups.')) {
        backgroundImage = null;
        drawings = [];
        selectedDrawing = null;
        imageOffsetX = 0;
        imageOffsetY = 0;
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.display = 'none';
        uploadZone.classList.remove('hidden');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});

// Expand canvas with padding
document.getElementById('expandCanvasBtn').addEventListener('click', () => {
    if (!backgroundImage) {
        alert('Please load an image first');
        return;
    }

    const padding = parseInt(document.getElementById('canvasPadding').value) || 0;
    if (padding === 0) {
        alert('Please enter a padding value greater than 0');
        return;
    }

    // Create a new canvas with expanded size
    const newWidth = canvas.width + (padding * 2);
    const newHeight = canvas.height + (padding * 2);

    // Resize main canvas
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Update image offset to center the original image
    imageOffsetX += padding;
    imageOffsetY += padding;

    // Update all drawing positions
    drawings.forEach(drawing => {
        drawing.x1 += padding;
        drawing.y1 += padding;
        if (drawing.x2 !== undefined) {
            drawing.x2 += padding;
            drawing.y2 += padding;
        }
    });

    redraw();
});

// Copy to clipboard
document.getElementById('copyBtn').addEventListener('click', async () => {
    if (!backgroundImage) {
        alert('Please load an image first');
        return;
    }

    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);

        // Visual feedback
        const btn = document.getElementById('copyBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#28a745';
        btn.style.color = 'white';
        btn.style.borderColor = '#28a745';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        alert('Failed to copy to clipboard. Your browser may not support this feature.');
    }
});

// Download
document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!backgroundImage) {
        alert('Please load an image first');
        return;
    }

    const link = document.createElement('a');
    link.download = 'marked-up-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Text modal functions
let pendingTextPosition = null;
let modalDragging = false;
let modalDragOffsetX = 0;
let modalDragOffsetY = 0;

function showTextModal(x, y) {
    pendingTextPosition = { x, y };
    const modal = document.getElementById('textModal');
    const modalContent = document.querySelector('.text-modal-content');
    const textInput = document.getElementById('textInput');

    // Reset position to center
    modalContent.style.top = '50%';
    modalContent.style.left = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';

    textInput.value = '';
    modal.classList.remove('hidden');

    // Use setTimeout to ensure focus works after modal is rendered
    setTimeout(() => {
        textInput.focus();
        textInput.select();
    }, 0);
}

function hideTextModal() {
    const modal = document.getElementById('textModal');
    modal.classList.add('hidden');
    pendingTextPosition = null;
}

// Make modal draggable by the title
document.querySelector('.text-modal-content h3').addEventListener('mousedown', (e) => {
    modalDragging = true;
    const modalContent = document.querySelector('.text-modal-content');
    const rect = modalContent.getBoundingClientRect();
    modalDragOffsetX = e.clientX - rect.left;
    modalDragOffsetY = e.clientY - rect.top;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!modalDragging) return;

    const modalContent = document.querySelector('.text-modal-content');
    modalContent.style.transform = 'none';
    modalContent.style.left = (e.clientX - modalDragOffsetX) + 'px';
    modalContent.style.top = (e.clientY - modalDragOffsetY) + 'px';
});

document.addEventListener('mouseup', () => {
    modalDragging = false;
});

document.getElementById('textOkBtn').addEventListener('click', () => {
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (text && pendingTextPosition) {
        drawings.push({
            type: 'text',
            x1: pendingTextPosition.x,
            y1: pendingTextPosition.y,
            text: text,
            color: colorPicker.value,
            fontSize: parseInt(fontSizeInput.value),
            fontFamily: fontFamilySelect.value
        });
        redraw();
    }

    hideTextModal();
});

document.getElementById('textCancelBtn').addEventListener('click', () => {
    hideTextModal();
});

// Allow Enter with Shift for new lines, Enter alone to submit
document.getElementById('textInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('textOkBtn').click();
    } else if (e.key === 'Escape') {
        hideTextModal();
    }
});
