const canvas = document.getElementById('mindMapCanvas');
const ctx = canvas.getContext('2d');

const conceptNodeTextInput = document.getElementById('conceptNodeText');
const addConceptNodeBtn = document.getElementById('addConceptNodeBtn');

const connectModeBtn = document.getElementById('connectModeBtn');
const connectStatus = document.getElementById('connectStatus');

const selectedElementSection = document.getElementById('selectedElementSection');
const selectedElementTitle = document.getElementById('selectedElementTitle');
const editConceptSection = document.getElementById('editConceptSection');
const editConceptNodeTextInput = document.getElementById('editConceptNodeText');
const updateConceptNodeBtn = document.getElementById('updateConceptNodeBtn');
const detailNodeTextInput = document.getElementById('detailNodeText');
const addDetailNodeBtn = document.getElementById('addDetailNodeBtn');
const editDetailSection = document.getElementById('editDetailSection');
const editDetailNodeTextInput = document.getElementById('editDetailNodeText');
const updateDetailNodeBtn = document.getElementById('updateDetailNodeBtn');
const deleteElementBtn = document.getElementById('deleteElementBtn');

const alertModal = document.getElementById('alertModal');
const alertModalTitle = document.getElementById('alertModalTitle');
const alertModalMessage = document.getElementById('alertModalMessage');
const alertModalCloseBtn = document.getElementById('alertModalCloseBtn');

let elements = [];
let connections = [];

let selectedElement = null;
let draggingElement = null;
let dragOffsetX, dragOffsetY;

let isConnectMode = false;
let firstElementForConnection = null;

const CONCEPT_NODE_COLOR = '#2563eb';
const CONCEPT_NODE_SELECTED_COLOR = '#1d4ed8';
const ELEMENT_CONNECT_HIGHLIGHT_COLOR = '#059669';
const DETAIL_NODE_COLOR = '#4b5563';
const DETAIL_NODE_SELECTED_COLOR = '#374151';
const CONCEPT_CONNECTION_LINE_COLOR = '#9ca3af';
const DETAIL_CONNECTION_LINE_COLOR = '#6ee7b7';
const TEXT_COLOR = '#e5e7eb';
const TEXT_COLOR_ON_DARK_BG = '#f9fafb';

const MIN_CONCEPT_RADIUS = 40;
const MIN_DETAIL_WIDTH = 150;
const MIN_DETAIL_HEIGHT = 60;
const PADDING = 15;

let transform = { scale: 1, translateX: 0, translateY: 0 };
let isPanning = false;
let lastPanPosition = { x: 0, y: 0 };
let pinchStartDistance = 0;

function showModal(title, message) {
    alertModalTitle.textContent = title;
    alertModalMessage.textContent = message;
    alertModal.classList.remove('hidden');
}
alertModalCloseBtn.addEventListener('click', () => alertModal.classList.add('hidden'));

function resizeCanvas() {
    const canvasContainer = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasContainer.clientWidth * dpr;
    canvas.height = canvasContainer.clientHeight * dpr;
    canvas.style.width = `${canvasContainer.clientWidth}px`;
    canvas.style.height = `${canvasContainer.clientHeight}px`;
    ctx.scale(dpr, dpr);
    draw();
}
window.addEventListener('resize', resizeCanvas);

function init() {
    resizeCanvas();
    addConceptNodeBtn.addEventListener('click', addConceptNode);
    connectModeBtn.addEventListener('click', toggleConnectMode);
    updateConceptNodeBtn.addEventListener('click', updateSelectedConceptNode);
    addDetailNodeBtn.addEventListener('click', addDetailNodeToSelectedConcept);
    updateDetailNodeBtn.addEventListener('click', updateSelectedDetailNode);
    deleteElementBtn.addEventListener('click', deleteSelectedElement);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isPanning && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            isPanning = true;
            canvas.style.cursor = 'grabbing';
            lastPanPosition = { x: e.clientX, y: e.clientY };
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isPanning = false;
            canvas.style.cursor = getCanvasCursor();
        }
    });
    draw();
}

function getCanvasCursor() {
    if (isPanning) return 'grabbing';
    if (isConnectMode) return 'crosshair';
    return 'default';
}

function getTransformedMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0);
    const x = (clientX - rect.left - transform.translateX / dpr) / (transform.scale / dpr);
    const y = (clientY - rect.top - transform.translateY / dpr) / (transform.scale / dpr);
    return { x, y };
}

function addConceptNode() {
    const text = conceptNodeTextInput.value.trim();
    if (!text) {
        showModal("Erro", "O título do conceito não pode estar vazio.");
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    const newConcept = {
        id: crypto.randomUUID(),
        type: 'concept',
        x: (canvas.width / dpr / 2 - transform.translateX / dpr) / (transform.scale / dpr),
        y: (canvas.height / dpr / 2 - transform.translateY / dpr) / (transform.scale / dpr),
        text: text,
        radius: MIN_CONCEPT_RADIUS,
        color: CONCEPT_NODE_COLOR
    };
    elements.push(newConcept);
    conceptNodeTextInput.value = '';
    draw();
}

function addDetailNodeToSelectedConcept() {
    if (!selectedElement || selectedElement.type !== 'concept') {
        showModal("Erro", "Selecione um nó de conceito primeiro para adicionar um texto ligado.");
        return;
    }
    const text = detailNodeTextInput.value.trim();
    if (!text) {
        showModal("Erro", "O texto do detalhe não pode estar vazio.");
        return;
    }
    const newDetail = {
        id: crypto.randomUUID(),
        type: 'detail',
        parentId: selectedElement.id, // Initially linked to the concept
        x: selectedElement.x + selectedElement.radius + MIN_DETAIL_WIDTH / 2 + 30,
        y: selectedElement.y + (elements.filter(el => el.parentId === selectedElement.id).length * (MIN_DETAIL_HEIGHT + 10)),
        text: text,
        width: MIN_DETAIL_WIDTH,
        height: MIN_DETAIL_HEIGHT,
        color: DETAIL_NODE_COLOR
    };
    elements.push(newDetail);
    detailNodeTextInput.value = '';
    draw();
}

function toggleConnectMode() {
    isConnectMode = !isConnectMode;
    firstElementForConnection = null;
    if (isConnectMode) {
        connectModeBtn.textContent = 'Desativar Modo Conexão';
        connectModeBtn.classList.replace('bg-green-600', 'bg-yellow-600');
        connectModeBtn.classList.replace('hover:bg-green-700', 'hover:bg-yellow-700');
        connectStatus.textContent = 'Modo Conexão: Ativado. Clique em dois elementos do mesmo tipo.';
        deselectElement();
    } else {
        connectModeBtn.textContent = 'Ativar Modo Conexão';
        connectModeBtn.classList.replace('bg-yellow-600', 'bg-green-600');
        connectModeBtn.classList.replace('hover:bg-yellow-700', 'hover:bg-green-700');
        connectStatus.textContent = 'Modo Conexão: Desativado';
    }
    canvas.style.cursor = getCanvasCursor();
    draw();
}

function updateSelectedConceptNode() {
    if (selectedElement && selectedElement.type === 'concept') {
        const newText = editConceptNodeTextInput.value.trim();
        if (!newText) {
            showModal("Erro", "O título do conceito não pode estar vazio.");
            return;
        }
        selectedElement.text = newText;
        draw();
    }
}

function updateSelectedDetailNode() {
    if (selectedElement && selectedElement.type === 'detail') {
        const newText = editDetailNodeTextInput.value.trim();
        if (!newText) {
            showModal("Erro", "O texto do detalhe não pode estar vazio.");
            return;
        }
        selectedElement.text = newText;
        draw();
    }
}

function deleteSelectedElement() {
    if (!selectedElement) return;

    const idToDelete = selectedElement.id;
    elements = elements.filter(el => el.id !== idToDelete);

    if (selectedElement.type === 'concept') {
        elements = elements.filter(el => el.parentId !== idToDelete);
        connections = connections.filter(conn => conn.from !== idToDelete && conn.to !== idToDelete);
    } else if (selectedElement.type === 'detail') {
        connections = connections.filter(conn => conn.from !== idToDelete && conn.to !== idToDelete);
        // Check if other details were manually connected TO this deleted detail, and if so, reset their parentId or handle orphan status
        elements.forEach(el => {
            // This part is tricky: if B was connected to A (deleted), B is now an orphan from A.
            // For now, we are not re-parenting. The manual connection is just removed.
            // If B's original parentId was cleared, it remains cleared.
        });
    }

    deselectElement();
    draw();
}

function selectElement(element) {
    selectedElement = element;
    selectedElementSection.classList.remove('hidden');
    if (element.type === 'concept') {
        selectedElementTitle.textContent = "Conceito Selecionado";
        editConceptSection.classList.remove('hidden');
        editDetailSection.classList.add('hidden');
        editConceptNodeTextInput.value = element.text;
        detailNodeTextInput.value = "";
    } else if (element.type === 'detail') {
        selectedElementTitle.textContent = "Texto Ligado Selecionado";
        editConceptSection.classList.add('hidden');
        editDetailSection.classList.remove('hidden');
        editDetailNodeTextInput.value = element.text;
    }
    draw();
}

function deselectElement() {
    selectedElement = null;
    selectedElementSection.classList.add('hidden');
    editConceptNodeTextInput.value = '';
    editDetailNodeTextInput.value = '';
    detailNodeTextInput.value = '';
    draw();
}

function getWrappedTextLines(text, maxWidth, fontSize) {
    const words = text.split(/[\s-]+/);
    const lines = [];
    let currentLine = "";
    ctx.font = `${fontSize}px Arial`;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let testLine = currentLine ? currentLine + (text.includes(currentLine + "-" + word) ? "-" : " ") + word : word;

        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [text];
}

function drawConceptNode(node) {
    const fontSize = 16;
    const lines = getWrappedTextLines(node.text, MIN_CONCEPT_RADIUS * 1.8, fontSize);

    let textHeight = lines.length * (fontSize * 1.2);
    let maxLineWidth = 0;
    lines.forEach(line => {
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    });
    node.radius = Math.max(MIN_CONCEPT_RADIUS, textHeight / 2 + PADDING, maxLineWidth / 2 + PADDING);

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

    if (selectedElement && node.id === selectedElement.id) ctx.fillStyle = CONCEPT_NODE_SELECTED_COLOR;
    else if (firstElementForConnection && node.id === firstElementForConnection.id) ctx.fillStyle = ELEMENT_CONNECT_HIGHLIGHT_COLOR;
    else ctx.fillStyle = node.color;

    ctx.fill();
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2 / (transform.scale / (window.devicePixelRatio || 1));
    ctx.stroke();

    ctx.fillStyle = TEXT_COLOR_ON_DARK_BG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px Arial`;

    const lineHeight = fontSize * 1.2;
    const startY = node.y - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => {
        ctx.fillText(line, node.x, startY + index * lineHeight);
    });
}

function drawDetailNode(node) {
    const fontSize = 14;
    const lines = getWrappedTextLines(node.text, MIN_DETAIL_WIDTH * 1.5 - PADDING * 2, fontSize);

    let maxLineWidth = 0;
    lines.forEach(line => {
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    });

    node.width = Math.max(MIN_DETAIL_WIDTH, maxLineWidth + PADDING * 2);
    node.height = Math.max(MIN_DETAIL_HEIGHT, lines.length * (fontSize * 1.2) + PADDING * 2);

    ctx.beginPath();
    const cornerRadius = 10;
    ctx.moveTo(node.x - node.width / 2 + cornerRadius, node.y - node.height / 2);
    ctx.lineTo(node.x + node.width / 2 - cornerRadius, node.y - node.height / 2);
    ctx.quadraticCurveTo(node.x + node.width / 2, node.y - node.height / 2, node.x + node.width / 2, node.y - node.height / 2 + cornerRadius);
    ctx.lineTo(node.x + node.width / 2, node.y + node.height / 2 - cornerRadius);
    ctx.quadraticCurveTo(node.x + node.width / 2, node.y + node.height / 2, node.x + node.width / 2 - cornerRadius, node.y + node.height / 2);
    ctx.lineTo(node.x - node.width / 2 + cornerRadius, node.y + node.height / 2);
    ctx.quadraticCurveTo(node.x - node.width / 2, node.y + node.height / 2, node.x - node.width / 2, node.y + node.height / 2 - cornerRadius);
    ctx.lineTo(node.x - node.width / 2, node.y - node.height / 2 + cornerRadius);
    ctx.quadraticCurveTo(node.x - node.width / 2, node.y - node.height / 2, node.x - node.width / 2 + cornerRadius, node.y - node.height / 2);
    ctx.closePath();

    if (selectedElement && node.id === selectedElement.id) ctx.fillStyle = DETAIL_NODE_SELECTED_COLOR;
    else if (firstElementForConnection && node.id === firstElementForConnection.id) ctx.fillStyle = ELEMENT_CONNECT_HIGHLIGHT_COLOR;
    else ctx.fillStyle = node.color;

    ctx.fill();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5 / (transform.scale / (window.devicePixelRatio || 1));
    ctx.stroke();

    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px Arial`;

    const lineHeight = fontSize * 1.2;
    const startY = node.y - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => {
        ctx.fillText(line, node.x, startY + index * lineHeight);
    });

    // Draw line to parent concept (automatic connection) ONLY IF parentId is not null
    if (node.parentId) {
        const parentConcept = elements.find(el => el.id === node.parentId && el.type === 'concept');
        if (parentConcept) {
            const { x: startX, y: startY } = getEdgePoint(parentConcept, node);
            const { x: endX, y: endY } = getEdgePoint(node, parentConcept);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = CONCEPT_CONNECTION_LINE_COLOR;
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.5 / (transform.scale / (window.devicePixelRatio || 1));
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function getEdgePoint(sourceEl, targetEl) {
    const dx = targetEl.x - sourceEl.x;
    const dy = targetEl.y - sourceEl.y;
    const angle = Math.atan2(dy, dx);

    if (sourceEl.type === 'concept') {
        return {
            x: sourceEl.x + sourceEl.radius * Math.cos(angle),
            y: sourceEl.y + sourceEl.radius * Math.sin(angle)
        };
    } else if (sourceEl.type === 'detail') {
        const halfW = sourceEl.width / 2;
        const halfH = sourceEl.height / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Check intersection with vertical edges
        let tVer = Infinity;
        if (Math.abs(cosA) > 1e-6) {
            const tx1 = (sourceEl.x - halfW - sourceEl.x) / cosA; // Left edge
            const tx2 = (sourceEl.x + halfW - sourceEl.x) / cosA; // Right edge
            const iy1 = sourceEl.y + tx1 * sinA;
            const iy2 = sourceEl.y + tx2 * sinA;

            if (tx1 > 0 && iy1 >= sourceEl.y - halfH && iy1 <= sourceEl.y + halfH) tVer = Math.min(tVer, tx1);
            if (tx2 > 0 && iy2 >= sourceEl.y - halfH && iy2 <= sourceEl.y + halfH) tVer = Math.min(tVer, tx2);
        }

        // Check intersection with horizontal edges
        let tHor = Infinity;
        if (Math.abs(sinA) > 1e-6) {
            const ty1 = (sourceEl.y - halfH - sourceEl.y) / sinA; // Top edge
            const ty2 = (sourceEl.y + halfH - sourceEl.y) / sinA; // Bottom edge
            const ix1 = sourceEl.x + ty1 * cosA;
            const ix2 = sourceEl.x + ty2 * cosA;

            if (ty1 > 0 && ix1 >= sourceEl.x - halfW && ix1 <= sourceEl.x + halfW) tHor = Math.min(tHor, ty1);
            if (ty2 > 0 && ix2 >= sourceEl.x - halfW && ix2 <= sourceEl.x + halfW) tHor = Math.min(tHor, ty2);
        }

        const t = Math.min(tVer, tHor);

        if (t !== Infinity && t > 0) {
            return { x: sourceEl.x + t * cosA, y: sourceEl.y + t * sinA };
        }
        // Fallback (e.g., targetEl is inside sourceEl, or angle is perfectly aligned with corner)
        // This fallback is a rough approximation and might not be perfect for all edge cases.
        return {
            x: sourceEl.x + cosA * (Math.abs(dx) > Math.abs(dy) ? halfW : Math.abs(halfW * cosA)),
            y: sourceEl.y + sinA * (Math.abs(dy) > Math.abs(dx) ? halfH : Math.abs(halfH * sinA))
        };
    }
    return { x: sourceEl.x, y: sourceEl.y };
}

function drawManualConnection(connection) {
    const fromNode = elements.find(el => el.id === connection.from);
    const toNode = elements.find(el => el.id === connection.to);

    if (fromNode && toNode) {
        const { x: startX, y: startY } = getEdgePoint(fromNode, toNode);
        const { x: endX, y: endY } = getEdgePoint(toNode, fromNode);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);

        let lineColor = CONCEPT_CONNECTION_LINE_COLOR;
        let hasArrow = true;

        if (fromNode.type === 'detail' && toNode.type === 'detail') {
            lineColor = DETAIL_CONNECTION_LINE_COLOR;
            hasArrow = true; // Let's add a smaller arrow for detail-to-detail
        }

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = (fromNode.type === 'detail' ? 2 : 3) / (transform.scale / (window.devicePixelRatio || 1));
        ctx.stroke();

        if (hasArrow) {
            const angle = Math.atan2(endY - startY, endX - startX);
            const dpr = window.devicePixelRatio || 1;
            const arrowSize = (fromNode.type === 'detail' ? 8 : 10) / (transform.scale / dpr); // Smaller arrow for detail connections

            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle - Math.PI / 6),
                endY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle + Math.PI / 6),
                endY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = lineColor;
            ctx.fill();
        }
    }
}

