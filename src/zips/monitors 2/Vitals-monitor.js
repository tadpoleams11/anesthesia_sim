// Vitals-monitor.js
// Monitors: Heart Rate, SpO2, Arterial Pressure, etCO2 :)

class VitalsWaveformRenderer {
    constructor(canvas, type) {
        this.canvas = canvas;
        this.type = type;
        this.ctx = canvas.getContext('2d');
        this.printHead = 0;
        this.data = [];
        this.customWaveform = null;
        this.waveformOffset = 0;
        this.baselineY = 0;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {   
        // Configure canvas
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Re-init data array to match new width
        const width = Math.floor(this.canvas.width / window.devicePixelRatio);
        this.data = new Array(width).fill(0);

        // Set default baseline
        const height = this.canvas.height / window.devicePixelRatio;
        this.baselineY = height * 0.67;
    }

        setCustomVitalsWaveform(waveformData) {
        this.customWave = waveformData;
        
        // Update baseline if provided in metadata
        if (waveformData.metadata && typeof waveformData.metadata.baselineRatio === 'number') {
            const height = this.canvas.height / window.devicePixelRatio;
            this.baselineY = height * waveformData.metadata.baselineRatio;
        }
    }

    getColor() {
        const colors = {
            hr: '#24cf21ff',
            ST: '#24cf21ff',
            spo2: '#02dafcff',
            art: '#c40000ff',
            etCO2: '#ffffff'
        };
        return colors[this.type] || '#FFF';
    }
    //lowkey pointless func rn but can put limits on the range this way BRO WHY IS IT IN THE WAVEFORM CLASS MOVE THIS
    getMin() {
        const mins = {
            hr: 0,
            spo2: 0,
            art: 0,
            etCO2: 0,
            ST: 0
        }
        return mins[this.type] || 0;
    }

    getMax(){
        const maxs = {
            hr: 300,
            spo2: 100,
            art: 300,
            etCO2: 95,
            ST: 5
        }
        return maxs[this.type] || 220;
    }

    //generates mathematically plausible-ish values for the canvas to draw
    generateDataPoint(time) {
        // Simulate different waveforms
        const bpm = 75;
        const cycle = (time * bpm / 60) % 1;

        switch(this.type) {
            
            case 'hr': // Heart rate (ECG-like)
                // Simple QRS complex
                if (cycle < 0.05) return 40 * Math.exp(-100 * Math.pow(cycle - 0.025, 2));
                if (cycle < 0.1) return -10 * Math.exp(-200 * Math.pow(cycle - 0.075, 2));
                return 0;
            case 'spo2': // SpO2 plethysmograph
                //add case for low perfusion
                const spo2Rate = 1.2; // Hz
                return 20 * Math.sin(2 * Math.PI * spo2Rate * time) + 10 * Math.sin(4 * Math.PI * spo2Rate * time);
            case 'art': // Arterial pressure SAME AS SPO2 RN WILL NEED TO CHANGE
                const sys = 120, dia = 80;
                const artRate = 1.4;
                return 20 * Math.sin(2 * Math.PI * artRate * time) + 10 * Math.sin(4 * Math.PI * artRate * time);
                //if (cycle < 0.2) return sys - (sys - dia) * (cycle / 0.2);
                //return dia + (sys - dia) * Math.exp(-10 * (cycle - 0.2));
            default:
                return 0;
        }
    }

    update(time) {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        //clear area around print head
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.printHead - 2, 0, 24, height);

        //new data point
        const newPoint = this.generateDataPoint(time);
        this.data[this.printHead] = newPoint;

        // Draw waveform
        this.ctx.strokeStyle = this.getColor();
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        let lastX = null;
        for(let i = 0; i < width; i++) {
            const x = (this.printHead - i + width) % width;
            const y = this.baselineY - this.data[x];
            
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

        //draw black rectangle at print head
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.printHead, 0, 20, height);

        // Move print head forward
        this.printHead = (this.printHead + 1) % width;
    }
}
//quickly invent the wheel again (implement a linked list queue)
class Node {
    constructor(data){
        this.data = data;
        this.next = null;
    }
}
class Queue {
    constructor() {
        this.front = null;  
        this.rear = null; 
        this.size = 0; 
    }
    enqueue(data) {
        const newNode = new Node(data);
        if (this.isEmpty()) {
            this.front = newNode;
            this.rear = newNode;
        } else {
            this.rear.next = newNode;
            this.rear = newNode;
        }
        this.size++;
    }
    dequeue() {
        if (this.isEmpty()) {
            return null; 
        }
        const removedNode = this.front;
        this.front = this.front.next;
        if (this.front === null) {
            this.rear = null;
        }
        this.size--;
        return removedNode.data;
    }
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.front.data;
    }
    isEmpty() {
        return this.size === 0;
    }
    getSize() {
        return this.size;
    }
    print() {
        let current = this.front;
        const elements = [];
        while (current) {
            elements.push(current.data);
            current = current.next;
        }
        console.log(elements.join(' -> '));
    }
}



