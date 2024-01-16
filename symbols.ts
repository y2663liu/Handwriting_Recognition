type Point = { x: number, y: number };

type Curve = {
    type: 'points' | 'polynomial',
    data: Point[] | { x: (s: number) => number, y: (s: number) => number } // the second definition is for Polynomial Curves
};

class Symbols {
    curves: Curve[];

    constructor(curves: Curve[]) {
        this.curves = curves;
    }
}

type MetricLine = {
    id: string;
    x: number;
    y: number;
    label: string;
    angle: number; // Angle in degrees
    isSelected: boolean; // Indicates if the line is selected
    dot: Point | null;
    intersectedCurve: Curve | null; // Add this to keep track of the intersected curve
};

class Annotation {
    symbols: Symbols; // Represents the symbol to be drawn
    metricLines: MetricLine[];

    constructor(symbols: Symbols) {
        this.symbols = symbols;
        this.metricLines = [];
    }

    addMetricLine(metricLine: MetricLine): void {
        this.metricLines.push(metricLine);
    }

    removeMetricLine(metricLineId: string): void {
        this.metricLines = this.metricLines.filter(line => line.id !== metricLineId);
    }
}

class CanvasRenderer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.context = this.canvas.getContext('2d')!;
        this.canvas.width = window.innerWidth;
        this.canvas.height = 300;
    }

    drawSymbol(annotation: Annotation): void {
        // Clear the canvas before drawing
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the symbol (curves) here
        // This code will vary depending on the format of your symbol data
        annotation.symbols.curves.forEach(curve => {
            // Check if curve is a set of points
            if (curve.type === 'points') {
                this.drawCurve(curve.data as Point[]);
            }
            // If curve is defined by polynomial, need additional handling
        });

        // Draw metric lines
        this.drawMetricLines(annotation.metricLines);
    }

    drawCurve(points: Point[]): void {
        if (points.length === 0) return;

        this.context.beginPath();
        this.context.moveTo(points[0].x, points[0].y);

        points.slice(1).forEach(point => {
            this.context.lineTo(point.x, point.y);
        });

        this.context.stroke(); // Draw the curve
    }

    drawMetricLines(metricLines: MetricLine[]): void {
        metricLines.forEach(line => {
            this.context.save();
            this.context.beginPath();

            // Use blue for selected lines, black for others
            this.context.strokeStyle = line.isSelected ? 'blue' : 'black';
            this.context.lineWidth = line.isSelected ? 2 : 1;
            
            const slope = Math.tan(line.angle * Math.PI / 180);
            // Calculate where the line intersects the canvas boundaries
            // We calculate two points: one on the left edge and one on the right edge of the canvas
            let leftY = line.y - slope * line.x;
            let rightY = line.y + slope * (this.canvas.width - line.x);

            this.context.moveTo(0, leftY);
            this.context.lineTo(this.canvas.width, rightY);
            this.context.stroke();

            // Draw the label for the metric line
            this.context.fillStyle = line.isSelected ? 'blue' : 'red'; // Text color for the label
            this.context.fillText(line.label, 5, line.y - 5); // Position label above the line

            // Draw the dot if it exists
            if (line.dot) {
                this.context.fillStyle = 'red';
                this.context.beginPath();
                this.context.arc(line.dot.x, line.dot.y, 5, 0, 2 * Math.PI); // 5 is the dot radius
                this.context.fill();
            }
            this.context.restore();
        });
    }
}

class InteractiveCanvas {
    canvas: HTMLCanvasElement;
    rotationIcon: HTMLElement;
    localMaxButton: HTMLElement;
    localMinButton: HTMLElement;
    fileInputButton: HTMLElement;
    saveButton: HTMLElement;
    context: CanvasRenderingContext2D;
    renderer: CanvasRenderer;
    annotation: Annotation;
    currentX: number | null;
    currentY: number | null;
    selectedLine: MetricLine | null;
    selectedSlantLine: MetricLine | null;
    dragging: boolean;
    threshold = 10;