function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.restore();

    ctx.save();
    ctx.translate(transform.translateX, transform.translateY);
    ctx.scale(transform.scale, transform.scale);

    connections.forEach(drawManualConnection);

    elements.filter(el => el.type === 'detail').forEach(drawDetailNode);
    elements.filter(el => el.type === 'concept').forEach(drawConceptNode);

    ctx.restore();
}

function getElementAtPosition(x, y) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'detail') {
            if (x >= el.x - el.width / 2 && x <= el.x + el.width / 2 &&
                y >= el.y - el.height / 2 && y <= el.y + el.height / 2) {
                return el;
            }
        } else if (el.type === 'concept') {
            const distance = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
            if (distance < el.radius) {
                return el;
            }
        }
    }
    return null;
}

function handlePointerDown(clientX, clientY) {
    const { x, y } = getTransformedMousePos({ clientX, clientY });

    if (isPanning && !draggingElement) {
        lastPanPosition = { x: clientX, y: clientY };
        canvas.style.cursor = 'grabbing';
        return true;
    }

    const clickedElement = getElementAtPosition(x, y);

    if (isConnectMode) {
        if (clickedElement) {
            if (!firstElementForConnection) {
                firstElementForConnection = clickedElement;
            } else if (firstElementForConnection.id !== clickedElement.id &&
                firstElementForConnection.type === clickedElement.type) {
                const existingConnection = connections.find(
                    conn => (conn.from === firstElementForConnection.id && conn.to === clickedElement.id) ||
                        (conn.from === clickedElement.id && conn.to === firstElementForConnection.id)
                );
                if (!existingConnection) {
                    connections.push({
                        from: firstElementForConnection.id,
                        to: clickedElement.id,
                        type: `${firstElementForConnection.type}_to_${clickedElement.type}`
                    });
                    // If connecting two detail nodes, the second one loses its parentId to a concept
                    if (firstElementForConnection.type === 'detail' && clickedElement.type === 'detail') {
                        clickedElement.parentId = null; // Remove link to original concept parent
                    }
                }
                firstElementForConnection = null;
            } else if (firstElementForConnection.type !== clickedElement.type) {
                showModal("Aviso", "Você só pode conectar elementos do mesmo tipo (Conceito com Conceito, ou Texto Ligado com Texto Ligado).");
                firstElementForConnection = null;
            }
        }
    } else {
        if (clickedElement) {
            selectedElement = clickedElement;
            draggingElement = clickedElement;
            dragOffsetX = x - draggingElement.x;
            dragOffsetY = y - draggingElement.y;
            selectElement(clickedElement);
            canvas.style.cursor = 'grabbing';
        } else {
            deselectElement();
        }
    }
    draw();
    return false;
}