class VitalsMonitor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
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
                    background: #000; 
                    color: #fff; 
                    height: 100%; 
                    padding: 10px; 
                    min-width: 0;
                    min-height: 0;
                    position: relative;
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

                .vitals-area { 
                    flex: 1 1 0;
                    min-height: 40px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    border: 1px solid #ffd025ff;
                    
                }

                .vital-row { 
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    min-height: 40px;
                    border: 1px solid #25fff4ff;           
                    }

                .vital-canvas { 
                    flex: 1 1 0;
                    min-width: 40px;
                    width: 100%; 
                    aspect-ratio: 4/1;
                    max-width: 100%;
                    max-height: 80px;
                    height: 100%;
                    min-height: 0;
                    background: #000; 
                    border: 1px solid #ff2599ff;
                }

                .vital-value { 
                    font-size: 4em; 
                    min-width: 50px;
                    text-align: right;
                    padding: 10px 10px 10px 10px;
                    border: 1px solid #000;
                    background: #000; 
                    
                        
                }

                .vital-value.selected{
                    border: 1px solid;
                    border-color: #fafd24ff;
                    box-shadow: 0 0 5px rgba(255, 255, 0, 0.8);  
                }

                .vital-label {
                    min-width: 60px;
                    font-weight: bold;
                    border: 1px solid #8725ffff;
                    
                }
                /* Make the text the same colour as the wave */
                .vital-label.hr, .vital-value.hr { color: #2fff00ff; }
                .vital-label.spo2, .vital-value.spo2 { color: #02bdfcff; }
                .vital-label.art, .vital-value.art { color: #db0202ff; }
                .vital-label.ST, .vital-value.ST { color: #2fff00ff; }
                .vital-label.etco2, .vital-value.etco2 { color: #ffffff; }
                .vital-label.NIBP, .vital-value.NIBP { color: #ffffff; }

                

                /* gas display styling*/
                .gas-monitoring {
                    position: absolute;  
                    bottom: 24px;
                    left: 96px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 6px;
                    border: 1px solid #db0202ff; 
                    padding: 8px 16px 6px 16px;        
                }
                .sevf-gas {
                    position: absolute;
                    bottom: 18px;
                    right: 24px;
                    color: #fafd24ff;
                    font-size: 20px;
                    text-align: right;
                    background: rgba(0,0,0,0.5);
                    border-radius: 6px;
                    padding: 8px 16px 6px 16px;
                    z-index: 10;
                    min-width: 70px;
                }
                .gas-label {
                    display: flex;
                    flex-direction: column;
                    flex: 1 1 0;
                    text-align: left;
                    gap: 5px;
                    font-size: 20 px
                
                }
                .gas-label.o2 {color: #ffffffff;}
                .gas-label.n2o {color: #0011ffff;}

                /* popup window modal style */

                .modal {
                    display: none; /* Hidden by default */
                    position: absolute; /* Stay in place */
                    z-index: 25; /* Sit on top */
                    width: 50%; 
                    height: 50%; 
                    
                }

                .modal-content{
                    background-color: #959595c2;
                    margin: 15% auto; /* 15% from the top and centered */
                    padding: 20px;
                    border: 1px solid #502051df;
                    width: 80%; /* Could be more or less, depending on screen size */
                    max-width: 500px;
                    position: relative;
                }

                .modal-header{
                    cursor: move;
                    
                }

                .close-button {
                    color: #9c04aaff;
                    float: right;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                }

                .close-button:hover,
                .close-button:focus {
                    color: black;
                    text-decoration: none;
                    cursor: pointer;
                }

                .input-number{
                    width: 60px;
                    margin-left: 8px;
                    outline: none;
                    
                }

                .slider-container {
                    width: 100%;
                
                }

                .slider{
                    -webkit-appearance: none;  /* Override default CSS styles */
                    appearance: none;
                    width: 100%; /* Full-width */
                    height: 25px; /* Specified height */
                    background: #d3d3d3; /* Grey background */
                    outline: none; /* Remove outline */
                    opacity: 0.7; /* Set transparency (for mouse-over effects on hover) */
                    -webkit-transition: .2s; /* 0.2 seconds transition on hover */
                    transition: opacity .2s;
                
                } 
                
                .slider:hover {
                    opacity: 1;
                }

                /* The slider handle (use -webkit- (Chrome, Opera, Safari, Edge) and -moz- (Firefox) to override default look) */
                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none; /* Override default look */
                    appearance: none;
                    width: 25px; /* Set a specific slider handle width */
                    height: 25px; /* Slider handle height */
                    background: #9c04aaff; 
                    cursor: pointer; /* Cursor on hover */
                }

                .slider::-moz-range-thumb {
                    width: 25px; /* Set a specific slider handle width */
                    height: 25px; /* Slider handle height */
                    background: #9c04aaff; 
                   cursor: pointer; /* Cursor on hover */
                }

                
             

            </style>


            <div class="monitor">
                <div class="display">
                     <div class="status-bar">Status message goes here</div>

                    <div class="vitals-area">
                        <div class="vital-row">
                            <span class="vital-label hr">HR</span>
                            <canvas class="vital-canvas" data-label="hrCanvas" id="hrCanvas"></canvas>
                            <button class="vital-value hr" data-label="hrValue" id="hr" style="cursor:pointer">75</button> bpm
                        </div>

                        <div class="vital-row">
                            <span class="vital-label ST">ST ||</span>
                            <canvas class="vital-canvas" data-label="STCanvas" id="STCanvas"></canvas>
                            <button class="vital-value ST" data-label="STValue" id="ST" style="cursor:pointer">0.3</button> mm
                        </div>
                        
                        <div class="vital-row">
                            <span class="vital-label art">ART</span>
                            <canvas class="vital-canvas" data-label="artCanvas" id="artCanvas"></canvas>
                            <button class="vital-value art" id="art" data-label="artValue" style="cursor:pointer">120 / 80 / 90</button> mmHg
                        </div>

                        <div class="vital-row">
                            <span class="vital-label spo2">SpO₂</span>
                            <canvas class="vital-canvas" data-label="spo2Canvas" id="spo2Canvas"></canvas>
                            <button class="vital-value spo2" data-label="spo2Value" id="spo2" style="cursor:pointer">98</button>%
                        </div>

                        <div class="vital-row">
                            <span class="vital-label etCO2">etCO2</span>
                            <canvas class="vital-canvas" data-label="etco2Canvas" id="etCO2Canvas"></canvas>
                            <button class="vital-value etco2" id="etco2" data-label="etCO2Value" style="cursor:pointer">32</button> mmHg
                        </div>

                        <div class="vital-row">
                            <span class="vital-label NIBP">NIBP</span>
                            <button class="vital-value NIBP" data-label="NIBP" id="NIBP" style="cursor:pointer">118 / 80 / 90 </button> mmHg
                        </div>
                    </div>

                    <div class="modal" id="valModal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <span class="close-button" id="modal-close">&times;</span>
                                <span id="modalName"></span>
                            </div>
                            <p>self destruct initiated</p>
                            <div class="slidecontainer">
                                <input type="range" min="1" max="100" value="50" class="slider" id="myRange">
                                <input type="number" id="slideVal" class="input-number">
                            </div>
                            <div class="slidecontainer" id="bloodSliders" style="display:none;">
                                Systolic: <input type="range" min="0" max="300" value="120" class="slider" id="sysRange">
                                <input type="number" class="input-number" id="sysVal"><br>
                                Diastolic: <input type="range" min="0" max="300" value="80" class="slider" id="diaRange">
                                <input type="number" id="diaVal" class="input-number"><br>
                                MeanArtPress: <input type='range' min='0' max="300" value="90" class="slider" id='mapRange'>
                                <input type="number" id="mapVal" class="input-number"><br>
                            </div>
                            <span><button id="start"> start </button><button id="queue"> queue </button></span>
                        </div>
                    </div>

                    <div class="modal" id="miniModal">
                        <div class="modal-content">
                            <span class="close-button" id="mini-close">&times;</span>
                            <span id="miniName"><br></span><br>
                            <span id="miniNum"> </span><br>
                            <button id ="miniStart">start</button>
                        </div>
                    </div>

                    <div class ="gas-monitoring">
                        <div class="gas-label" data-label="o2">
                            <span>O2 0 0</span>
                        </div>
                        <div class="gas-label" data-label="n2o">
                            <span>N20 0 0</span>
                        </div>
                    </div>

                    <div class="sevf-gas" data-label="SEVF%" id="SEVF%">SEV%<br>0<br>0</div>

                    
                </div>
                
                
            </div>
        `;
        
        
        this.initializeMonitor();
        
    }

    //voila
    initializeMonitor() {
        this.vitalCanvas = {
            hr: new VitalsWaveformRenderer(this.shadowRoot.getElementById('hrCanvas'), 'hr'),
            spo2: new VitalsWaveformRenderer(this.shadowRoot.getElementById('spo2Canvas'), 'spo2'),
            art: new VitalsWaveformRenderer(this.shadowRoot.getElementById('artCanvas'), 'art')
        };

        //this.hrValue = this.shadowRoot.getElementById('hrValue');
        //this.spo2Value = this.shadowRoot.getElementById('spo2Value');
        //this.artValue = this.shadowRoot.getElementById('artValue');
        
        this.sevChange();
        this.initControl();
        //start animating the monitor (initializes time and calls animate)
        this.startTime = performance.now();
        this.animate();
    }
    
    //dud rn but should update SEV value accoridng to other monitor
    sevChange(){
        window.addEventListener('sevChange', (e) => {
            const sevfGas = this.shadowRoot.getElementbyId('SEVF%');
            if (sevfGas) {
                sevfGas.innerHTML = `SEV%<br>${e.detail.value}<br>0`;
            }
        });
    }

    //establishes click zones
    initControl(){
        //identify the areas to update
        const controlledValues = this.shadowRoot.querySelectorAll('.vital-value');
        const closed = false;
        //individually recognize clicky spots, give them each a click handler
        
        //init a queue for modal changes
        const modQ = new Queue();
        //add or remove from 'selected' list
        controlledValues.forEach(conVal => {
            conVal.addEventListener('click', () => {
                
                if (this.selectedConVal) {
                    
                    
                    this.selectedConVal.classList.remove('selected');
                }
                    
                conVal.classList.add('selected');
                
                    this.selectedConVal = conVal;
                    this.initModal(conVal);   
            });
        });

        

    }
    
    //little window to adjust values
    initModal(conVal){
        // Get the modal from shadow DOM
        const modal = this.shadowRoot.getElementById("valModal");
        // Get the <span> element that closes the modal
        const span = this.shadowRoot.getElementById("modal-close");
        //queue button
        const q = this.shadowRoot.getElementById("queue");
        //start (apply changes) button
        const btn = this.shadowRoot.getElementById("start");
        if (!btn) {
            // If the button is not found, do not proceed
            console.error('Start button not found in modal!');
            return;
        }

        //find slider and output spot
        const slider = this.shadowRoot.getElementById("myRange");
        const output = this.shadowRoot.getElementById("slideVal");
        const modalName = this.shadowRoot.getElementById("modalName");
        //get range based on type 1. locate id 2. make sure renderer exists 3. use existing object to call get min/max
        const vitalType = conVal.id;

        //need canvas for ST for colour to update in little modal !!!!!!!!!!CHANGE THIS
        const renderer = this.vitalCanvas[vitalType];
        if (renderer) {
            slider.min = renderer.getMin();
            slider.max = renderer.getMax();
            modalName.style.color = renderer.getColor();
        }

        // Temporary value holders
        let tempValue = conVal.textContent;
        let tempSys = 0, tempDia = 0, tempMap = 0;

        //Blood Pressure Modal
        if (vitalType === 'art' || vitalType == 'NIBP') {
            // Show ART sliders, hide single slider
            this.shadowRoot.getElementById('bloodSliders').style.display = '';
            slider.style.display = 'none';
            output.style.display = 'none';

            // Set initial values
            const sysRange = this.shadowRoot.getElementById('sysRange');
            const diaRange = this.shadowRoot.getElementById('diaRange');
            const mapRange = this.shadowRoot.getElementById('mapRange');
            const sysVal = this.shadowRoot.getElementById('sysVal');
            const diaVal = this.shadowRoot.getElementById('diaVal');
            const mapVal = this.shadowRoot.getElementById('mapVal');

            // Parse current value (e.g., "120 / 80 / 90")
            let [sys, dia, map] = conVal.textContent.split('/').map(v => parseInt(v, 10));
            tempSys = sys || 120;
            tempDia = dia || 80;
            tempMap = map || 90;
            sysRange.value = tempSys;
            diaRange.value = tempDia;
            mapRange.value = tempMap;
            sysVal.value = tempSys;
            diaVal.value = tempDia;
            mapVal.value = tempMap;

            const bloodQ = new Queue();
            // Track last two changed sliders
            let lastChanged = null;
            let secondLastChanged = null;
            function updateThird() {
                if (lastChanged && secondLastChanged) {
                    if ((lastChanged === 'sys' && secondLastChanged === 'dia') || (lastChanged === 'dia' && secondLastChanged === 'sys')) {
                        // Update MAP
                        tempMap = Math.round(Number(tempDia) + ((Number(tempSys)-Number(tempDia))/3));
                        mapRange.value = tempMap;
                        mapVal.value = tempMap;
                    } else if ((lastChanged === 'map' && secondLastChanged === 'dia') || (lastChanged === 'dia' && secondLastChanged === 'map')) {
                        // Update SYS
                        tempSys = Math.round((3*Number(tempMap))-(2*Number(tempDia)));
                        sysRange.value = tempSys;
                        sysVal.value = tempSys;
                    } else if ((lastChanged === 'map' && secondLastChanged === 'sys') || (lastChanged === 'sys' && secondLastChanged === 'map')) {
                        // Update DIA
                        tempDia = Math.round(((3*Number(tempMap))-Number(tempSys))/2);
                        diaRange.value = tempDia;
                        diaVal.value = tempDia;
                    }
                }
            }
            // Sync slider <-> input for all three
            sysRange.oninput = function() {
                sysVal.value = this.value;
                tempSys = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'sys';
                updateThird();
            };
            sysVal.oninput = function() {
                sysRange.value = this.value;
                tempSys = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'sys';
                updateThird();
            };
            diaRange.oninput = function() {
                diaVal.value = this.value;
                tempDia = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'dia';
                updateThird();
            };
            diaVal.oninput = function() {
                diaRange.value = this.value;
                tempDia = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'dia';
                updateThird();
            };
            mapRange.oninput = function() {
                mapVal.value = this.value;
                tempMap = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'map';
                updateThird();
            };
            mapVal.oninput = function() {
                mapRange.value = this.value;
                tempMap = this.value;
                secondLastChanged = lastChanged;
                lastChanged = 'map';
                updateThird();
            };
            

            // On start, update the vital value
            btn.onclick = () => {
                //updateThird();
                conVal.textContent = `${tempSys} / ${tempDia} (${tempMap})`;
                //modal.style.display = "none";
            };
        } else {
            // Hide ART sliders, show single slider
            this.shadowRoot.getElementById('bloodSliders').style.display = 'none';
            slider.style.display = '';
            output.style.display = '';
            // Set initial value
            slider.value = conVal.textContent;
            output.value = slider.value;
            // Sync slider <-> input
            slider.oninput = function() {
                output.value = this.value;
                tempValue = this.value;
            };
            output.oninput = function() {
                slider.value = this.value;
                tempValue = this.value;
            };
            // On start, update the vital value
            btn.onclick = () => {
                conVal.textContent = tempValue;
                modal.style.display = "none";
            };
            //add to action queue BUSTED RN -- less busted
            
            q.onclick = () => {
                this.initMiniModal(conVal,tempValue);
                modal.style.display = "none";
            };
            
        }

        //appear!
        modal.style.display = "block";

        //data-label has use! different from id and half the purpose
        modalName.textContent = conVal.getAttribute("data-label");

        // When the user clicks on <span> (x), close the modal
        if(span){
            span.onclick = () => {
                modal.style.display = "none";
            };
        }

        
        // Make modal draggable
        this.dragThing(modal);
    }

    initMiniModal(conVal, tempVal){
        //if queue button is pressed, make a mini modal appear that reflects the upcoming changes
        const modal = this.shadowRoot.getElementById("miniModal");
        // Get the <span> element that closes the modal
        const close = this.shadowRoot.getElementById("mini-close");
        let temp = tempVal;
        //get the <span> where value is stored
        const miniNum = this.shadowRoot.getElementById("miniNum");

        //establish the title
        const miniName = this.shadowRoot.getElementById("miniName");
        miniName.textContent = conVal.getAttribute("data-label");

        miniNum.innerHTML = `<span>${temp}</span>`;
        //start (apply changes) button
        const btn = this.shadowRoot.getElementById("miniStart");
        if (!btn) {
            // If the button is not found, do not proceed
            console.error('Start button not found in modal!');
            return;
        }

        btn.onclick = () => {
                conVal.textContent = temp;
                modal.style.display = "none";
            };

        //general: appear
        modal.style.display = "block";
        //make the close button work
        if(close){
            close.onclick = () => {
                modal.style.display = "none";
            };
        }
        
    }
    
    dragThing(modal) {
        const header = modal.querySelector('.modal-header');
        if (!header) return;
        let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
        // Ensure modal is absolutely positioned
        modal.style.position = 'absolute';
        // Center modal if not already positioned
        if (!modal.style.left) modal.style.left = '25vw';
        if (!modal.style.top) modal.style.top = '20vh';

        header.onmousedown = (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            document.onmousemove = onMouseMove;
            document.onmouseup = onMouseUp;
        };

        const onMouseMove = (e) => {
            e.preventDefault();
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            startX = e.clientX;
            startY = e.clientY;
            // Move the modal
            modal.style.left = (modal.offsetLeft + offsetX) + 'px';
            modal.style.top = (modal.offsetTop + offsetY) + 'px';
        };

        const onMouseUp = () => {
            document.onmousemove = null;
            document.onmouseup = null;
        };
    }

    statusAlerts(){

        //gather necessary elements and variables to test
        const statusBar = this.shadowRoot.querySelector('.status-bar');
        const hrValue = parseInt(this.shadowRoot.getElementById('hr').textContent, 10);
        const spo2Value = parseInt(this.shadowRoot.getElementById('spo2').textContent, 10);
        const etCO2Value = parseInt(this.shadowRoot.getElementById('etco2').textContent, 10);
        const st = parseInt(this.shadowRoot.getElementById('ST').textContent, 10);

        //test the values and turn status bar yellow with message when values in dangerous range
        if (hrValue < 60) {
            statusBar.textContent = 'Warning: death might be occuring (HR < 60)';
            statusBar.classList.add('warning');
        }else if (hrValue > 220){
            statusBar.textContent = 'Warning: death might be occuring (hr > 220)';
            statusBar.classList.add('warning');
        }else if (spo2Value <= 90){
            statusBar.textContent = 'Warning: death might be occuring (SpO2 < 90)';
            statusBar.classList.add('warning');
        }else if (etCO2Value <= 30){
            statusBar.textContent = 'Warning: death might be occuring (etCO2 < 35)';
            statusBar.classList.add('warning');
        }else if (etCO2Value >= 45){
            statusBar.textContent = 'Warning: death might be occuring (etCO2 > 45)';
            statusBar.classList.add('warning'); 
        } else {
            statusBar.textContent = 'Status message goes here';
            statusBar.classList.remove('warning');
        }
        

    }

    animate() {
        //understanding of passage of time
        const time = (performance.now() - this.startTime) / 1000;
        // update waveforms
        Object.values(this.vitalCanvas).forEach(canvas => canvas.update(time));

        // Update value displays IDK IF I'M KEEPING THESE THEY'RE SENTIMENETAL BAD LINES
        //if (this.hrValue) this.hrValue.textContent = Math.round(75 + 2 * Math.sin(time));
        //if (this.spo2Value) this.spo2Value.textContent = Math.round(98 + 0.5 * Math.sin(time * 0.5));
        //if (this.artValue) this.artValue.textContent = `${120 + Math.round(5 * Math.sin(time))}/${80 + Math.round(3 * Math.cos(time))}`;

        //status bar stuff 
        this.statusAlerts();


        //recursively calls self to update time and waveforms
        requestAnimationFrame(() => this.animate());
    }
}

customElements.define('vitals-monitor', VitalsMonitor);
