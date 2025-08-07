// Waveform patterns and rendering logic :)
class WaveformRenderer {
    constructor(canvas, type) {
        this.canvas = canvas;
        this.type = type;
        this.ctx = canvas.getContext('2d');
        this.printHead = 0;
        this.data = [];
        this.customWaveform = null;
        this.waveformOffset = 0;
        this.baselineY = 0; 
        
        // Responsive canvas sizing
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Re-init data array to match new width
        const width = Math.floor(this.canvas.width / window.devicePixelRatio);
        this.data = new Array(width).fill(0);
        
        // Set default baseline to 2/3 of height
        const height = this.canvas.height / window.devicePixelRatio;
        this.baselineY = height * 0.67;
    }

    setCustomWaveform(waveformData) {
        this.customWaveform = waveformData;
        
        // Update baseline if provided in metadata
        if (waveformData.metadata && typeof waveformData.metadata.baselineRatio === 'number') {
            const height = this.canvas.height / window.devicePixelRatio;
            this.baselineY = height * waveformData.metadata.baselineRatio;
        }
    }

    getColor() {
        const colors = {
            vte: '#00FF00',
            paw: '#00FFFF',
            etco2: '#FFFFFF',
            sev: "#fafd24ff"
        };
        return colors[this.type] || "#FFF";
    }

    generateDataPoint(time) {
        if (this.customWaveform && this.type === 'vte') {
            // Use custom waveform for VTE
            const points = this.customWaveform.points;
            const cycleTime = (time * 12 / 60) % 1; // 12 cycles per minute

            // Find the points that bracket the current time
            let startPoint = points[0];
            let endPoint = points[1];
            let found = false;
            
            for (let i = 1; i < points.length; i++) {
                if (points[i].x > cycleTime) {
                    startPoint = points[i - 1];
                    endPoint = points[i];
                    found = true;
                    break;
                }
            }

            // If we didn't find bracketing points, use the last and first points to close the loop
            if (!found) {
                startPoint = points[points.length - 1];
                endPoint = points[0];
                // Adjust cycleTime for the wrap-around
                const t = (cycleTime - startPoint.x) / (1 - startPoint.x + endPoint.x);
                
                if (startPoint.type === 'smooth' && endPoint.type === 'smooth') {
                    return this.cubicInterpolation(
                        startPoint.y,
                        startPoint.cp2.y,
                        endPoint.cp1.y,
                        endPoint.y,
                        t
                    ) * 840;
                } else {
                    return (startPoint.y + t * (endPoint.y - startPoint.y)) * 840;
                }
            }

            // Calculate interpolation for normal case
            const t = (cycleTime - startPoint.x) / (endPoint.x - startPoint.x);
            
            // If both points are smooth, use cubic interpolation
            if (startPoint.type === 'smooth' && endPoint.type === 'smooth') {
                return this.cubicInterpolation(
                    startPoint.y,
                    startPoint.cp2.y,
                    endPoint.cp1.y,
                    endPoint.y,
                    t
                ) * 840; // Scale to match display value
            } else {
                // Use linear interpolation for sharp points
                return (startPoint.y + t * (endPoint.y - startPoint.y)) * 840;
            }
        }

        // Fall back to original generation for other types
        const breathRate = 12; // breaths per minute
        const cycleTime = (time * breathRate / 60) % 1;

        switch(this.type) {
            case 'vte':
                // Ventilation waveform: more natural inspiration/expiration
                if (cycleTime < 0.3) { // inspiration
                    return 40 * Math.pow(cycleTime/0.3, 2);
                } else { // expiration
                    return 40 * Math.pow(1 - (cycleTime-0.3)/0.7, 0.5);
                }
            case 'paw':
                // Airway pressure: more realistic pressure curve
                if (cycleTime < 0.2) { // pressure ramp up
                    return 30 * (cycleTime/0.2);
                } else if (cycleTime < 0.3) { // pressure plateau
                    return 30;
                } else if (cycleTime < 0.4) { // pressure release
                    return 30 * (1 - (cycleTime-0.3)/0.1);
                } else { // PEEP level
                    return 5;
                }
            case 'etco2':
                // End-tidal CO2: more natural plateau
                if (cycleTime < 0.3) { // inspiration (washout)
                    return 5;
                } else if (cycleTime < 0.4) { // rapid rise
                    return 5 + 32 * ((cycleTime-0.3)/0.1);
                } else if (cycleTime < 0.8) { // plateau
                    return 37;
                } else { // fall
                    return 37 * (1 - (cycleTime-0.8)/0.2);
                }
            default:
                return 0;
        }
    }

