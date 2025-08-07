export function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (evt.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1),
        y: (evt.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1)
    };
}

export function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function findClosestPoint(points, pos, threshold = 10) {
    let closest = null;
    let minDist = threshold;
    
    for (const point of points) {
        const dist = distance(pos, point);
        if (dist < minDist) {
            minDist = dist;
            closest = point;
        }
    }
    
    return closest;
}

export function generateUniquePointName(points) {
    let index = points.size + 1;
    let name = `Point ${index}`;
    
    while (points.has(name)) {
        index++;
        name = `Point ${index}`;
    }
    
    return name;
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 