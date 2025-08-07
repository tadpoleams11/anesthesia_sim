import { WaveformEditor } from './WaveformEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const editor = new WaveformEditor(canvas);
    
    // Handle sidebar collapse
    const sidebar = document.querySelector('.sidebar');
    const collapseBtn = document.querySelector('.sidebar-collapse-btn');
    
    if (collapseBtn && sidebar) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '>' : '<';
        });
    }
}); 