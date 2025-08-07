import { Point } from './Point.js';
import { Canvas } from './Canvas.js';
import { UI } from './UI.js';
import { getMousePos, findClosestPoint, generateUniquePointName, distance } from './utils.js';

export class WaveformEditor {
    constructor(canvasElement) {
        this.canvas = new Canvas(canvasElement);
        this.ui = new UI();
        this.points = new Map();
        this.selectedPoint = null;
        this.draggingPoint = null;
        this.draggingControlPoint = null;
        this.baselineY = this.canvas.height / 2; // Center baseline
        this.highlightedSegment = null;
        this.showLabels = true;
        this.selectedPoints = new Set();
        this.isBoxSelecting = false;
        this.boxStartX = 0;
        this.boxStartY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isTransforming = false;
        this.transformStartPoints = new Map();
        this.transformOrigin = { x: 0, y: 0 };
        
        // Add history management
        this.history = [];
        this.currentHistoryIndex = -1;
        this.maxHistorySize = 50;
        this.isUndoRedoAction = false;
        
        // Add zoom and pan properties
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.isSpacePressed = false;
        this.previousCursor = 'default';  // Add property to store previous cursor
        this.minZoom = 0.1;
        this.maxZoom = 10;
        
        // Create a resize observer to handle canvas resizing
        this.resizeObserver = new ResizeObserver(() => {
            this.canvas.setupCanvas();
            this.baselineY = this.canvas.height / 2; // Keep baseline centered
            
            // Scale points to new dimensions if needed
            if (this.points.size > 0) {
                const oldWidth = this.canvas.width;
                const oldHeight = this.canvas.height;
                const newWidth = this.canvas.width;
                const newHeight = this.canvas.height;
                
                // Only scale if dimensions actually changed
                if (oldWidth !== newWidth || oldHeight !== newHeight) {
                    this.points.forEach(point => {
                        // Scale x and y positions
                        point.x = (point.x / oldWidth) * newWidth;
                        point.y = (point.y / oldHeight) * newHeight;
                        
                        // Scale control points
                        if (point.cp1) {
                            point.cp1.x = (point.cp1.x / oldWidth) * newWidth;
                            point.cp1.y = (point.cp1.y / oldHeight) * newHeight;
                        }
                        if (point.cp2) {
                            point.cp2.x = (point.cp2.x / oldWidth) * newWidth;
                            point.cp2.y = (point.cp2.y / oldHeight) * newHeight;
                        }
                    });
                }
            }
            
            this.draw();
        });
        this.resizeObserver.observe(canvasElement.parentElement);
        
        // Setup event listeners before loading/creating points
        this.setupEventListeners();
        
        // Try to load state from localStorage first, then fall back to saved wave, then base wave
        if (!this.loadFromLocalStorage()) {
            if (!this.loadSavedWave()) {
                this.setupBaseWave();
            }
        }
        
        // Initial draw
        requestAnimationFrame(() => {
            this.canvas.setupCanvas(); // Ensure canvas is properly set up
            this.draw();
        });

        this.isPreviewMode = false;
        this.previewAnimationId = null;
        this.previewOffset = 0;
        this.selectedPoints = new Set();
        this.lastMouseX = 0;
        this.lastMouseY = 0;
    }