function handlePointerMove(clientX, clientY) {
    if (isPanning && draggingElement === null) {
        const dx = clientX - lastPanPosition.x;
        const dy = clientY - lastPanPosition.y;
        transform.translateX += dx;
        transform.translateY += dy;
        lastPanPosition = { x: clientX, y: clientY };
        draw();
        return;
    }

    const { x, y } = getTransformedMousePos({ clientX, clientY });
    if (draggingElement && !isConnectMode) {
        draggingElement.x = x - dragOffsetX;
        draggingElement.y = y - dragOffsetY;
        draw();
    } else if (!isPanning) {
        const hoveredElement = getElementAtPosition(x, y);
        if (hoveredElement && !isConnectMode) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = getCanvasCursor();
        }
    }
}

function handlePointerUp() {
    if (draggingElement) {
        canvas.style.cursor = getCanvasCursor();
    }
    draggingElement = null;
}

function onMouseDown(event) {
    if (event.button !== 0) return;
    handlePointerDown(event.clientX, event.clientY);
}

function onMouseMove(event) {
    if (event.buttons === 1 || isPanning) {
        handlePointerMove(event.clientX, event.clientY);
    } else if (!draggingElement) {
        const { x, y } = getTransformedMousePos(event);
        const hoveredElement = getElementAtPosition(x, y);
        if (hoveredElement && !isConnectMode) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = getCanvasCursor();
        }
    }
}

