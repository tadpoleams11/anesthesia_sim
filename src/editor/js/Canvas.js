/**
 * Canvas class handling all drawing operations for the waveform editor.
 * IMPORTANT: This class is responsible for the core visualization of points, curves, and control handles.
 * Any changes to drawing logic may affect the entire editor's behavior.
 */
export class Canvas {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.element = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;  // Logical width
        this.height = 0; // Logical height
        this.dpr = window.devicePixelRatio || 1;
        this.showGuides = false; // Add guide visibility state
        this.setupCanvas();
    }

    /**
     * Sets up the canvas dimensions based on its container.
     * CAUTION: This affects the coordinate space of all drawing operations.
     * Changing this may require adjusting point positions and control handle calculations.
     */
    setupCanvas() {
        // Get the container's computed dimensions
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        // Store logical dimensions
        this.width = rect.width;
        this.height = rect.height;
        
        // Set the canvas size to match its CSS size
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        // Set actual canvas dimensions accounting for device pixel ratio
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        
        // Reset the context state
        this.ctx = this.canvas.getContext('2d');
        
        // Scale the context to account for the device pixel ratio
        this.ctx.scale(this.dpr, this.dpr);
        
        // Clear any existing content
        this.clear();
    }

    clear() {
        // Use logical dimensions for clearing
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draws a point with different visual representations for smooth and sharp types.
     * CRITICAL: The visual distinction between smooth and sharp points is essential for UX.
     * - Smooth points: Circles with control handles for bezier curves
     * - Sharp points: Squares with no control handles, creating straight line segments
     * 
     * @param {Point} point - The point to draw
     * @param {boolean} isSelected - Whether the point is currently selected
     */
    drawPoint(point, isSelected = false) {
        const size = isSelected ? 16 : 12;
        
        // Use yellow fill for starred points, otherwise use point's color
        this.ctx.fillStyle = point.starred ? '#FFD700' : point.color;
        
        if (point.type === 'sharp') {
            // Draw square for sharp points
            this.ctx.beginPath();
            this.ctx.rect(point.x - size/2, point.y - size/2, size, size);
            this.ctx.fill();
        } else {
            // Draw circle for smooth points
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, size/2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        if (isSelected) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    /**
     * Draws control points and their connecting lines for smooth points.
     * IMPORTANT: Control points are only shown for smooth points, not sharp points.
     * This visual feedback is crucial for users to understand point behavior.
     * 
     * @param {Point} point - The point whose control handles should be drawn
     */
    drawControlPoints(point) {
        // Only draw control points for smooth points
        if (point.type === 'sharp') return;

        // Draw control point lines
        this.ctx.beginPath();
        this.ctx.moveTo(point.cp1.x, point.cp1.y);
        this.ctx.lineTo(point.x, point.y);
        this.ctx.lineTo(point.cp2.x, point.cp2.y);
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Draw control points
        this.ctx.beginPath();
        this.ctx.arc(point.cp1.x, point.cp1.y, 4, 0, Math.PI * 2);
        this.ctx.arc(point.cp2.x, point.cp2.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#666';
        this.ctx.fill();
    }

    /**
     * Draws the entire curve with optional segment highlighting.
     * Highlighting only applies to curved segments (between two smooth points).
     * @param {Map<string, Point>} points - All points in the curve
     * @param {Object} highlightSegment - Optional segment to highlight {startPoint, endPoint}
     */
    drawCurve(points, highlightSegment = null) {
        if (points.size < 2) return;

        const pointArray = Array.from(points.values());
        
        // Draw non-highlighted segments first
        this.ctx.beginPath();
        this.ctx.moveTo(pointArray[0].x, pointArray[0].y);
        
        for (let i = 1; i < pointArray.length; i++) {
            const currentPoint = pointArray[i];
            const prevPoint = pointArray[i - 1];
            
            // Check if this segment should be highlighted
            const isHighlightedSegment = highlightSegment && 
                ((prevPoint === highlightSegment.startPoint && currentPoint === highlightSegment.endPoint) ||
                 (prevPoint === highlightSegment.endPoint && currentPoint === highlightSegment.startPoint));

            // Skip if this is the highlighted segment and both points are smooth
            if (isHighlightedSegment && currentPoint.type === 'smooth' && prevPoint.type === 'smooth') {
                // If this is not the first segment, we need to move to the start of the next segment
                if (i < pointArray.length - 1) {
                    this.ctx.moveTo(currentPoint.x, currentPoint.y);
                }
                continue;
            }
            
            if (currentPoint.type === 'smooth' && prevPoint.type === 'smooth') {
                this.ctx.bezierCurveTo(
                    prevPoint.cp2.x, prevPoint.cp2.y,
                    currentPoint.cp1.x, currentPoint.cp1.y,
                    currentPoint.x, currentPoint.y
                );
            } else {
                this.ctx.lineTo(currentPoint.x, currentPoint.y);
            }
        }
        
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw highlighted segment if exists and both points are smooth
        if (highlightSegment) {
            const { startPoint, endPoint } = highlightSegment;
            
            // Only highlight if both points are smooth
            if (startPoint.type === 'smooth' && endPoint.type === 'smooth') {
                this.ctx.beginPath();
                this.ctx.moveTo(startPoint.x, startPoint.y);
                this.ctx.bezierCurveTo(
                    startPoint.cp2.x, startPoint.cp2.y,
                    endPoint.cp1.x, endPoint.cp1.y,
                    endPoint.x, endPoint.y
                );
                this.ctx.strokeStyle = '#00ff00'; // Bright green for highlight
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }
        }
    }

    /**
     * Draws a label for a point.
     * The label is positioned above the point and includes the point's name.
     * Labels for starred points are drawn in bold.
     * 
     * @param {Point} point - The point whose label should be drawn
     */
    drawLabel(point) {
        // Set font weight based on whether the point is starred
        this.ctx.font = `${point.starred ? 'bold' : 'normal'} 12px Arial`;
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        
        // Position the label above the point
        const labelY = point.y - 20; // 20 pixels above the point
        
        // Draw the label with a slight shadow for better visibility
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(point.name, point.x, labelY);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
    }

    /**
     * Draws guide lines on the canvas.
     * @param {number} baselineY - The Y position of the baseline
     */
    drawGuides(baselineY) {
        if (!this.showGuides) return;

        this.ctx.save();
        
        // Draw baseline
        this.ctx.beginPath();
        this.ctx.moveTo(0, baselineY);
        this.ctx.lineTo(this.width, baselineY);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Draw vertical grid lines
        const gridSpacing = 100; // pixels between vertical lines
        for (let x = gridSpacing; x < this.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }

        // Draw monitor guide rectangle
        const monitorHeight = 100; // Monitor's waveform height
        const rectTop = baselineY - monitorHeight/2; // Center around baseline
        
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)'; // Green to match monitor color
        this.ctx.setLineDash([2, 2]); // Different dash pattern to distinguish
        this.ctx.lineWidth = 1;
        
        // Draw rectangle
        this.ctx.strokeRect(50, rectTop, this.width - 100, monitorHeight);
        
        // Draw center line (baseline) in rectangle
        this.ctx.beginPath();
        this.ctx.moveTo(50, baselineY);
        this.ctx.lineTo(this.width - 50, baselineY);
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.stroke();
        
        this.ctx.restore();
    }
} 