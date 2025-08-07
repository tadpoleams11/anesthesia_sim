export class UI {
    constructor() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updatePointList(points, selectedPoint, onPointSelect) {
        const pointList = document.querySelector('.point-list');
        pointList.innerHTML = '';
        
        points.forEach(point => {
            const pointItem = document.createElement('div');
            pointItem.className = 'point-item';
            if (selectedPoint === point) {
                pointItem.style.border = '1px solid #0e639c';
            }
            
            // Create a small canvas instead of a div for the point indicator
            const canvas = document.createElement('canvas');
            canvas.className = 'point-color';
            canvas.width = 16;  // Size of the canvas
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            
            // Draw the point shape (square or circle)
            ctx.fillStyle = point.starred ? '#FFD700' : point.color;
            if (point.type === 'sharp') {
                // Draw square
                ctx.beginPath();
                ctx.rect(2, 2, 12, 12); // Leave 2px margin
                ctx.fill();
            } else {
                // Draw circle
                ctx.beginPath();
                ctx.arc(8, 8, 6, 0, Math.PI * 2); // Center at 8,8 with radius 6
                ctx.fill();
            }
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = point.name;
            nameInput.addEventListener('change', () => {
                point.name = nameInput.value;
            });

            const typeIndicator = document.createElement('span');
            typeIndicator.className = 'point-type';
            typeIndicator.textContent = point.type;
            typeIndicator.style.fontSize = '12px';
            typeIndicator.style.color = '#888';
            typeIndicator.style.marginLeft = 'auto';
            typeIndicator.style.marginRight = '8px';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Delete point';
            
            pointItem.appendChild(canvas);
            pointItem.appendChild(nameInput);
            pointItem.appendChild(typeIndicator);
            pointItem.appendChild(deleteBtn);
            pointItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn') && !e.target.closest('input')) {
                    onPointSelect(point);
                }
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (points.size > 2) {
                    points.delete(point.name);
                    this.updatePointList(points, selectedPoint, onPointSelect);
                    this.showToast('Point deleted', 'success');
                } else {
                    this.showToast('Cannot delete: minimum 2 points required', 'error');
                }
            });
            
            pointList.appendChild(pointItem);
        });
    }

    showContextMenu(x, y, items) {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
} 