function onMouseUp(event) {
    if (event.button !== 0) return;
    handlePointerUp();
}
function onMouseLeave(event) {
    if (draggingElement) {
        draggingElement = null;
        canvas.style.cursor = getCanvasCursor();
        draw();
    }
}

function onDoubleClick(event) {
    if (isConnectMode) return;
    const { x, y } = getTransformedMousePos(event);
    const clickedElement = getElementAtPosition(x, y);
    if (clickedElement) {
        selectElement(clickedElement);
        if (clickedElement.type === 'concept') editConceptNodeTextInput.focus();
        else if (clickedElement.type === 'detail') editDetailNodeTextInput.focus();
    }
}

function onWheel(event) {
    event.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const mouseXRelative = event.clientX - rect.left;
    const mouseYRelative = event.clientY - rect.top;

    const scaleAmount = 1.1;
    const oldScale = transform.scale;

    if (event.deltaY < 0) {
        transform.scale *= scaleAmount;
    } else {
        transform.scale /= scaleAmount;
    }
    transform.scale = Math.max(0.2 * dpr, Math.min(transform.scale, 5 * dpr));

    transform.translateX = mouseXRelative * dpr - (mouseXRelative * dpr - transform.translateX) * (transform.scale / oldScale);
    transform.translateY = mouseYRelative * dpr - (mouseYRelative * dpr - transform.translateY) * (transform.scale / oldScale);

    draw();
}