    setupBaseWave() {
        // Use logical dimensions instead of scaled canvas dimensions
        const height = this.canvas.height;
        const width = this.canvas.width;
        const baseline = height / 2; // Calculate baseline using logical height
        this.baselineY = baseline;
        
        // Clear existing points
        this.points.clear();
        
        // Calculate x-positions to space out the PQRST wave components
        const startX = 50;
        const totalWidth = width - 100;
        
        // Create points for PQRST wave with appropriate positioning
        const points = [
            // Initial baseline
            new Point(startX, baseline, 'Start', '#ff0000', 'smooth'),
            
            // P wave (smooth bump)
            new Point(startX + totalWidth * 0.15, baseline, 'P-start', '#ff0000', 'smooth'),
            new Point(startX + totalWidth * 0.2, baseline - 20, 'P', '#ff0000', 'smooth'),
            new Point(startX + totalWidth * 0.25, baseline, 'P-end', '#ff0000', 'smooth'),
            
            // Q wave (sharp downward deflection)
            new Point(startX + totalWidth * 0.3, baseline, 'Q-start', '#ff0000', 'sharp'),
            new Point(startX + totalWidth * 0.32, baseline + 30, 'Q', '#ff0000', 'sharp'),
            
            // R wave (sharp upward spike)
            new Point(startX + totalWidth * 0.35, baseline - 100, 'R', '#ff0000', 'sharp'),
            
            // S wave (sharp downward deflection)
            new Point(startX + totalWidth * 0.38, baseline + 40, 'S', '#ff0000', 'sharp'),
            
            // ST segment (flat line)
            new Point(startX + totalWidth * 0.45, baseline, 'ST', '#ff0000', 'sharp'),
            
            // T wave (smooth dome)
            new Point(startX + totalWidth * 0.6, baseline, 'T-start', '#ff0000', 'smooth'),
            new Point(startX + totalWidth * 0.65, baseline - 30, 'T', '#ff0000', 'smooth'),
            new Point(startX + totalWidth * 0.7, baseline, 'T-end', '#ff0000', 'smooth'),
            
            // Final baseline
            new Point(width - 50, baseline, 'End', '#ff0000', 'smooth')
        ];
        
        // Set initial control points for smooth curves
        points.forEach((point, i) => {
            if (i > 0) {
                const prevPoint = points[i - 1];
                const dx = point.x - prevPoint.x;
                const dy = point.y - prevPoint.y;
                
                if (prevPoint.type === 'smooth' && point.type === 'smooth') {
                    // Set control points at 1/3 and 2/3 of the distance between points
                    prevPoint.cp2 = {
                        x: prevPoint.x + dx / 3,
                        y: prevPoint.y + dy / 3
                    };
                    
                    point.cp1 = {
                        x: point.x - dx / 3,
                        y: point.y - dy / 3
                    };
                } else {
                    // For sharp points or transitions between smooth and sharp,
                    // keep control points closer to their anchor points
                    prevPoint.cp2 = {
                        x: prevPoint.x + dx / 6,
                        y: prevPoint.y + dy / 6
                    };
                    
                    point.cp1 = {
                        x: point.x - dx / 6,
                        y: point.y - dy / 6
                    };
                }
            }
            
            // Add point to the points Map
            this.points.set(point.name, point);
        });

        // Initialize first point's control points if not set
        const firstPoint = points[0];
        if (!firstPoint.cp1) {
            firstPoint.cp1 = { x: firstPoint.x, y: firstPoint.y };
        }
        if (!firstPoint.cp2) {
            firstPoint.cp2 = { x: firstPoint.x + 50, y: firstPoint.y };
        }

        this.draw();
    }

    setupEventListeners() {
        const canvas = this.canvas.element;
        
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Add keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            // Check if we're not in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd key
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
            }

            // Toggle preview mode with 'P' key
            if (e.key.toLowerCase() === 'p' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.togglePreviewMode();
            }

