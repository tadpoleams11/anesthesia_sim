export class Point {
    constructor(x, y, name, color = '#ff0000', type = 'smooth') {
        this.x = x;
        this.y = y;
        this.name = name;
        this.color = color;
        this.type = type;
        this.cp1 = { x: x, y: y };
        this.cp2 = { x: x, y: y };
        this.starred = false;
    }

    setControlPoints(cp1, cp2) {
        this.cp1 = cp1;
        this.cp2 = cp2;
    }

    clone() {
        const point = new Point(this.x, this.y, this.name, this.color, this.type);
        point.setControlPoints({ ...this.cp1 }, { ...this.cp2 });
        return point;
    }
} 