let lastTouchDistance = 0;
let lastTouchCenter = null;

function onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const panStarted = handlePointerDown(touch.clientX, touch.clientY);
        if (!panStarted && !draggingElement && isPanning) {
            lastPanPosition = { x: touch.clientX, y: touch.clientY };
        }
    } else if (event.touches.length === 2) {
        draggingElement = null;
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        lastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        lastTouchCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }
}

function onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1 && !lastTouchDistance) {
        const touch = event.touches[0];
        if (isPanning && !draggingElement) {
            const dx = touch.clientX - lastPanPosition.x;
            const dy = touch.clientY - lastPanPosition.y;
            transform.translateX += dx;
            transform.translateY += dy;
            lastPanPosition = { x: touch.clientX, y: touch.clientY };
            draw();
        } else {
            handlePointerMove(touch.clientX, touch.clientY);
        }
    } else if (event.touches.length === 2) {
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const currentCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        const scaleFactor = currentDistance / lastTouchDistance;
        const oldScale = transform.scale;
        transform.scale *= scaleFactor;
        transform.scale = Math.max(0.2 * dpr, Math.min(transform.scale, 5 * dpr));

        const centerRelativeX = currentCenter.x - rect.left;
        const centerRelativeY = currentCenter.y - rect.top;

        transform.translateX = centerRelativeX * dpr - (centerRelativeX * dpr - transform.translateX) * (transform.scale / oldScale);
        transform.translateY = centerRelativeY * dpr - (centerRelativeY * dpr - transform.translateY) * (transform.scale / oldScale);

        lastTouchDistance = currentDistance;
        lastTouchCenter = currentCenter;
        draw();
    }
}

function onTouchEnd(event) {
    event.preventDefault();
    if (event.touches.length < 2) {
        lastTouchDistance = 0;
        lastTouchCenter = null;
    }
    if (event.touches.length === 0) {
        handlePointerUp();
    }
}

init();