            // Add transform mode toggle with 't' key
            if (e.key.toLowerCase() === 't' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.toggleTransformMode();
            }
        });
        
        // Add toolbar button event listeners
        const toggleButton = document.getElementById('toggle-type');
        const addButton = document.getElementById('add-point');
        const deleteButton = document.getElementById('delete-point');
        const loadWaveButton = document.getElementById('load-wave');
        const saveWaveButton = document.getElementById('save-wave');
        const exportForMonitorButton = document.getElementById('export-for-monitor');
        const toggleLabelsItem = document.getElementById('toggle-labels');
        const toggleGuidesItem = document.getElementById('toggle-guides');
        const toggleStarButton = document.getElementById('toggle-star');
        const moveToBaselineButton = document.getElementById('move-to-baseline');
        const transformPointsButton = document.getElementById('transform-points');
        const undoButton = document.getElementById('undo');
        const redoButton = document.getElementById('redo');

        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggleSelectedPointType());
        }

        if (addButton) {
            addButton.addEventListener('click', () => {
                const x = this.canvas.width / 2;
                const y = this.canvas.height / 2;
                this.addPoint(x, y);
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                if (this.selectedPoint) {
                    this.deletePoint(this.selectedPoint);
                    this.ui.updatePointList(this.points, null, (p) => this.selectPoint(p));
                } else {
                    this.ui.showToast('Please select a point first', 'error');
                }
            });
        }

        if (moveToBaselineButton) {
            moveToBaselineButton.addEventListener('click', () => this.moveSelectedPointsToBaseline());
        }

        if (loadWaveButton) {
            loadWaveButton.addEventListener('click', () => this.loadSavedWave());
        }

        if (saveWaveButton) {
            saveWaveButton.addEventListener('click', () => this.saveWave());
        }

        if (exportForMonitorButton) {
            exportForMonitorButton.addEventListener('click', () => {
                const waveformData = this.exportForMonitor();
                const blob = new Blob([JSON.stringify(waveformData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = 'monitor-waveform.json';
                document.body.appendChild(link);
                link.click();
                
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                this.ui.showToast('Waveform exported for monitor', 'success');
            });
        }

        if (toggleLabelsItem) {
            toggleLabelsItem.addEventListener('click', () => this.toggleLabels());
            // Set initial state
            if (this.showLabels) {
                toggleLabelsItem.classList.add('checked');
            }
        }

        if (toggleGuidesItem) {
            toggleGuidesItem.addEventListener('click', () => this.toggleGuides());
            // Set initial state
            if (this.canvas.showGuides) {
                toggleGuidesItem.classList.add('checked');
            }
        }

        if (toggleStarButton) {
            toggleStarButton.addEventListener('click', () => this.toggleSelectedPointStar());
        }

        if (transformPointsButton) {
            transformPointsButton.addEventListener('click', () => this.toggleTransformMode());
        }

        if (undoButton) {
            undoButton.addEventListener('click', () => this.undo());
        }

        if (redoButton) {
            redoButton.addEventListener('click', () => this.redo());
        }
        
        window.addEventListener('resize', () => {
            this.canvas.setupCanvas();
            this.draw();
        });

        // Add preview mode toggle
        const togglePreviewItem = document.getElementById('toggle-preview');
        if (togglePreviewItem) {
            togglePreviewItem.addEventListener('click', () => {
                this.togglePreviewMode();
            });
        }

        // Add keyboard event listener for Escape key
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleMouseDown(e) {
        if (this.isPreviewMode) return;

        const rect = this.canvas.element.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToWorld(screenX, screenY);

        if (this.isTransforming) {
            // Start transform operation
            this.transformStartPoints = new Map();
            this.selectedPoints.forEach(id => {
                const point = this.points.get(id);
                if (point) {
                    this.transformStartPoints.set(id, {
                        x: point.x,
                        y: point.y,
                        cp1: point.cp1 ? { ...point.cp1 } : null,
                        cp2: point.cp2 ? { ...point.cp2 } : null
                    });
                }
            });

            // Calculate transform origin (center of selected points)
            let sumX = 0, sumY = 0, count = 0;
            this.transformStartPoints.forEach(point => {
                sumX += point.x;
                sumY += point.y;
                count++;
            });
            this.transformOrigin = {
                x: sumX / count,
                y: sumY / count
            };

            this.lastMouseX = screenX;
            this.lastMouseY = screenY;
            return;
        }

        // Only start panning if spacebar is pressed
        if (this.isSpacePressed) {
            this.isPanning = true;
            this.previousCursor = 'grab';  // Update previous cursor
            this.canvas.element.style.cursor = 'grabbing';
            this.lastMouseX = screenX;
            this.lastMouseY = screenY;
            return;
        }

        // Check for control point selection first
        if (this.selectedPoint) {
            const cp1Pos = this.selectedPoint.cp1 ? 
                this.worldToScreen(this.selectedPoint.cp1.x, this.selectedPoint.cp1.y) : null;
            const cp2Pos = this.selectedPoint.cp2 ? 
                this.worldToScreen(this.selectedPoint.cp2.x, this.selectedPoint.cp2.y) : null;

            if (cp1Pos) {
                const cp1Dist = Math.sqrt(Math.pow(screenX - cp1Pos.x, 2) + Math.pow(screenY - cp1Pos.y, 2));
                if (cp1Dist <= 5) {
                    this.draggingControlPoint = { point: this.selectedPoint, handle: 'cp1' };
                    return;
                }
            }
            if (cp2Pos) {
                const cp2Dist = Math.sqrt(Math.pow(screenX - cp2Pos.x, 2) + Math.pow(screenY - cp2Pos.y, 2));
                if (cp2Dist <= 5) {
                    this.draggingControlPoint = { point: this.selectedPoint, handle: 'cp2' };
                    return;
                }
            }
        }

        // Check for point selection
        let pointClicked = false;
        for (const [id, point] of this.points) {
            const screenPos = this.worldToScreen(point.x, point.y);
            const distance = Math.sqrt(Math.pow(screenX - screenPos.x, 2) + Math.pow(screenY - screenPos.y, 2));
            if (distance <= 5) {
                pointClicked = true;
                if (e.shiftKey) {
                    if (this.selectedPoints.has(id)) {
                        this.selectedPoints.delete(id);
                        if (this.selectedPoint === point) {
                            this.selectedPoint = null;
                        }
                    } else {
                        this.selectedPoints.add(id);
                        this.selectedPoint = point;
                    }
                } else {
                    if (!this.selectedPoints.has(id)) {
                        this.selectedPoints.clear();
                        this.selectedPoints.add(id);
                    }
                    this.selectedPoint = point;
                }
                this.draggingPoint = point;
                break;
            }
        }

        if (!pointClicked && !this.isPanning) {
            if (!e.shiftKey) {
                this.selectedPoints.clear();
                this.selectedPoint = null;
            }
            this.isBoxSelecting = true;
            this.boxStartX = x;
            this.boxStartY = y;
        }

        this.lastMouseX = screenX;
        this.lastMouseY = screenY;
        this.draw();
    }

    handleMouseMove(e) {
        if (this.isPreviewMode) return;

        const rect = this.canvas.element.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToWorld(screenX, screenY);

        if (this.isTransforming && this.transformStartPoints.size > 0) {
            // Calculate scale factors based on mouse movement
            const dx = screenX - this.lastMouseX;
            const dy = screenY - this.lastMouseY;
            
            // Use shift key to constrain to horizontal/vertical
            const scaleX = e.shiftKey ? 1 : 1 + dx / 100;
            const scaleY = e.shiftKey ? 1 + dy / 100 : 1 + dy / 100;

            // Apply transformation to all selected points
            this.transformStartPoints.forEach((startPos, id) => {
                const point = this.points.get(id);
                if (point) {
                    // Transform point position
                    point.x = this.transformOrigin.x + (startPos.x - this.transformOrigin.x) * scaleX;
                    point.y = this.transformOrigin.y + (startPos.y - this.transformOrigin.y) * scaleY;

                    // Transform control points
                    if (point.cp1 && startPos.cp1) {
                        point.cp1.x = this.transformOrigin.x + (startPos.cp1.x - this.transformOrigin.x) * scaleX;
                        point.cp1.y = this.transformOrigin.y + (startPos.cp1.y - this.transformOrigin.y) * scaleY;
                    }
                    if (point.cp2 && startPos.cp2) {
                        point.cp2.x = this.transformOrigin.x + (startPos.cp2.x - this.transformOrigin.x) * scaleX;
                        point.cp2.y = this.transformOrigin.y + (startPos.cp2.y - this.transformOrigin.y) * scaleY;
                    }
                }
            });

            this.draw();
            return;
        }

        // Only pan if both spacebar is pressed and mouse is being dragged
        if (this.isPanning && this.isSpacePressed) {
            // Calculate the change in screen coordinates
            const dx = screenX - this.lastMouseX;
            const dy = screenY - this.lastMouseY;

            // Update pan in world coordinates
            this.panX -= dx / this.zoomLevel;
            this.panY -= dy / this.zoomLevel;

            this.lastMouseX = screenX;
            this.lastMouseY = screenY;
            this.draw();
            return;
        }

        if (this.isBoxSelecting) {
            const previousSelection = new Set(this.selectedPoints);
            
            if (!e.shiftKey) {
                this.selectedPoints.clear();
            }
            
            const left = Math.min(this.boxStartX, x);
            const right = Math.max(this.boxStartX, x);
            const top = Math.min(this.boxStartY, y);
            const bottom = Math.max(this.boxStartY, y);

            for (const [id, point] of this.points) {
                if (point.x >= left && point.x <= right && 
                    point.y >= top && point.y <= bottom) {
                    this.selectedPoints.add(id);
                }
            }

            this.draw();
            const boxStart = this.worldToScreen(this.boxStartX, this.boxStartY);
            const boxEnd = this.worldToScreen(x, y);
            this.drawSelectionBox(boxStart.x, boxStart.y, boxEnd.x, boxEnd.y);
            
            this.selectedPoints = previousSelection;
            return;
        }

        if (this.draggingControlPoint) {
            const { point, handle } = this.draggingControlPoint;
            point[handle].x = x;
            point[handle].y = y;
            this.draw();
            return;
        }

        if (this.draggingPoint) {
            const dx = x - this.screenToWorld(this.lastMouseX, this.lastMouseY).x;
            const dy = y - this.screenToWorld(this.lastMouseX, this.lastMouseY).y;

            for (const id of this.selectedPoints) {
                const point = this.points.get(id);
                if (point) {
                    point.x += dx;
                    point.y += dy;

                    if (point.cp1) {
                        point.cp1.x += dx;
                        point.cp1.y += dy;
                    }
                    if (point.cp2) {
                        point.cp2.x += dx;
                        point.cp2.y += dy;
                    }
                }
            }

            this.lastMouseX = screenX;
            this.lastMouseY = screenY;
            this.draw();
            this.ui.updatePointList(this.points);
        }
    }

    handleMouseUp(e) {
        if (this.isPreviewMode) return;

        // Stop panning on mouse up
        if (this.isPanning) {
            this.isPanning = false;
            // Set cursor based on whether space is still pressed
            this.canvas.element.style.cursor = this.isSpacePressed ? 'grab' : this.previousCursor;
        }

        if (this.isBoxSelecting) {
            const rect = this.canvas.element.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Calculate selection box bounds
            const left = Math.min(this.boxStartX, screenX);
            const right = Math.max(this.boxStartX, screenX);
            const top = Math.min(this.boxStartY, screenY);
            const bottom = Math.max(this.boxStartY, screenY);

            // If not adding to selection (shift not pressed), clear previous selection
            if (!e.shiftKey) {
                this.selectedPoints.clear();
            }

            // Select points within the box
            for (const [id, point] of this.points) {
                const screenPos = this.worldToScreen(point.x, point.y);
                if (screenPos.x >= left && screenPos.x <= right && 
                    screenPos.y >= top && screenPos.y <= bottom) {
                    this.selectedPoints.add(id);
                    this.selectedPoint = point; // Set the last point in box as selected point
                }
            }

            this.isBoxSelecting = false;
            this.draw();
        }

        if (this.isTransforming && this.transformStartPoints.size > 0) {
            this.transformStartPoints.clear();
            this.saveState('Transform Points');
            return;
        }

        if (this.draggingPoint || this.draggingControlPoint) {
            this.draggingPoint = null;
            this.draggingControlPoint = null;
            this.saveState('Move points');
        }
    }

    handleContextMenu(e) {
        e.preventDefault();
        const pos = getMousePos(this.canvas.element, e);
        const point = findClosestPoint(this.points.values(), pos);
        
        const menuItems = [
            {
                label: 'Add Point',
                action: () => this.addPoint(pos.x, pos.y)
            }
        ];
        
        if (point) {
            menuItems.push({
                label: 'Delete Point',
                action: () => this.deletePoint(point)
            });
            menuItems.push({
                label: 'Toggle Point Type',
                action: () => this.togglePointType(point)
            });
            menuItems.push({
                label: point.starred ? 'Unstar Point' : 'Star Point',
                action: () => {
                    point.starred = !point.starred;
                    this.draw();
                }
            });
        }
        
        this.ui.showContextMenu(e.clientX, e.clientY, menuItems);
    }

    addPoint(x, y) {
        const name = generateUniquePointName(this.points);
        const canvasWidth = this.canvas.element.width;
        let finalX;

        if (this.selectedPoint) {
            // Add new point 100 pixels to the right of the selected point
            finalX = Math.min(this.selectedPoint.x + 100, canvasWidth - 50);

            // If we would go off screen, try to find a gap
            if (finalX >= canvasWidth - 50) {
                // Get all x positions
                const positions = Array.from(this.points.values())
                    .map(p => p.x)
                    .sort((a, b) => a - b);
                
                // Find the first gap after the selected point that can fit a new point
                let gapFound = false;
                for (let i = 0; i < positions.length - 1; i++) {
                    if (positions[i] >= this.selectedPoint.x) {
                        const gap = positions[i + 1] - positions[i];
                        if (gap >= 100) {
                            finalX = positions[i] + 50;
                            gapFound = true;
                            break;
                        }
                    }
                }

                if (!gapFound) {
                    this.ui.showToast('Warning: Canvas is getting crowded', 'info');
                    finalX = canvasWidth - 50;
                }
            }
        } else {
            // Original behavior when no point is selected
            let maxX = 50;
            this.points.forEach(point => {
                maxX = Math.max(maxX, point.x);
            });
            
            finalX = maxX + 100;
            if (finalX >= canvasWidth - 50) {
                const positions = Array.from(this.points.values())
                    .map(p => p.x)
                    .sort((a, b) => a - b);
                
                let gapStart = 50;
                let gapFound = false;
                
                for (let i = 0; i < positions.length; i++) {
                    const current = positions[i];
                    const space = current - gapStart;
                    if (space >= 100) {
                        finalX = gapStart + 50;
                        gapFound = true;
                        break;
                    }
                    gapStart = current;
                }
                
                if (!gapFound) {
                    this.ui.showToast('Warning: Canvas is getting crowded', 'info');
                    finalX = canvasWidth - 50;
                }
            }
        }
        
        // Create new point as sharp type
        const point = new Point(finalX, this.baselineY, name, '#ff0000', 'sharp');
        this.points.set(name, point);
        this.selectPoint(point);
        this.saveState('Add Point');
        this.draw();
        this.ui.showToast('Point added', 'success');
    }

    deletePoint(point) {
        if (this.points.size <= 2) {
            this.ui.showToast('Cannot delete: minimum 2 points required', 'error');
            return;
        }
        
        this.points.delete(point.name);
        if (this.selectedPoint === point) {
            this.selectedPoint = null;
        }
        this.saveState('Delete Point');
        this.draw();
        this.ui.showToast('Point deleted', 'success');
    }

    togglePointType(point) {
        point.type = point.type === 'smooth' ? 'sharp' : 'smooth';
        this.saveState('Toggle Point Type');
        this.draw();
        this.ui.showToast(`Point type changed to ${point.type}`, 'info');
    }

    selectPoint(point) {
        this.selectedPoint = point;
        this.ui.updatePointList(this.points, point, (p) => this.selectPoint(p));
        this.draw();
    }

    toggleSelectedPointType() {
        if (this.selectedPoint) {
            this.selectedPoint.type = this.selectedPoint.type === 'smooth' ? 'sharp' : 'smooth';
            this.saveState('Toggle Point Type');
            this.draw();
            this.ui.showToast(`Point type changed to ${this.selectedPoint.type}`, 'info');
        } else {
            this.ui.showToast('Please select a point first', 'error');
        }
    }

    toggleSelectedPointStar() {
        if (this.selectedPoint) {
            this.selectedPoint.starred = !this.selectedPoint.starred;
            this.saveState('Toggle Star');
            this.draw();
            this.ui.showToast(
                `Point ${this.selectedPoint.starred ? 'starred' : 'unstarred'}`,
                'info'
            );
        } else {
            this.ui.showToast('Please select a point first', 'error');
        }
    }

    loadSavedWave() {
        // Create a file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const waveData = JSON.parse(event.target.result);
                    this.points.clear(); // Clear existing points
                    
                    // Create new Point instances from saved data
                    waveData.points.forEach(pointData => {
                        const point = new Point(
                            pointData.x,
                            pointData.y,
                            pointData.name,
                            pointData.color,
                            pointData.type
                        );
                        
                        // Restore control points
                        point.cp1 = { ...pointData.cp1 };
                        point.cp2 = { ...pointData.cp2 };
                        
                        // Restore starred state
                        point.starred = pointData.starred || false;
                        
                        // Add to points Map with name as key
                        this.points.set(point.name, point);
                    });
                    
                    this.draw(); // Redraw the wave
                    this.ui.showToast('Wave loaded from file', 'success');
                    return true;
                } catch (error) {
                    console.error('Error loading wave:', error);
                    this.ui.showToast('Error loading wave file', 'error');
                    return false;
                }
            };
            reader.readAsText(file);
        };
        
        // Only trigger file input click if called from a user action
        if (document.hasFocus()) {
            input.click();
            return true;
        }
        return false;
    }

    toggleGuides() {
        this.canvas.showGuides = !this.canvas.showGuides;
        
        // Update menu item checkmark
        const toggleGuidesItem = document.getElementById('toggle-guides');
        if (toggleGuidesItem) {
            if (this.canvas.showGuides) {
                toggleGuidesItem.classList.add('checked');
            } else {
                toggleGuidesItem.classList.remove('checked');
            }
        }
        
        this.draw();
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        
        // Update menu item checkmark
        const toggleLabelsItem = document.getElementById('toggle-labels');
        if (toggleLabelsItem) {
            if (this.showLabels) {
                toggleLabelsItem.classList.add('checked');
            } else {
                toggleLabelsItem.classList.remove('checked');
            }
        }
        
        this.draw();
    }

    draw() {
        if (this.isPreviewMode) return;
        
        if (!this.canvas.ctx) {
            console.error('No canvas context available');
            return;
        }

        this.canvas.clear();

        // Save the current context state
        this.canvas.ctx.save();

        // Apply zoom and pan transformation
        this.canvas.ctx.translate(-this.panX * this.zoomLevel, -this.panY * this.zoomLevel);
        this.canvas.ctx.scale(this.zoomLevel, this.zoomLevel);

        if (this.canvas.showGuides) {
            this.canvas.drawGuides(this.baselineY);
        }

        if (this.points.size === 0) {
            this.canvas.ctx.restore();
            return;
        }

        try {
            this.canvas.drawCurve(this.points, this.highlightedSegment);
            
            for (const [id, point] of this.points) {
                const isSelected = this.selectedPoints.has(id);
                
                if (point === this.selectedPoint && point.type === 'smooth') {
                    this.canvas.drawControlPoints(point);
                }
                
                this.canvas.drawPoint(point, isSelected);
                
                if (this.showLabels) {
                    this.canvas.drawLabel(point);
                }
            }
        } finally {
            this.canvas.ctx.restore();
        }
    }

    saveWave() {
        const waveData = {
            points: Array.from(this.points.values()).map(point => ({
                x: point.x,
                y: point.y,
                name: point.name,
                color: point.color,
                type: point.type,
                starred: point.starred,
                cp1: { x: point.cp1.x, y: point.cp1.y },
                cp2: { x: point.cp2.x, y: point.cp2.y }
            }))
        };
        
        // Create a Blob containing the wave data
        const blob = new Blob([JSON.stringify(waveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link element and trigger the download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'waveform.json';
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.ui.showToast('Wave saved to file', 'success');
    }

    exportForMonitor() {
        // Get the points array sorted by x position
        const points = Array.from(this.points.values())
            .sort((a, b) => a.x - b.x);

        // Find the wave width
        const startX = points[0].x;
        const endX = points[points.length - 1].x;
        const width = endX - startX;

        // Calculate baseline ratio
        const baselineRatio = this.baselineY / this.canvas.height;

        // Normalize the wave data
        const normalizedPoints = points.map(point => {
            // Normalize x to [0, 1] range
            const x = (point.x - startX) / width;
            
            // Normalize y to [-1, 1] range relative to baseline
            const y = (this.baselineY - point.y) / (this.canvas.height / 4);

            return {
                x,
                y,
                type: point.type,
                cp1: point.cp1 ? {
                    x: (point.cp1.x - startX) / width,
                    y: (this.baselineY - point.cp1.y) / (this.canvas.height / 4)
                } : null,
                cp2: point.cp2 ? {
                    x: (point.cp2.x - startX) / width,
                    y: (this.baselineY - point.cp2.y) / (this.canvas.height / 4)
                } : null
            };
        });

        return {
            points: normalizedPoints,
            metadata: {
                originalWidth: width,
                originalHeight: this.canvas.height,
                baselineRatio: baselineRatio,
                originalBaseline: this.baselineY
            }
        };
    }

    // Add history management methods
    saveState(actionName) {
        if (this.isUndoRedoAction) return;

        // Convert points to a serializable format
        const state = {
            points: Array.from(this.points.values()).map(point => ({
                x: point.x,
                y: point.y,
                name: point.name,
                color: point.color,
                type: point.type,
                starred: point.starred,
                cp1: { ...point.cp1 },
                cp2: { ...point.cp2 }
            })),
            actionName
        };

        // Remove any states after current index
        this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        
        // Add new state
        this.history.push(state);
        this.currentHistoryIndex++;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentHistoryIndex--;
        }

        // Save current state to localStorage
        try {
            localStorage.setItem('waveformState', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.ui.showToast('Error saving state', 'error');
        }
    }

    restoreState(state) {
        this.points.clear();
        
        state.points.forEach(pointData => {
            const point = new Point(
                pointData.x,
                pointData.y,
                pointData.name,
                pointData.color,
                pointData.type
            );
            point.cp1 = { ...pointData.cp1 };
            point.cp2 = { ...pointData.cp2 };
            point.starred = pointData.starred;
            this.points.set(point.name, point);
        });

        this.draw();
        this.ui.updatePointList(this.points, this.selectedPoint, (p) => this.selectPoint(p));
    }

    undo() {
        if (this.currentHistoryIndex <= 0) {
            this.ui.showToast('Nothing to undo', 'info');
            return;
        }

        this.isUndoRedoAction = true;
        this.currentHistoryIndex--;
        this.restoreState(this.history[this.currentHistoryIndex]);
        this.ui.showToast(`Undo: ${this.history[this.currentHistoryIndex].actionName}`, 'info');
        this.isUndoRedoAction = false;
    }

    redo() {
        if (this.currentHistoryIndex >= this.history.length - 1) {
            this.ui.showToast('Nothing to redo', 'info');
            return;
        }

        this.isUndoRedoAction = true;
        this.currentHistoryIndex++;
        this.restoreState(this.history[this.currentHistoryIndex]);
        this.ui.showToast(`Redo: ${this.history[this.currentHistoryIndex].actionName}`, 'info');
        this.isUndoRedoAction = false;
    }

    // Add new method for loading from localStorage
    loadFromLocalStorage() {
        try {
            const savedState = localStorage.getItem('waveformState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.restoreState(state);
                this.ui.showToast('Restored previous session', 'info');
                return true;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
        return false;
    }

    // Add new method for preview mode
    togglePreviewMode() {
        this.isPreviewMode = !this.isPreviewMode;
        
        if (this.isPreviewMode) {
            this.ui.showToast('Preview Mode Enabled', 'info');
            this.startPreviewAnimation();
        } else {
            this.ui.showToast('Preview Mode Disabled', 'info');
            this.stopPreviewAnimation();
            this.draw(); // Redraw normal view
        }
    }

    startPreviewAnimation() {
        // Cancel any existing animation
        if (this.previewAnimationId) {
            cancelAnimationFrame(this.previewAnimationId);
        }

        // Calculate the total width of one complete wave cycle
        const points = Array.from(this.points.values());
        if (points.length < 2) return;

        const animate = () => {
            this.canvas.clear();
            
            // Fill background with darker color for better visibility
            this.canvas.ctx.fillStyle = '#001100';
            this.canvas.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw baseline and guides if enabled
            this.canvas.ctx.strokeStyle = '#333';
            this.canvas.ctx.lineWidth = 1;
            this.canvas.ctx.beginPath();
            this.canvas.ctx.moveTo(0, this.baselineY);
            this.canvas.ctx.lineTo(this.canvas.width, this.baselineY);
            this.canvas.ctx.stroke();

            if (this.canvas.showGuides) {
                this.canvas.drawGuides(this.baselineY);
            }

            // Draw multiple copies of the wave to create continuous effect
            this.drawPreviewWave();
            
            // Move the offset for next frame (increased speed)
            this.previewOffset -= 2; // Increased from 1 to 2 for better visibility
            
            // Reset offset when it exceeds one wave width to create seamless loop
            const waveWidth = points[points.length - 1].x - points[0].x;
            if (Math.abs(this.previewOffset) >= waveWidth) {
                this.previewOffset = 0;
            }
            
            this.previewAnimationId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    drawPreviewWave() {
        const points = Array.from(this.points.values());
        if (points.length < 2) return;

        const waveWidth = points[points.length - 1].x - points[0].x;
        const copies = Math.ceil(this.canvas.width / waveWidth) + 1;
        
        // Draw multiple copies of the wave
        for (let i = 0; i < copies; i++) {
            const offset = this.previewOffset + (i * waveWidth);
            this.drawWaveSegment(offset);
        }
    }

    drawWaveSegment(offset) {
        const points = Array.from(this.points.values());
        
        // Save context state
        this.canvas.ctx.save();
        
        // Set up line style with glow effect
        this.canvas.ctx.strokeStyle = '#00ff00'; // Medical monitor green color
        this.canvas.ctx.lineWidth = 2;
        this.canvas.ctx.shadowColor = '#00ff00';
        this.canvas.ctx.shadowBlur = 4;
        this.canvas.ctx.lineCap = 'round';
        this.canvas.ctx.lineJoin = 'round';
        
        // Begin the path
        this.canvas.ctx.beginPath();
        this.canvas.ctx.moveTo(points[0].x + offset, points[0].y);
        
        // Draw the wave segments
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            
            if (next.type === 'smooth' && current.type === 'smooth') {
                // Use control points for smooth curves
                const cp1 = current.cp2 || { 
                    x: current.x + (next.x - current.x) / 3, 
                    y: current.y 
                };
                const cp2 = next.cp1 || { 
                    x: next.x - (next.x - current.x) / 3, 
                    y: next.y 
                };
                
                this.canvas.ctx.bezierCurveTo(
                    cp1.x + offset, cp1.y,
                    cp2.x + offset, cp2.y,
                    next.x + offset, next.y
                );
            } else {
                // Draw straight line for sharp points
                this.canvas.ctx.lineTo(next.x + offset, next.y);
            }
        }
        
        // Stroke the path
        this.canvas.ctx.stroke();
        
        // Restore context state
        this.canvas.ctx.restore();
    }

    stopPreviewAnimation() {
        if (this.previewAnimationId) {
            cancelAnimationFrame(this.previewAnimationId);
            this.previewAnimationId = null;
        }
        this.previewOffset = 0;
    }

    // Add method to draw selection box
    drawSelectionBox(startX, startY, endX, endY) {
        const ctx = this.canvas.ctx;
        
        // Calculate dimensions handling negative values
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        ctx.save();
        
        // Draw semi-transparent fill
        ctx.fillStyle = 'rgba(0, 149, 255, 0.1)';
        ctx.fillRect(left, top, width, height);
        
        // Draw dashed border
        ctx.strokeStyle = '#0095ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(left, top, width, height);
        
        ctx.restore();
    }

    // Add keyboard event handler for Escape key
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.selectedPoints.clear();
            this.selectedPoint = null;
            this.isBoxSelecting = false;
            this.draw();
        } else if (e.code === 'Space') {
            e.preventDefault();
            this.isSpacePressed = true;
            // Store current cursor before changing to grab
            this.previousCursor = this.canvas.element.style.cursor || 'default';
            if (!this.isPanning) {
                this.canvas.element.style.cursor = 'grab';
            }
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            this.isPanning = false;
            // Restore previous cursor
            this.canvas.element.style.cursor = this.previousCursor;
        }
    }

    // Add methods for coordinate transformation
    worldToScreen(x, y) {
        return {
            x: (x - this.panX) * this.zoomLevel,
            y: (y - this.panY) * this.zoomLevel
        };
    }

    screenToWorld(x, y) {
        return {
            x: x / this.zoomLevel + this.panX,
            y: y / this.zoomLevel + this.panY
        };
    }

    handleWheel(e) {
        if (this.isPreviewMode) return;

        e.preventDefault();

        const rect = this.canvas.element.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert mouse position to world coordinates before zoom
        const worldPosBeforeZoom = this.screenToWorld(mouseX, mouseY);

        // Calculate new zoom level
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomLevel = Math.min(Math.max(this.zoomLevel * zoomFactor, this.minZoom), this.maxZoom);

        // Convert mouse position to world coordinates after zoom
        const worldPosAfterZoom = this.screenToWorld(mouseX, mouseY);

        // Adjust pan to keep the point under mouse cursor fixed
        this.panX += worldPosAfterZoom.x - worldPosBeforeZoom.x;
        this.panY += worldPosAfterZoom.y - worldPosBeforeZoom.y;

        this.draw();
    }

    moveSelectedPointsToBaseline() {
        if (this.selectedPoints.size === 0) {
            this.ui.showToast('Please select at least one point', 'error');
            return;
        }

        for (const id of this.selectedPoints) {
            const point = this.points.get(id);
            if (point) {
                // Calculate the vertical movement needed
                const dy = this.baselineY - point.y;
                
                // Move the point to the baseline
                point.y = this.baselineY;

                // Move control points vertically by the same amount
                if (point.cp1) {
                    point.cp1.y += dy;
                }
                if (point.cp2) {
                    point.cp2.y += dy;
                }
            }
        }

        this.saveState('Move to Baseline');
        this.draw();
        this.ui.showToast('Points moved to baseline', 'success');
    }

    toggleTransformMode() {
        if (this.selectedPoints.size < 2) {
            this.ui.showToast('Select at least 2 points to transform', 'error');
            return;
        }

        this.isTransforming = !this.isTransforming;
        const transformButton = document.getElementById('transform-points');
        
        if (this.isTransforming) {
            this.canvas.element.style.cursor = 'move';
            if (transformButton) transformButton.style.backgroundColor = '#1e90ff';
            this.ui.showToast('Transform mode: Drag to scale points. Hold Shift to constrain axis.', 'info');
        } else {
            this.canvas.element.style.cursor = 'default';
            if (transformButton) transformButton.style.backgroundColor = '';
            this.transformStartPoints.clear();
            this.draw();
        }
    }
} 