    cubicInterpolation(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        // Cubic Bezier formula
        return (1 - t3) * p0 +
               3 * (1 - t2) * t * p1 +
               3 * (1 - t) * t2 * p2 +
               t3 * p3;
    }

    update(time) {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Clear only the area around the print head
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.printHead - 2, 0, 24, height);

        // Generate new data point
        const newPoint = this.generateDataPoint(time);
        this.data[this.printHead] = newPoint;

        // Draw waveform
        this.ctx.strokeStyle = this.getColor();
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        // Draw from print head back to start, breaking the path at wrap-around
        let lastX = null;
        for(let i = 0; i < width; i++) {
            const x = (this.printHead - i + width) % width;
            const y = this.baselineY - this.data[x]; // Use baselineY instead of height/2
            
            if(i === 0) {
                this.ctx.moveTo(x, y);
                lastX = x;
            } else {
                // Break the path if we're wrapping around
                if (x > lastX) {
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
                lastX = x;
            }
        }
        
        this.ctx.stroke();

        // Draw the visual mask (black rectangle) on top
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.printHead, 0, 15, height);

        // Move print head (increase speed for smoother animation)
        this.printHead = (this.printHead + 1) % width;
    }
}

// P-V Loop renderer zone
class PVLoopRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // call the resize canvas func, listen for resizing window  
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Add fade effect for trail THIS IS HOW LONG THE TRAIL IS 
        this.fadePoints = [];
        this.maxPoints = 500; // Points for smooth loop
    }



    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.setTransform(1, 0, 0, 0.5, 0, 0);
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    update(time) {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw axes
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1;
        
        // Vertical axis (Volume)
        this.ctx.beginPath();
        this.ctx.moveTo(width/6, height-20);
        this.ctx.lineTo(width/6, 20);
        this.ctx.stroke();
        
        // Horizontal axis (Pressure)
        this.ctx.beginPath();
        this.ctx.moveTo(width/6, height-20);
        this.ctx.lineTo(width-20, height-20);
        this.ctx.stroke();

        // Generate loop point with realistic breathing mechanics
        const cycle = (time * 12/60) % 1; // 12 breaths per minute
        let pressure, volume;
        
        if(cycle < 0.3) { // Inspiration (30% of cycle)
            const t = cycle/0.3;
            pressure = 5 + 25 * Math.pow(t, 2); // PEEP of 5, max 30 cmH2O
            volume = 500 * Math.pow(t, 1.5); // Non-linear volume increase
        } else { // Expiration (70% of cycle)
            const t = (cycle - 0.3)/0.7;
            pressure = 30 * Math.pow(1-t, 0.5) + 5; // Exponential decay to PEEP
            volume = 500 * Math.pow(1-t, 2); // Faster initial exhale
        }

        // Scale and offset points
        const x = width/6 + (pressure/40) * (width - width/6 - 20);
        const y = height-20 - (volume/600) * (height - 40);
        
        // Store point with opacity for fade effect
        this.fadePoints.push({x, y, opacity: 1});
        if(this.fadePoints.length > this.maxPoints) this.fadePoints.shift();

        // Draw loop with fade effect
        this.fadePoints.forEach((point, i) => {
            const opacity = 0.4 + 0.7 * (i / this.fadePoints.length);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`; // White color with fade
            this.ctx.lineWidth = 3; // Slightly thicker line
            
            if(i > 0) {
                const prevPoint = this.fadePoints[i-1];
                this.ctx.beginPath();
                this.ctx.moveTo(prevPoint.x, prevPoint.y);
                this.ctx.lineTo(point.x, point.y);
                this.ctx.stroke();
            }
        });
    }
}

// Main monitor component
class AnaesthesiaMonitor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedControl = null;
        this.knobRotation = 0;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    min-height: 0;
                }
                .monitor {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: #000;
                    min-width: 0;
                    min-height: 0;
                }
                .display {
                    flex: 1 1 0;
                    min-height: 0;
                    min-width: 0;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                }
                .status-bar {
                    background: #666;
                    color: white;
                    padding: 8px;
                    transition: all 0.3s;
                }
                .status-bar.warning {
                    background: yellow;
                    color: black;
                }
                .waveform-area {
                    flex: 1 1 0;
                    min-height: 0;
                    display: grid;
                    grid-template-columns: minmax(160px, 25%) 1fr;
                    gap: 10px;
                    margin: 10px 0;
                    
                }
                .pv-loop {
                    width: 100%;
                    height: 100%;
                    aspect-ratio: 1 / 1;
                    border: 1px solid #333;
                    display: block;
                    background: #000;
                }
                .waveforms {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    height: 100%;
                    min-height: 0;
                  
                }
                .waveform {
                    flex: 1 1 0;
                    min-height: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                   
                }
                .waveform-display {
                    flex: 1 1 0;
                    min-width: 0;
                    min-height: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    border: 1px solid #333;
                 
}
                .value-display {
                    width: 100px;
                    text-align: right;
                    font-size: 24px;
                }
                 .gas-monitoring {
                    padding: 10px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 5px;
                    display: flex;
                    flex-direction: row;
                    gap: 5px;
                    min-height: 0;
                }
                .gas {
                    display: flex;
                    flex: 1 1 0;
                    align-items: center;
                    gap: 5px;
                    font-size: 20 px
                    
                }




                .controls {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    padding: 10px;
                }
                .control-set {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
                .control-dial {
                    --arc-length: 0deg;
                    width: 60px;
                    height: 60px;
                    border: 2px solid #666;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    position: relative;
                    transition: all 0.3s ease;
                    white-space: pre-line;
                    text-align: center;
                    color: white;
                }
                .control-dial > * {
                    position: relative;
                    z-index: 3;
                    background: rgba(0, 0, 0, 0.7);
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .control-dial.selected {
                    border-color: #fafd24ff;
                    box-shadow: 0 0 10px rgba(255, 255, 0, 0.51);
                }
                .control-dial::before {
                    content: '';
                    position: absolute;
                    top: -4px;
                    left: -4px;
                    right: -4px;
                    bottom: -4px;
                    background: conic-gradient(white var(--arc-length), transparent 0);
                    border-radius: 50%;
                    transform-origin: center;
                    transform: rotate(-90deg);
                    transition: all 0.3s ease;
                    z-index: 1;
                }
                .control-dial::after {
                    content: '';
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    right: 4px;
                    bottom: 4px;
                    background: black;
                    border-radius: 50%;
                    z-index: 2;
                }
               
                .physical-panel {
                    height: 80px;
                    background: #444;
                    padding: 10px;
                    display: flex;
                    align-items: center;
                }
                .rotary-knob {
                    width: 60px;
                    height: 60px;
                    background: blue;
                    border-radius: 50%;
                    cursor: pointer;
                    position: relative;
                    transition: transform 0.1s ease;
                }
                .indicator {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 4px;
                    height: 24px;
                    background: white;
                    transform: translate(-50%, -50%);
                    border-radius: 2px;
                }
                .load-waveform {
                    background: none;
                    border: 1px solid #333;
                    color: #666;
                    padding: 4px 8px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.3s;
                }
                .load-waveform:hover {
                    background: #333;
                    color: #fff;
                }
            </style>



            <div class="monitor">
                <div class="display">
                    <div class="status-bar">Status message goes here</div>
                    <div class="waveform-area">
                        <canvas class="pv-loop" id="pvLoop"></canvas>
                        <div class="waveforms">
                            <div class="waveform">
                                <canvas class="waveform-display" id="vteWaveform"></canvas>
                                <div class="value-display" style="color: #0f0">840 mL</div>
                                <button class="load-waveform" title="Load Custom Waveform">
                                    <i class="fas fa-file-import"></i>
                                </button>
                            </div>
                            <div class="waveform">
                                <canvas class="waveform-display" id="pawWaveform"></canvas>
                                <div class="value-display" style="color: #0ff">18 cmH₂O</div>
                            </div>
                            <div class="waveform">
                                <canvas class="waveform-display" id="etco2Waveform"></canvas>
                                <div class="value-display" style="color: #fff">37 mmHg</div>
                            </div>
                        </div>
                    </div>
                    <div class="controls">
                        <div class="control-set">
                            <div class="control-dial" data-label="FG O₂" data-min="21" data-max="100">
                                <span>FG O₂<br>21</span>
                            </div>

                            <div class="control-dial" data-label="L/min" data-min="0" data-max="15">
                                <span>L/min<br>2</span>
                            </div>

                            <div class="control-dial" data-label="SEVF%" data-min="0" data-max="8">
                                <span>SEVF%<br>2.0</span>
                            </div>
                        </div>

                        <div class="control-set">
                            <div class="control-dial" data-label="Pmax" data-min="10" data-max="70">
                                <span>Pmax<br>30</span>
                            </div>

                            <div class="control-dial" data-label="VT" data-min="20" data-max="2000">
                                <span>VT<br>500</span>
                            </div>

                            <div class="control-dial" data-label="Rate" data-min="4" data-max="60">
                                <span>Rate<br>12</span>
                            </div>

                            <div class="control-dial" data-label="PEEP" data-min="0" data-max="20">
                                <span>PEEP<br>5</span>
                            </div>
                        </div>

                        <div class="gas-monitoring">
                            <div class="gas" style="color: #fafd24ff" data-label="SEVF%">
                                <span>SEV%<br>0<br>0</span>
                            </div>
                            <div class="gas" style="color: #0d10c6ff" data-label="N2O%">
                                <span>N2O%<br>0<br>0</span>
                            </div>
                            <div class="gas" style="color: #f8f8f5ff" data-label="MAC">
                                <span>MAC<br>0<br>0.9</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="physical-panel">
                    <div class="rotary-knob"></div>
                </div>
            </div>
        `;

        this.initializeMonitor();
    }

    initializeMonitor() {
        // Initialize waveform renderers
        this.waveforms = {
            vte: new WaveformRenderer(this.shadowRoot.getElementById('vteWaveform'), 'vte'),
            paw: new WaveformRenderer(this.shadowRoot.getElementById('pawWaveform'), 'paw'),
            etco2: new WaveformRenderer(this.shadowRoot.getElementById('etco2Waveform'), 'etco2')
        };

        // Initialize P-V loop renderer
        this.pvLoop = new PVLoopRenderer(this.shadowRoot.getElementById('pvLoop'));

        // Initialize rotary knob interaction
        this.initializeRotaryKnob();

        // Add load waveform button handler
        const loadWaveformBtn = this.shadowRoot.querySelector('.load-waveform');
        if (loadWaveformBtn) {
            loadWaveformBtn.addEventListener('click', () => this.loadCustomWaveform());
        }

        // Start animation
        this.startTime = performance.now();
        this.animate();
    }
    //input control of levels, will be replaced by physical dial
    initializeRotaryKnob() {
        const knob = this.shadowRoot.querySelector('.rotary-knob');
        const controls = this.shadowRoot.querySelectorAll('.control-dial');
        let isDragging = false;
        let startAngle = 0;

        // Add indicator to knob
        knob.innerHTML = '<div class="indicator">I</div>';

        controls.forEach(control => {
            control.addEventListener('click', () => {
                if (this.selectedControl) {
                    this.selectedControl.classList.remove('selected');
                }
            control.classList.add('selected');
                this.selectedControl = control;
                
            });
        });

        knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = knob.getBoundingClientRect();
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            startAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
            this.knobRotation = this.knobRotation || 0;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = knob.getBoundingClientRect();
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            const currentAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
            const angleDiff = currentAngle - startAngle;
            const newRotation = this.knobRotation + angleDiff * (180 / Math.PI);
            
            knob.style.transform = `rotate(${newRotation}deg)`;
            
            if (this.selectedControl) {
                // Update control value based on rotation
                // Calculate value based on min/max range
                const min = parseFloat(this.selectedControl.dataset.min);
                const max = parseFloat(this.selectedControl.dataset.max);
                // Calculate value based on rotation, but clamp between min and max
                const normalizedRotation = ((newRotation % 360) + 360) % 360;
                const rawValue = min + (normalizedRotation / 360) * (max - min);
                const value = Math.min(Math.max(rawValue, min), max);
                
                // Format value based on type
                let displayValue;
                if (this.selectedControl.dataset.label === 'SEVF%') {
                    displayValue = value.toFixed(1);
                } else {
                    displayValue = Math.round(value);
                }

                // Calculate rotation based on clamped value to prevent over-rotation display
                const clampedRotation = ((value - min) / (max - min)) * 360;
                knob.style.transform = `rotate(${clampedRotation}deg)`;

                //update both knob and gas display
                if (this.selectedControl.dataset.label === 'SEVF%') {
                    displayValue = value.toFixed(1);
                    this.sevfValue = displayValue; // Store the value
                    
                    // Update the gas display as well
                    const gasSevf = this.shadowRoot.querySelector('.gas[data-label="SEVF%"] span');
                    
                if (gasSevf) {
                    gasSevf.innerHTML = `SEV%<br>${displayValue}<br>0`;
                    const sevEvent = new CustomEvent('sevChange', { detail: { value: sevfValue } });
                    window.dispatchEvent(sevEvent);
                    
                }
}
                
                // Update text display
                this.selectedControl.innerHTML = `<span>${this.selectedControl.dataset.label}<br>${displayValue}</span>`;
                
                // Calculate and update the indicator arc length
                const percentage = (value - min) / (max - min);
                const arcLength = percentage * 360;
                this.selectedControl.style.setProperty('--arc-length', `${arcLength}deg`);
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            if (this.selectedControl) {
                const min = parseFloat(this.selectedControl.dataset.min);
                const max = parseFloat(this.selectedControl.dataset.max);
                
                // Safely get current rotation, defaulting to 0 if not set
                let currentRotation = 0;
                const transform = knob.style.transform;
                if (transform) {
                    const match = transform.match(/rotate\(([-\d.]+)deg\)/);
                    if (match) {
                        currentRotation = parseFloat(match[1]);
                    }
                }
                
                // Calculate and clamp the value
                const value = min + ((currentRotation % 360) / 360) * (max - min);
                const clampedValue = Math.min(Math.max(value, min), max);
                
                // Store the clamped rotation
                this.knobRotation = ((clampedValue - min) / (max - min)) * 360;
                
                // Update knob display
                knob.style.transform = `rotate(${this.knobRotation}deg)`;
            }
        });
    }

    loadCustomWaveform() {
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
                    const waveformData = JSON.parse(event.target.result);
                    // Set the custom waveform for the VTE renderer
                    this.waveforms.vte.setCustomWaveform(waveformData);
                    
                    // Show success message in status bar
                    const statusBar = this.shadowRoot.querySelector('.status-bar');
                    if (statusBar) {
                        statusBar.textContent = 'Custom waveform loaded successfully';
                        statusBar.style.background = '#4caf50';
                        setTimeout(() => {
                            statusBar.textContent = 'Status message goes here';
                            statusBar.style.background = '#666';
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Error loading waveform:', error);
                    // Show error message in status bar
                    const statusBar = this.shadowRoot.querySelector('.status-bar');
                    if (statusBar) {
                        statusBar.textContent = 'Error loading waveform file';
                        statusBar.style.background = '#f44336';
                        setTimeout(() => {
                            statusBar.textContent = 'Status message goes here';
                            statusBar.style.background = '#666';
                        }, 3000);
                    }
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    animate() {
        const time = (performance.now() - this.startTime) / 1000;

        // Update waveforms
        Object.values(this.waveforms).forEach(waveform => {
            waveform.update(time);
        });

        // Update P-V loop
        this.pvLoop.update(time);

        requestAnimationFrame(() => this.animate());
    }
}

customElements.define('anaesthesia-monitor', AnaesthesiaMonitor);