    constructor(canvasId: string, renderer: CanvasRenderer, annotation: Annotation) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.rotationIcon = document.getElementById('rotationIcon') as HTMLElement;
        this.localMaxButton = document.getElementById('button1') as HTMLElement;
        this.localMinButton = document.getElementById('button2') as HTMLElement;
        this.fileInputButton = document.getElementById('fileInput') as HTMLElement;
        this.saveButton = document.getElementById('saveButton') as HTMLElement;
        this.context = this.canvas.getContext('2d')!;
        this.renderer = renderer;
        this.annotation = annotation;
        this.currentX = null;
        this.currentY = null;
        this.selectedLine = null;
        this.selectedSlantLine = null;
        this.dragging  = false;

        this.rotationIcon.style.display = 'none'; // Hide the rotation icon
        this.localMaxButton.style.display = 'none';
        this.localMinButton.style.display = 'none';
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.createCheckboxesForNormalMetricLines(1);
        this.createCheckboxesForNormalMetricLines(2);
        this.createCheckboxesForNormalMetricLines(3);
        this.createCheckboxesForSlantMetricLines();
        this.setupRotationEventListeners();
        this.setupLocalMaxMinEventListeners();
        this.setupfileInputButtonEventListeners();
        this.setupSaveButtonEventListeners();
    }

    createCheckboxesForSlantMetricLines(): void {
        const container = document.getElementById('slant-checkboxes-container');
        if (container) {
            const metricLinesInfo = [
                { id: 'SLANT_1', label: 'Slant 1', defaultX: this.renderer.canvas.width * 0.5, defaultY: this.renderer.canvas.height * 0.5 },
                { id: 'SLANT_2', label: 'Slant 2', defaultX: this.renderer.canvas.width * 0.5, defaultY: this.renderer.canvas.height * 0.5 },
            ];
            container.innerHTML = ''; // Clear existing checkboxes

            metricLinesInfo.forEach(lineInfo => {
                const checkboxContainer = document.createElement('div'); // Container for the checkbox and label
                checkboxContainer.style.display = 'flex'; // Use flexbox to align items
                checkboxContainer.style.alignItems = 'center'; // Center align items vertically
                checkboxContainer.style.marginBottom = '5px'; // Add some space between rows

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `checkbox-${lineInfo.id.toLowerCase()}`;
                checkbox.name = lineInfo.id;
                checkbox.value = lineInfo.id;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = lineInfo.label;
                label.style.marginLeft = '5px'; // Add some space between the checkbox and label
                label.style.whiteSpace = 'nowrap'; // Prevent text from wrapping

                checkboxContainer.appendChild(checkbox); // Add the checkbox to the container
                checkboxContainer.appendChild(label); // Add the label to the container

                container.appendChild(checkboxContainer); // Add the container to the main container

                checkbox.addEventListener('change', this.handleCheckboxChange.bind(this, lineInfo.id, lineInfo.defaultX, lineInfo.defaultY));

            });
        } else {
            // Handle the case when the container is not found
            console.error('Slant Checkbox container element not found in the document.');
        }
    }

    createCheckboxesForNormalMetricLines(checkboxID: number): void {
        const container = document.getElementById('checkboxes-container-' + checkboxID);
        if (container) {
            const metricLinesInfo = [
                { id: 'ASCENDER_LINE_' + checkboxID, label: 'Ascender Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.15},
                { id: 'CAP_LINE_' + checkboxID, label: 'Cap Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.25},
                { id: 'X_LINE_' + checkboxID, label: 'X Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.4},
                { id: 'CENTER_LINE_' + checkboxID, label: 'Center Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.6},
                { id: 'BASE_LINE_' + checkboxID, label: 'Base Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.8},
                { id: 'DESCENDER_LINE_' + checkboxID, label: 'Descender Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.90},
            ];
            container.innerHTML = ''; // Clear existing checkboxes

            metricLinesInfo.forEach(lineInfo => {
                const checkboxContainer = document.createElement('div'); // Container for the checkbox and label
                checkboxContainer.style.display = 'flex'; // Use flexbox to align items
                checkboxContainer.style.alignItems = 'center'; // Center align items vertically
                checkboxContainer.style.marginBottom = '5px'; // Add some space between rows

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `checkbox-${lineInfo.id.toLowerCase()}`;
                checkbox.name = lineInfo.id;
                checkbox.value = lineInfo.id;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = lineInfo.label;
                label.style.marginLeft = '5px'; // Add some space between the checkbox and label
                label.style.whiteSpace = 'nowrap'; // Prevent text from wrapping

                checkboxContainer.appendChild(checkbox); // Add the checkbox to the container
                checkboxContainer.appendChild(label); // Add the label to the container

                container.appendChild(checkboxContainer); // Add the container to the main container

                checkbox.addEventListener('change', this.handleCheckboxChange.bind(this, lineInfo.id, lineInfo.defaultX, lineInfo.defaultY));

            });
        } else {
            // Handle the case when the container is not found
            console.error('Checkbox container ' + checkboxID + ' element not found in the document.');
        }
    }

    isSlant(metricLineId: String): Boolean {
        return metricLineId.lastIndexOf('SLANT') === 0
    }

    handleCheckboxChange(metricLineId: string, defaultX: number, defaultY: number, event: Event): void {
        const checkbox = event.target as HTMLInputElement;
        let xCord = defaultX;
        let yCord = defaultY;
        // if (this.currentX !== null && this.currentY !== null){ // delete this if we only need the default one
        //     xCord = this.currentX;
        //     yCord = this.currentY;
        // }
        if (checkbox.checked) {
            const defaultAngle = (this.isSlant(metricLineId) ? -60 : 0);
            const newMetricLine: MetricLine = {
                id: metricLineId,
                x: xCord,
                y: yCord,
                label: metricLineId.replace('_', ' ').replace('_', ' ').toLowerCase(),
                angle: defaultAngle,
                isSelected: false,
                dot: null,
                intersectedCurve: null,
            };
            this.annotation.addMetricLine(newMetricLine);
            if (this.isSlant(metricLineId)){
                this.selectedSlantLine = newMetricLine;
                this.displayRotationIcon(xCord, yCord);
            } else {
                this.displayMaxMinButton(xCord, yCord);
            }
        } else {
            this.annotation.removeMetricLine(metricLineId);
            if (this.isSlant(metricLineId)){
                this.selectedSlantLine = null;
                this.rotationIcon.style.display = 'none'; // Hide the rotation icon
            } else {
                this.localMaxButton.style.display = 'none';
                this.localMinButton.style.display = 'none';
            }
        }
        this.renderer.drawSymbol(this.annotation); // redraws the symbol and annotations
    }

    getMousePosition(event: MouseEvent): Point {
        const canvasRect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top
        };
    }

    displayRotationIcon(x: number, y: number): void {
        this.rotationIcon.style.position = 'absolute'; // Required for absolute positioning
        this.rotationIcon.style.left = `${x}px`; // X coordinate for positioning the icon
        this.rotationIcon.style.top = `${y}px`; // Y coordinate for positioning the icon
        this.rotationIcon.style.display = 'block'; // Make the rotation icon visible
    }

    displayMaxMinButton(x, y) {
        this.localMaxButton.style.position = 'absolute';
        this.localMaxButton.style.left = x + 'px';
        this.localMaxButton.style.top = (y - this.threshold) + 'px';
        this.localMaxButton.style.display = 'block'; // Show the button

        // Position the min button, slightly to the right of the max button
        this.localMinButton.style.position = 'absolute';
        this.localMinButton.style.left = (x + this.localMaxButton.offsetWidth + 10) + 'px';
        this.localMinButton.style.top = (y - this.threshold) + 'px';
        this.localMinButton.style.display = 'block'; // Show the button
    }
    

    handleMouseDown(event: MouseEvent): void {
        const mousePos = this.getMousePosition(event);
        this.currentX = mousePos.x; // Record the x-coordinate
        this.currentY = mousePos.y; // Record the y-coordinate
    
        // Check if any metric line is selected
        const line = this.findLineAtPosition(mousePos.x, mousePos.y);
        this.annotation.metricLines.forEach(l => l.isSelected = false);
        if (line) {
            this.selectedLine = line;
            this.selectedLine.isSelected = true;

            if (line.dot && this.calculateDistance(mousePos, line.dot) < this.threshold) {
                // If the click is near the existing dot, remove it and don't enable dragging
                line.dot = null;
                this.dragging = false;
            } else if (line.dot && this.calculateDistance(mousePos, line.dot) >= this.threshold) {
                this.dragging = true;
                this.canvas.style.cursor = 'move';
            } else { // no dot attach to that line, add one
                const intersectionResult = this.findNearestIntersection(line, mousePos);
                if (intersectionResult.point) {
                    line.dot = intersectionResult.point;
                    line.intersectedCurve = intersectionResult.curve;
                }

                if (this.isSlant(line.id)) {
                    this.selectedSlantLine = line;
                    this.displayRotationIcon(mousePos.x, mousePos.y);
                } else {
                    this.displayMaxMinButton(mousePos.x, mousePos.y);
                }

                this.dragging = true;
                this.canvas.style.cursor = 'move';
            }
    
            this.renderer.drawSymbol(this.annotation);
        }
    }

    findNearestIntersection(line: MetricLine, mousePos: Point): { point: Point | null, curve: Curve | null } {
        let nearestIntersection: Point | null = null;
        let nearestCurve: Curve | null = null;
        let minDistance = Number.MAX_VALUE;

        this.annotation.symbols.curves.forEach(curve => {
            if (curve.type === 'points' && Array.isArray(curve.data)) {
                for (let i = 0; i < curve.data.length - 1; i++) {
                    const segmentStart = curve.data[i];
                    const segmentEnd = curve.data[i + 1];

                    const intersection = this.findIntersection(line, segmentStart, segmentEnd);
                    if (intersection) {
                        const distance = this.calculateDistance(mousePos, intersection);
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestIntersection = intersection;
                            nearestCurve = curve;
                        }
                    }
                }
            }
        });

        return { point: nearestIntersection, curve: nearestCurve };
    }


    findIntersection(line: MetricLine, segmentStart: Point, segmentEnd: Point): Point | null {
        const dx = segmentEnd.x - segmentStart.x;
        const isSegmentAlmostVertical = Math.abs(dx) < 1e-10;
    
        let segmentSlope, segmentIntercept;
        if (!isSegmentAlmostVertical) {
            // Regular case for non-vertical segments
            segmentSlope = (segmentEnd.y - segmentStart.y) / dx;
            segmentIntercept = segmentStart.y - segmentSlope * segmentStart.x;
        }
    
        const lineSlope = Math.tan(line.angle * Math.PI / 180);
        const lineIntercept = line.y - lineSlope * line.x;
    
        if (isSegmentAlmostVertical) {
            const x = segmentStart.x;
            const y = lineSlope * x + lineIntercept;
    
            // Check if y is within the segment's y-range
            const withinSegmentYRange = y >= Math.min(segmentStart.y, segmentEnd.y) && y <= Math.max(segmentStart.y, segmentEnd.y);
            return withinSegmentYRange ? { x, y } : null;
        } else if (lineSlope === segmentSlope) {
            return null; // Parallel or identical lines
        } else {
            const x = (segmentIntercept - lineIntercept) / (lineSlope - segmentSlope);
            const y = lineSlope * x + lineIntercept;
    
            // Check if the intersection point is within the line segment
            const withinSegment = x >= Math.min(segmentStart.x, segmentEnd.x) &&
                                  x <= Math.max(segmentStart.x, segmentEnd.x) &&
                                  y >= Math.min(segmentStart.y, segmentEnd.y) &&
                                  y <= Math.max(segmentStart.y, segmentEnd.y);
            return withinSegment ? { x, y } : null;
        }
    }

    handleMouseMove(event: MouseEvent): void {
        if (this.dragging && this.selectedLine) {
            const mousePos = this.getMousePosition(event);

            // Calculate the movement of the line
            const deltaX = mousePos.x - this.selectedLine.x;
            const deltaY = mousePos.y - this.selectedLine.y;

            // record original location
            const originalX = this.selectedLine.x;
            const originalY = this.selectedLine.y;

            // Update the position of the line
            this.selectedLine.x += deltaX;
            this.selectedLine.y += deltaY;

            // If there's a dot and an intersected curve, recalculate the dot's position
            if (this.selectedLine.dot && this.selectedLine.intersectedCurve) {
                const newIntersection = this.calculateIntersectionWithCurve(this.selectedLine, this.selectedLine.intersectedCurve);
                if (newIntersection) {
                    // Update the dot's position to the new intersection
                    this.selectedLine.dot = newIntersection;
                } else {
                    this.selectedLine.x = originalX;
                    this.selectedLine.y = originalY;
                }
            }

            // Redraw the canvas with the updated line and dot positions
            this.renderer.drawSymbol(this.annotation);
        }
    } 

    calculateIntersectionWithCurve(line: MetricLine, curve: Curve): Point | null {
        let nearestIntersection: Point | null = null;
        let minDistance = Number.MAX_VALUE;

        if (curve.type === 'polynomial') {
            // This is a placeholder for the logic
            return null;
        } else if (curve.type === 'points' && Array.isArray(curve.data)) {
            // For point-based curves, check intersection with each segment
            for (let i = 0; i < curve.data.length - 1; i++) {
                const segmentStart = curve.data[i];
                const segmentEnd = curve.data[i + 1];
    
                const intersection = this.findIntersection(line, segmentStart, segmentEnd);
                if (intersection && line.dot) {
                    const distance = this.calculateDistance(line.dot, intersection);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestIntersection = intersection;
                    }
                }
            }
        }
        return nearestIntersection;
    }
    

    handleMouseUp(event: MouseEvent): void {
        const mousePos = this.getMousePosition(event);
        // Stop dragging when the mouse button is released
        this.dragging = false;
        this.selectedLine = null;
        this.canvas.style.cursor = 'default'; // Reset the cursor

        // Check if any metric line is selected
        const line = this.findLineAtPosition(mousePos.x, mousePos.y);
        if (line) {
            if (this.isSlant(line.id)) {
                // Position the rotation icon near the selected slant line
                this.displayRotationIcon(mousePos.x, mousePos.y);
            } else {
                this.displayMaxMinButton(mousePos.x, mousePos.y);
            }
        }
    }

    findLineAtPosition(mouseX: number, mouseY: number): MetricLine | null {
        for (const line of this.annotation.metricLines) {
            if (Math.abs(mouseY - line.y) <= this.threshold && !this.isSlant(line.id)) {
                // For non-slant lines (assuming horizontal)
                return line;
            } else if (this.isSlant(line.id)) {
                // Convert angle to radians for calculations
                const angleRadians = line.angle * Math.PI / 180;
                // Assuming a fixed length for the slant line for simplicity, you can adjust this as needed
                const lineLength = 100; 
                const endX = line.x + lineLength * Math.cos(angleRadians);
                const endY = line.y + lineLength * Math.sin(angleRadians);
    
                if (this.isPointNearLine(mouseX, mouseY, line.x, line.y, endX, endY, this.threshold)) {
                    return line;
                }
            }
        }
        return null;
    }

    // Method to add or update a dot on a MetricLine
    addOrUpdateDot(line: MetricLine, newDotPosition: Point, threshold: number): void {
        if (line.dot) {
            // If there's already a dot, check the distance to the new position
            const distance = this.calculateDistance(line.dot, newDotPosition);
            if (distance > threshold) {
                // Replace the old dot if the new one is farther than the threshold
                line.dot = newDotPosition;
            } else {
                // If the new dot is too close to the old one, remove ut
                line.dot = null;
            }
        } else {
            // If there's no dot yet, simply add the new one
            line.dot = newDotPosition;
        }

        // Redraw to show the updated dot
        this.renderer.drawSymbol(this.annotation);
    }

    calculateDistance(point1: Point, point2: Point): number {
        return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
    }
    
    isPointNearLine(mouseX: number, mouseY: number, x1: number, y1: number, x2: number, y2: number, threshold: number): boolean {
        // Calculate the line length using the Pythagorean theorem
        const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const distance = Math.abs((y2 - y1) * mouseX - (x2 - x1) * mouseY + x2 * y1 - y2 * x1) / lineLength;
        return distance <= threshold;
    }

    setupRotationEventListeners(): void {
        if (!this.rotationIcon) {
            return;
        }
    
        let isRotating = false;
        let startAngle = 0;
        let initialLineAngle = 0
    
        this.rotationIcon.addEventListener('mousedown', (event) => {
            if (this.rotationIcon && this.selectedSlantLine){
                isRotating = true;
                startAngle = this.calculateAngle(event.clientX, event.clientY);
                initialLineAngle = this.selectedSlantLine.angle;

                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing'; // Change the cursor to indicate active rotation
        
                event.stopPropagation(); // Prevent the mousedown event from bubbling to the canvas
            }
        });
    
        window.addEventListener('mousemove', (event) => {
            if (isRotating) {
                const currentAngle = this.calculateAngle(event.clientX, event.clientY);
                let angleDelta = currentAngle - startAngle;

                // Snap rotation to 5 degree intervals for more control
                const rotationSnap = 5;
                angleDelta = Math.round(angleDelta / rotationSnap) * rotationSnap;

                if (this.selectedSlantLine) {
                    const originalAngle = this.selectedSlantLine.angle;
                    // Update the angle of the slant line
                    this.selectedSlantLine.angle = (initialLineAngle + angleDelta) % 360;

                    if (this.selectedSlantLine.intersectedCurve) {
                        const newIntersection = this.calculateIntersectionWithCurve(this.selectedSlantLine, this.selectedSlantLine.intersectedCurve);
                        if (newIntersection) {
                            this.selectedSlantLine.dot = newIntersection;
                        } else {
                            this.selectedSlantLine.angle = originalAngle;
                        }
                    }

                    // Redraw the canvas with the updated line rotation
                    this.renderer.drawSymbol(this.annotation);
                }
            }
        });
    
        window.addEventListener('mouseup', () => {
            isRotating = false;

            document.body.style.userSelect = '';
            document.body.style.cursor = 'default'; // Revert the cursor
        });
    }

    setupLocalMaxMinEventListeners() {
        if (!this.localMaxButton || !this.localMinButton) {
            return;
        }

        this.localMaxButton.addEventListener('click', (event) => {
            const selectedLine = this.findSelectedLine();
            if (selectedLine && selectedLine.intersectedCurve) {
                this.moveToLocalExtremum(selectedLine, 'max');
            }
        });

        this.localMinButton.addEventListener('click', (event) => {
            const selectedLine = this.findSelectedLine();
            if (selectedLine && selectedLine.intersectedCurve) {
                this.moveToLocalExtremum(selectedLine, 'min');
            }
        });
    }

    findSelectedLine() {
        for (let i = 0; i < this.annotation.metricLines.length; i++) {
            const line = this.annotation.metricLines[i];
            if (line.isSelected) {
                return line;
            }
        }
        return null; // Return null if no line is selected
    }

    moveToLocalExtremum(line, type) {
        const curve = line.intersectedCurve;
        if (!curve || !Array.isArray(curve.data)) {
            return; // Exit if the curve is not defined or curve.data is not an array
        }
        let closestExtremumPoint: Point | null = null;
        let minDistance = Infinity;
    
        for (let i = 0; i < curve.data.length; i++) {
            let isExtremum = false;
            if (i === 0) {
                isExtremum = (type === 'max') ? curve.data[i].y < curve.data[i + 1].y : curve.data[i].y > curve.data[i + 1].y;
            } else if (i === curve.data.length - 1) {
                isExtremum = (type === 'max') ? curve.data[i].y < curve.data[i - 1].y : curve.data[i].y > curve.data[i - 1].y;
            } else {
                isExtremum = (type === 'max') ? 
                    curve.data[i].y < curve.data[i - 1].y && curve.data[i].y < curve.data[i + 1].y :
                    curve.data[i].y > curve.data[i - 1].y && curve.data[i].y > curve.data[i + 1].y;
            }
    
            if (isExtremum) {
                const distance = this.calculateDistance(line.dot, curve.data[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestExtremumPoint = curve.data[i];
                }
            }
        }
    
        if (closestExtremumPoint) {
            line.y = closestExtremumPoint.y;
            line.dot = closestExtremumPoint;
            // Redraw the canvas
            this.renderer.drawSymbol(this.annotation);
        }
    }

    setupfileInputButtonEventListeners(): void {
        if (!this.fileInputButton) {
            return;
        }
        
        const interactiveCanvas = this; // Reference to the InteractiveCanvas instance
        
        this.fileInputButton.addEventListener('change', function(event) {
            const fileInput = event.target as HTMLInputElement; // Cast event.target to HTMLInputElement
            if (fileInput && fileInput.files) {
                const file = fileInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileReader = e.target;
                        if (fileReader && typeof fileReader.result === 'string') {
                            const content = fileReader.result;
                            const parser = new InkMLParser();
                            const symbol = parser.parseInkML(content);
                            
                            // reset everything
                            interactiveCanvas.deselectAllCheckboxes(3);
                            
                            interactiveCanvas.currentX = null;
                            interactiveCanvas.currentY = null;
                            interactiveCanvas.selectedLine = null;
                            interactiveCanvas.selectedSlantLine = null;

                            interactiveCanvas.rotationIcon.style.display = 'none';
                            interactiveCanvas.localMaxButton.style.display = 'none';
                            interactiveCanvas.localMinButton.style.display = 'none';
                            
                            // update symbol
                            interactiveCanvas.annotation = new Annotation(symbol);
                            interactiveCanvas.renderer.drawSymbol(interactiveCanvas.annotation);
                        }
                    };
                    reader.readAsText(file);
                }
            }
        });
    }

    deselectAllCheckboxes(checkboxNum: number) {
        for (let checkboxID = 1; checkboxID <= checkboxNum; checkboxID++) { // Assuming 3 checkbox containers
            const container = document.getElementById('checkboxes-container-' + checkboxID);
            if (container) {
                const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach((checkboxElement) => {
                    const checkbox = checkboxElement as HTMLInputElement; // Type assertion
                    checkbox.checked = false;
                });
            }
        }

        const slantContainer = document.getElementById('slant-checkboxes-container');
        if (slantContainer) {
            const slantCheckboxes = slantContainer.querySelectorAll('input[type="checkbox"]');
            slantCheckboxes.forEach((checkboxElement) => {
                const checkbox = checkboxElement as HTMLInputElement;
                checkbox.checked = false;
            });
        }
    }
       

    setupSaveButtonEventListeners(): void {
        if (!this.saveButton) {
            return;
        }
        this.saveButton.addEventListener('click', () => {
            // Logic to compile and save data
            const dataToSave = this.annotation.symbols.curves.map(curve => {
                const linesWithCurve = this.annotation.metricLines.filter(line => line.intersectedCurve === curve);
                return {
                    curveId: curve.data, // Assuming each curve has an ID
                    lines: linesWithCurve.map(line => ({
                        lineId: line.id,
                        dotPosition: line.dot ? this.calculateDotPositionProportion(line, curve) : null
                    }))
                };
            });

            const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'curves_data.json';
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    calculateDotPositionProportion(line, curve) {
        // Assuming a point-based curve and line segment
        if (curve.type === 'points' && line.dot) {
            let totalLength = 0;
            for (let i = 0; i < curve.data.length - 1; i++) {
                totalLength += this.calculateDistance(curve.data[i], curve.data[i + 1]);
            }

            let distance = 0;
            for (let i = 0; i < curve.data.length - 1; i++) {
                if (this.isDotOnLineSegment(line.dot, curve.data[i], curve.data[i + 1])) {
                    distance += this.calculateDistance(curve.data[i], line.dot);
                    break;
                } else {
                    distance += this.calculateDistance(curve.data[i], curve.data[i + 1]);
                }
            }
            return distance / totalLength;
        }
        return 0; // Default return if not a point-based curve or no dot
    }

    isDotOnLineSegment(dot, startPoint, endPoint) {
        // Check if dot is within the bounding box defined by startPoint and endPoint
        if (dot.x < Math.min(startPoint.x, endPoint.x) || dot.x > Math.max(startPoint.x, endPoint.x) ||
            dot.y < Math.min(startPoint.y, endPoint.y) || dot.y > Math.max(startPoint.y, endPoint.y)) {
            return false;
        }
    
        // Check if the dot, startPoint and endPoint are collinear
        // This can be done by comparing the slope of startPoint to dot and startPoint to endPoint
        const dy1 = dot.y - startPoint.y;
        const dx1 = dot.x - startPoint.x;
        const dy2 = endPoint.y - startPoint.y;
        const dx2 = endPoint.x - startPoint.x;
    
        // Compare slopes, considering floating point precision issues
        return Math.abs(dx1 * dy2 - dx2 * dy1) < 1e-10;
    }

    calculateAngle(x: number, y: number): number {
        const dx = x - (this.currentX ?? 0);
        const dy = y - (this.currentY ?? 0);
        let angle = Math.atan2(dy, dx) * (180 / Math.PI); // Convert radians to degrees
        angle = (angle + 360) % 360; // Ensure the angle is always positive
        return angle;
    }
    
}

class InkMLParser {
    parseInkML(inkML: string): Symbols {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(inkML, "application/xml");
        const traceElements = xmlDoc.getElementsByTagName("trace");
        const curves: Curve[] = [];

        for (let i = 0; i < traceElements.length; i++) {
            const traceContent = traceElements[i].textContent;

            if (traceContent) {
                const points = traceContent
                    .trim()
                    .split(',')
                    .map(p => {
                        const [x, y] = p.trim().split(' ').map(Number);
                        return { x, y };
                    });
                
                curves.push({ type: 'points', data: points });
            } else {
                console.error(`Trace element at index ${i} is empty.`);
            }
        }

        return new Symbols(curves);
    }
}


// // Parsing the InkML content to create a symbol
// const inkMLContent = `<ink xmlns="http://www.w3.org/2003/InkML">
// <trace>
//    10 0, 9 14, 8 28, 7 42, 6 56, 6 70, 8 84, 8 98, 8 112, 9 126, 10 140,
//    13 154, 14 168, 17 182, 18 188, 23 174, 30 160, 38 147, 49 135,
//    58 124, 72 121, 77 135, 80 149, 82 163, 84 177, 87 191, 93 205
// </trace>
// <trace>
//    130 155, 144 159, 158 160, 170 154, 179 143, 179 129, 166 125,
//    152 128, 140 136, 131 149, 126 163, 124 177, 128 190, 137 200,
//    150 208, 163 210, 178 208, 192 201, 205 192, 214 180
// </trace>
// <trace>
//    227 50, 226 64, 225 78, 227 92, 228 106, 228 120, 229 134,
//    230 148, 234 162, 235 176, 238 190, 241 204
// </trace>
// <trace>
//    282 45, 281 59, 284 73, 285 87, 287 101, 288 115, 290 129,
//    291 143, 294 157, 294 171, 294 185, 296 199, 300 213
// </trace>
// <trace>
//    366 130, 359 143, 354 157, 349 171, 352 185, 359 197,
//    371 204, 385 205, 398 202, 408 191, 413 177, 413 163,
//    405 150, 392 143, 378 141, 365 150
// </trace>
// </ink>`; // Your InkML content
// const parser = new InkMLParser();
// const symbol = parser.parseInkML(inkMLContent);

// Instantiate the renderer and annotation objects with the created symbol
const canvasRenderer = new CanvasRenderer('canvasId');
const annotation = new Annotation(new Symbols([]));

// Instantiate the interactive canvas
const interactiveCanvas = new InteractiveCanvas('canvasId', canvasRenderer, annotation);

// Draw the symbol on the canvas
canvasRenderer.drawSymbol(annotation);

// Now you can interact with the canvas, the symbol will be displayed,
// and you can begin annotating and manipulating the symbol and its metric lines.

