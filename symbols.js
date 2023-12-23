var Symbols = /** @class */ (function () {
    function Symbols(curves) {
        this.curves = curves;
    }
    return Symbols;
}());
var Annotation = /** @class */ (function () {
    function Annotation(symbols) {
        this.symbols = symbols;
        this.metricLines = [];
    }
    Annotation.prototype.addMetricLine = function (metricLine) {
        this.metricLines.push(metricLine);
    };
    Annotation.prototype.removeMetricLine = function (metricLineId) {
        this.metricLines = this.metricLines.filter(function (line) { return line.id !== metricLineId; });
    };
    return Annotation;
}());
var CanvasRenderer = /** @class */ (function () {
    function CanvasRenderer(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = 300;
    }
    CanvasRenderer.prototype.drawSymbol = function (annotation) {
        var _this = this;
        // Clear the canvas before drawing
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw the symbol (curves) here
        // This code will vary depending on the format of your symbol data
        annotation.symbols.curves.forEach(function (curve) {
            // Check if curve is a set of points
            if (curve.type === 'points') {
                _this.drawCurve(curve.data);
            }
            // If curve is defined by polynomial, need additional handling
        });
        // Draw metric lines
        this.drawMetricLines(annotation.metricLines);
    };
    CanvasRenderer.prototype.drawCurve = function (points) {
        var _this = this;
        if (points.length === 0)
            return;
        this.context.beginPath();
        this.context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(function (point) {
            _this.context.lineTo(point.x, point.y);
        });
        this.context.stroke(); // Draw the curve
    };
    CanvasRenderer.prototype.drawMetricLines = function (metricLines) {
        var _this = this;
        metricLines.forEach(function (line) {
            _this.context.save();
            _this.context.beginPath();
            // Use blue for selected lines, black for others
            _this.context.strokeStyle = line.isSelected ? 'blue' : 'black';
            _this.context.lineWidth = line.isSelected ? 2 : 1;
            var slope = Math.tan(line.angle * Math.PI / 180);
            // Calculate where the line intersects the canvas boundaries
            // We calculate two points: one on the left edge and one on the right edge of the canvas
            var leftY = line.y - slope * line.x;
            var rightY = line.y + slope * (_this.canvas.width - line.x);
            _this.context.moveTo(0, leftY);
            _this.context.lineTo(_this.canvas.width, rightY);
            _this.context.stroke();
            // Draw the label for the metric line
            _this.context.fillStyle = line.isSelected ? 'blue' : 'red'; // Text color for the label
            _this.context.fillText(line.label, 5, line.y - 5); // Position label above the line
            // Draw the dot if it exists
            if (line.dot) {
                _this.context.fillStyle = 'red';
                _this.context.beginPath();
                _this.context.arc(line.dot.x, line.dot.y, 5, 0, 2 * Math.PI); // 5 is the dot radius
                _this.context.fill();
            }
            _this.context.restore();
        });
    };
    return CanvasRenderer;
}());
var InteractiveCanvas = /** @class */ (function () {
    function InteractiveCanvas(canvasId, renderer, annotation) {
        this.threshold = 10;
        this.canvas = document.getElementById(canvasId);
        this.rotationIcon = document.getElementById('rotationIcon');
        this.localMaxButton = document.getElementById('button1');
        this.localMinButton = document.getElementById('button2');
        this.fileInputButton = document.getElementById('fileInput');
        this.saveButton = document.getElementById('saveButton');
        this.context = this.canvas.getContext('2d');
        this.renderer = renderer;
        this.annotation = annotation;
        this.currentX = null;
        this.currentY = null;
        this.selectedLine = null;
        this.selectedSlantLine = null;
        this.dragging = false;
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
    InteractiveCanvas.prototype.createCheckboxesForSlantMetricLines = function () {
        var _this = this;
        var container = document.getElementById('slant-checkboxes-container');
        if (container) {
            var metricLinesInfo = [
                { id: 'SLANT_1', label: 'Slant 1', defaultX: this.renderer.canvas.width * 0.5, defaultY: this.renderer.canvas.height * 0.5 },
                { id: 'SLANT_2', label: 'Slant 2', defaultX: this.renderer.canvas.width * 0.5, defaultY: this.renderer.canvas.height * 0.5 },
            ];
            container.innerHTML = ''; // Clear existing checkboxes
            metricLinesInfo.forEach(function (lineInfo) {
                var checkboxContainer = document.createElement('div'); // Container for the checkbox and label
                checkboxContainer.style.display = 'flex'; // Use flexbox to align items
                checkboxContainer.style.alignItems = 'center'; // Center align items vertically
                checkboxContainer.style.marginBottom = '5px'; // Add some space between rows
                var checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = "checkbox-".concat(lineInfo.id.toLowerCase());
                checkbox.name = lineInfo.id;
                checkbox.value = lineInfo.id;
                var label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = lineInfo.label;
                label.style.marginLeft = '5px'; // Add some space between the checkbox and label
                label.style.whiteSpace = 'nowrap'; // Prevent text from wrapping
                checkboxContainer.appendChild(checkbox); // Add the checkbox to the container
                checkboxContainer.appendChild(label); // Add the label to the container
                container.appendChild(checkboxContainer); // Add the container to the main container
                checkbox.addEventListener('change', _this.handleCheckboxChange.bind(_this, lineInfo.id, lineInfo.defaultX, lineInfo.defaultY));
            });
        }
        else {
            // Handle the case when the container is not found
            console.error('Slant Checkbox container element not found in the document.');
        }
    };
    InteractiveCanvas.prototype.createCheckboxesForNormalMetricLines = function (checkboxID) {
        var _this = this;
        var container = document.getElementById('checkboxes-container-' + checkboxID);
        if (container) {
            var metricLinesInfo = [
                { id: 'ASCENDER_LINE_' + checkboxID, label: 'Ascender Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.15 },
                { id: 'CAP_LINE_' + checkboxID, label: 'Cap Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.25 },
                { id: 'X_LINE_' + checkboxID, label: 'X Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.4 },
                { id: 'CENTER_LINE_' + checkboxID, label: 'Center Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.6 },
                { id: 'BASE_LINE_' + checkboxID, label: 'Base Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.8 },
                { id: 'DESCENDER_LINE_' + checkboxID, label: 'Descender Line ' + checkboxID, defaultX: 0, defaultY: this.renderer.canvas.height * 0.90 },
            ];
            container.innerHTML = ''; // Clear existing checkboxes
            metricLinesInfo.forEach(function (lineInfo) {
                var checkboxContainer = document.createElement('div'); // Container for the checkbox and label
                checkboxContainer.style.display = 'flex'; // Use flexbox to align items
                checkboxContainer.style.alignItems = 'center'; // Center align items vertically
                checkboxContainer.style.marginBottom = '5px'; // Add some space between rows
                var checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = "checkbox-".concat(lineInfo.id.toLowerCase());
                checkbox.name = lineInfo.id;
                checkbox.value = lineInfo.id;
                var label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = lineInfo.label;
                label.style.marginLeft = '5px'; // Add some space between the checkbox and label
                label.style.whiteSpace = 'nowrap'; // Prevent text from wrapping
                checkboxContainer.appendChild(checkbox); // Add the checkbox to the container
                checkboxContainer.appendChild(label); // Add the label to the container
                container.appendChild(checkboxContainer); // Add the container to the main container
                checkbox.addEventListener('change', _this.handleCheckboxChange.bind(_this, lineInfo.id, lineInfo.defaultX, lineInfo.defaultY));
            });
        }
        else {
            // Handle the case when the container is not found
            console.error('Checkbox container ' + checkboxID + ' element not found in the document.');
        }
    };
    InteractiveCanvas.prototype.isSlant = function (metricLineId) {
        return metricLineId.lastIndexOf('SLANT') === 0;
    };
    InteractiveCanvas.prototype.handleCheckboxChange = function (metricLineId, defaultX, defaultY, event) {
        var checkbox = event.target;
        var xCord = defaultX;
        var yCord = defaultY;
        if (this.currentX !== null && this.currentY !== null) { // delete this if we only need the default one
            xCord = this.currentX;
            yCord = this.currentY;
        }
        if (checkbox.checked) {
            var defaultAngle = (this.isSlant(metricLineId) ? -60 : 0);
            var newMetricLine = {
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
            if (this.isSlant(metricLineId)) {
                this.selectedSlantLine = newMetricLine;
                this.displayRotationIcon(xCord, yCord);
            }
            else {
                this.displayMaxMinButton(xCord, yCord);
            }
        }
        else {
            this.annotation.removeMetricLine(metricLineId);
            if (this.isSlant(metricLineId)) {
                this.selectedSlantLine = null;
                this.rotationIcon.style.display = 'none'; // Hide the rotation icon
            }
            else {
                this.localMaxButton.style.display = 'none';
                this.localMinButton.style.display = 'none';
            }
        }
        this.renderer.drawSymbol(this.annotation); // redraws the symbol and annotations
    };
    InteractiveCanvas.prototype.getMousePosition = function (event) {
        var canvasRect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top
        };
    };
    InteractiveCanvas.prototype.displayRotationIcon = function (x, y) {
        this.rotationIcon.style.position = 'absolute'; // Required for absolute positioning
        this.rotationIcon.style.left = "".concat(x, "px"); // X coordinate for positioning the icon
        this.rotationIcon.style.top = "".concat(y, "px"); // Y coordinate for positioning the icon
        this.rotationIcon.style.display = 'block'; // Make the rotation icon visible
    };
    InteractiveCanvas.prototype.displayMaxMinButton = function (x, y) {
        this.localMaxButton.style.position = 'absolute';
        this.localMaxButton.style.left = x + 'px';
        this.localMaxButton.style.top = (y - this.threshold) + 'px';
        this.localMaxButton.style.display = 'block'; // Show the button
        // Position the min button, slightly to the right of the max button
        this.localMinButton.style.position = 'absolute';
        this.localMinButton.style.left = (x + this.localMaxButton.offsetWidth + 10) + 'px';
        this.localMinButton.style.top = (y - this.threshold) + 'px';
        this.localMinButton.style.display = 'block'; // Show the button
    };
    InteractiveCanvas.prototype.handleMouseDown = function (event) {
        var mousePos = this.getMousePosition(event);
        this.currentX = mousePos.x; // Record the x-coordinate
        this.currentY = mousePos.y; // Record the y-coordinate
        // Check if any metric line is selected
        var line = this.findLineAtPosition(mousePos.x, mousePos.y);
        this.annotation.metricLines.forEach(function (l) { return l.isSelected = false; });
        if (line) {
            this.selectedLine = line;
            this.selectedLine.isSelected = true;
            if (line.dot && this.calculateDistance(mousePos, line.dot) < this.threshold) {
                // If the click is near the existing dot, remove it and don't enable dragging
                line.dot = null;
                this.dragging = false;
            }
            else if (line.dot && this.calculateDistance(mousePos, line.dot) >= this.threshold) {
                this.dragging = true;
                this.canvas.style.cursor = 'move';
            }
            else { // no dot attach to that line, add one
                var intersectionResult = this.findNearestIntersection(line, mousePos);
                if (intersectionResult.point) {
                    line.dot = intersectionResult.point;
                    line.intersectedCurve = intersectionResult.curve;
                }
                else {
                    var lineSlope = Math.tan(line.angle * Math.PI / 180);
                    var yOnLine = line.y + lineSlope * (mousePos.x - line.x);
                    line.dot = { x: mousePos.x, y: yOnLine };
                }
                if (this.isSlant(line.id)) {
                    this.selectedSlantLine = line;
                    this.displayRotationIcon(mousePos.x, mousePos.y);
                }
                else {
                    this.displayMaxMinButton(mousePos.x, mousePos.y);
                }
                this.dragging = true;
                this.canvas.style.cursor = 'move';
            }
            this.renderer.drawSymbol(this.annotation);
        }
    };
    InteractiveCanvas.prototype.findNearestIntersection = function (line, mousePos) {
        var _this = this;
        var nearestIntersection = null;
        var nearestCurve = null;
        var minDistance = Number.MAX_VALUE;
        this.annotation.symbols.curves.forEach(function (curve) {
            if (curve.type === 'points' && Array.isArray(curve.data)) {
                for (var i = 0; i < curve.data.length - 1; i++) {
                    var segmentStart = curve.data[i];
                    var segmentEnd = curve.data[i + 1];
                    var intersection = _this.findIntersection(line, segmentStart, segmentEnd);
                    if (intersection) {
                        var distance = _this.calculateDistance(mousePos, intersection);
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
    };
    InteractiveCanvas.prototype.findIntersection = function (line, segmentStart, segmentEnd) {
        var dx = segmentEnd.x - segmentStart.x;
        var isSegmentAlmostVertical = Math.abs(dx) < 1e-10;
        var segmentSlope, segmentIntercept;
        if (!isSegmentAlmostVertical) {
            // Regular case for non-vertical segments
            segmentSlope = (segmentEnd.y - segmentStart.y) / dx;
            segmentIntercept = segmentStart.y - segmentSlope * segmentStart.x;
        }
        var lineSlope = Math.tan(line.angle * Math.PI / 180);
        var lineIntercept = line.y - lineSlope * line.x;
        if (isSegmentAlmostVertical) {
            var x = segmentStart.x;
            var y = lineSlope * x + lineIntercept;
            // Check if y is within the segment's y-range
            var withinSegmentYRange = y >= Math.min(segmentStart.y, segmentEnd.y) && y <= Math.max(segmentStart.y, segmentEnd.y);
            return withinSegmentYRange ? { x: x, y: y } : null;
        }
        else if (lineSlope === segmentSlope) {
            return null; // Parallel or identical lines
        }
        else {
            var x = (segmentIntercept - lineIntercept) / (lineSlope - segmentSlope);
            var y = lineSlope * x + lineIntercept;
            // Check if the intersection point is within the line segment
            var withinSegment = x >= Math.min(segmentStart.x, segmentEnd.x) &&
                x <= Math.max(segmentStart.x, segmentEnd.x) &&
                y >= Math.min(segmentStart.y, segmentEnd.y) &&
                y <= Math.max(segmentStart.y, segmentEnd.y);
            return withinSegment ? { x: x, y: y } : null;
        }
    };
    InteractiveCanvas.prototype.handleMouseMove = function (event) {
        if (this.dragging && this.selectedLine) {
            var mousePos = this.getMousePosition(event);
            // Calculate the movement of the line
            var deltaX = mousePos.x - this.selectedLine.x;
            var deltaY = mousePos.y - this.selectedLine.y;
            // record original location
            var originalX = this.selectedLine.x;
            var originalY = this.selectedLine.y;
            // Update the position of the line
            this.selectedLine.x += deltaX;
            this.selectedLine.y += deltaY;
            // If there's a dot and an intersected curve, recalculate the dot's position
            if (this.selectedLine.dot && this.selectedLine.intersectedCurve) {
                var newIntersection = this.calculateIntersectionWithCurve(this.selectedLine, this.selectedLine.intersectedCurve);
                if (newIntersection) {
                    // Update the dot's position to the new intersection
                    this.selectedLine.dot = newIntersection;
                }
                else {
                    this.selectedLine.x = originalX;
                    this.selectedLine.y = originalY;
                }
            }
            // Redraw the canvas with the updated line and dot positions
            this.renderer.drawSymbol(this.annotation);
        }
    };
    InteractiveCanvas.prototype.calculateIntersectionWithCurve = function (line, curve) {
        var nearestIntersection = null;
        var minDistance = Number.MAX_VALUE;
        if (curve.type === 'polynomial') {
            // This is a placeholder for the logic
            return null;
        }
        else if (curve.type === 'points' && Array.isArray(curve.data)) {
            // For point-based curves, check intersection with each segment
            for (var i = 0; i < curve.data.length - 1; i++) {
                var segmentStart = curve.data[i];
                var segmentEnd = curve.data[i + 1];
                var intersection = this.findIntersection(line, segmentStart, segmentEnd);
                if (intersection && line.dot) {
                    var distance = this.calculateDistance(line.dot, intersection);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestIntersection = intersection;
                    }
                }
            }
        }
        return nearestIntersection;
    };
    InteractiveCanvas.prototype.handleMouseUp = function (event) {
        var mousePos = this.getMousePosition(event);
        // Stop dragging when the mouse button is released
        this.dragging = false;
        this.selectedLine = null;
        this.canvas.style.cursor = 'default'; // Reset the cursor
        // Check if any metric line is selected
        var line = this.findLineAtPosition(mousePos.x, mousePos.y);
        if (line) {
            if (this.isSlant(line.id)) {
                // Position the rotation icon near the selected slant line
                this.displayRotationIcon(mousePos.x, mousePos.y);
            }
            else {
                this.displayMaxMinButton(mousePos.x, mousePos.y);
            }
        }
    };
    InteractiveCanvas.prototype.findLineAtPosition = function (mouseX, mouseY) {
        for (var _i = 0, _a = this.annotation.metricLines; _i < _a.length; _i++) {
            var line = _a[_i];
            if (Math.abs(mouseY - line.y) <= this.threshold && !this.isSlant(line.id)) {
                // For non-slant lines (assuming horizontal)
                return line;
            }
            else if (this.isSlant(line.id)) {
                // Convert angle to radians for calculations
                var angleRadians = line.angle * Math.PI / 180;
                // Assuming a fixed length for the slant line for simplicity, you can adjust this as needed
                var lineLength = 100;
                var endX = line.x + lineLength * Math.cos(angleRadians);
                var endY = line.y + lineLength * Math.sin(angleRadians);
                if (this.isPointNearLine(mouseX, mouseY, line.x, line.y, endX, endY, this.threshold)) {
                    return line;
                }
            }
        }
        return null;
    };
    // Method to add or update a dot on a MetricLine
    InteractiveCanvas.prototype.addOrUpdateDot = function (line, newDotPosition, threshold) {
        if (line.dot) {
            // If there's already a dot, check the distance to the new position
            var distance = this.calculateDistance(line.dot, newDotPosition);
            if (distance > threshold) {
                // Replace the old dot if the new one is farther than the threshold
                line.dot = newDotPosition;
            }
            else {
                // If the new dot is too close to the old one, remove ut
                line.dot = null;
            }
        }
        else {
            // If there's no dot yet, simply add the new one
            line.dot = newDotPosition;
        }
        // Redraw to show the updated dot
        this.renderer.drawSymbol(this.annotation);
    };
    InteractiveCanvas.prototype.calculateDistance = function (point1, point2) {
        return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
    };
    InteractiveCanvas.prototype.isPointNearLine = function (mouseX, mouseY, x1, y1, x2, y2, threshold) {
        // Calculate the line length using the Pythagorean theorem
        var lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        var distance = Math.abs((y2 - y1) * mouseX - (x2 - x1) * mouseY + x2 * y1 - y2 * x1) / lineLength;
        return distance <= threshold;
    };
    InteractiveCanvas.prototype.setupRotationEventListeners = function () {
        var _this = this;
        if (!this.rotationIcon) {
            return;
        }
        var isRotating = false;
        var startAngle = 0;
        var initialLineAngle = 0;
        this.rotationIcon.addEventListener('mousedown', function (event) {
            if (_this.rotationIcon && _this.selectedSlantLine) {
                isRotating = true;
                startAngle = _this.calculateAngle(event.clientX, event.clientY);
                initialLineAngle = _this.selectedSlantLine.angle;
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing'; // Change the cursor to indicate active rotation
                event.stopPropagation(); // Prevent the mousedown event from bubbling to the canvas
            }
        });
        window.addEventListener('mousemove', function (event) {
            if (isRotating) {
                var currentAngle = _this.calculateAngle(event.clientX, event.clientY);
                var angleDelta = currentAngle - startAngle;
                // Snap rotation to 5 degree intervals for more control
                var rotationSnap = 5;
                angleDelta = Math.round(angleDelta / rotationSnap) * rotationSnap;
                if (_this.selectedSlantLine) {
                    var originalAngle = _this.selectedSlantLine.angle;
                    // Update the angle of the slant line
                    _this.selectedSlantLine.angle = (initialLineAngle + angleDelta) % 360;
                    if (_this.selectedSlantLine.intersectedCurve) {
                        var newIntersection = _this.calculateIntersectionWithCurve(_this.selectedSlantLine, _this.selectedSlantLine.intersectedCurve);
                        if (newIntersection) {
                            _this.selectedSlantLine.dot = newIntersection;
                        }
                        else {
                            _this.selectedSlantLine.angle = originalAngle;
                        }
                    }
                    // Redraw the canvas with the updated line rotation
                    _this.renderer.drawSymbol(_this.annotation);
                }
            }
        });
        window.addEventListener('mouseup', function () {
            isRotating = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = 'default'; // Revert the cursor
        });
        window.addEventListener('resize', function () {
            // Don't update the canvas width here
            // this.canvas.width = window.innerWidth; // Remove or comment out this line
        });
    };
    InteractiveCanvas.prototype.setupLocalMaxMinEventListeners = function () {
        var _this = this;
        if (!this.localMaxButton || !this.localMinButton) {
            return;
        }
        this.localMaxButton.addEventListener('click', function (event) {
            var selectedLine = _this.findSelectedLine();
            if (selectedLine && selectedLine.intersectedCurve) {
                _this.moveToLocalExtremum(selectedLine, 'max');
            }
        });
        this.localMinButton.addEventListener('click', function (event) {
            var selectedLine = _this.findSelectedLine();
            if (selectedLine && selectedLine.intersectedCurve) {
                _this.moveToLocalExtremum(selectedLine, 'min');
            }
        });
    };
    InteractiveCanvas.prototype.findSelectedLine = function () {
        for (var i = 0; i < this.annotation.metricLines.length; i++) {
            var line = this.annotation.metricLines[i];
            if (line.isSelected) {
                return line;
            }
        }
        return null; // Return null if no line is selected
    };
    InteractiveCanvas.prototype.moveToLocalExtremum = function (line, type) {
        var curve = line.intersectedCurve;
        if (!curve || !Array.isArray(curve.data)) {
            return; // Exit if the curve is not defined or curve.data is not an array
        }
        var closestExtremumPoint = null;
        var minDistance = Infinity;
        for (var i = 0; i < curve.data.length; i++) {
            var isExtremum = false;
            if (i === 0) {
                isExtremum = (type === 'max') ? curve.data[i].y < curve.data[i + 1].y : curve.data[i].y > curve.data[i + 1].y;
            }
            else if (i === curve.data.length - 1) {
                isExtremum = (type === 'max') ? curve.data[i].y < curve.data[i - 1].y : curve.data[i].y > curve.data[i - 1].y;
            }
            else {
                isExtremum = (type === 'max') ?
                    curve.data[i].y < curve.data[i - 1].y && curve.data[i].y < curve.data[i + 1].y :
                    curve.data[i].y > curve.data[i - 1].y && curve.data[i].y > curve.data[i + 1].y;
            }
            if (isExtremum) {
                var distance = this.calculateDistance(line.dot, curve.data[i]);
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
    };
    InteractiveCanvas.prototype.setupfileInputButtonEventListeners = function () {
        if (!this.fileInputButton) {
            return;
        }
        var interactiveCanvas = this; // Reference to the InteractiveCanvas instance
        this.fileInputButton.addEventListener('change', function (event) {
            var fileInput = event.target; // Cast event.target to HTMLInputElement
            if (fileInput && fileInput.files) {
                var file = fileInput.files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var fileReader = e.target;
                        if (fileReader && typeof fileReader.result === 'string') {
                            var content = fileReader.result;
                            var parser = new InkMLParser();
                            var symbol = parser.parseInkML(content);
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
    };
    InteractiveCanvas.prototype.deselectAllCheckboxes = function (checkboxNum) {
        for (var checkboxID = 1; checkboxID <= checkboxNum; checkboxID++) { // Assuming 3 checkbox containers
            var container = document.getElementById('checkboxes-container-' + checkboxID);
            if (container) {
                var checkboxes = container.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(function (checkboxElement) {
                    var checkbox = checkboxElement; // Type assertion
                    checkbox.checked = false;
                });
            }
        }
        var slantContainer = document.getElementById('slant-checkboxes-container');
        if (slantContainer) {
            var slantCheckboxes = slantContainer.querySelectorAll('input[type="checkbox"]');
            slantCheckboxes.forEach(function (checkboxElement) {
                var checkbox = checkboxElement;
                checkbox.checked = false;
            });
        }
    };
    InteractiveCanvas.prototype.setupSaveButtonEventListeners = function () {
        var _this = this;
        if (!this.saveButton) {
            return;
        }
        this.saveButton.addEventListener('click', function () {
            // Logic to compile and save data
            var dataToSave = _this.annotation.symbols.curves.map(function (curve) {
                var linesWithCurve = _this.annotation.metricLines.filter(function (line) { return line.intersectedCurve === curve; });
                return {
                    curveId: curve.data,
                    lines: linesWithCurve.map(function (line) { return ({
                        lineId: line.id,
                        dotPosition: line.dot ? _this.calculateDotPositionProportion(line, curve) : null
                    }); })
                };
            });
            var blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'curves_data.json';
            link.click();
            URL.revokeObjectURL(url);
        });
    };
    InteractiveCanvas.prototype.calculateDotPositionProportion = function (line, curve) {
        // Assuming a point-based curve and line segment
        if (curve.type === 'points' && line.dot) {
            var totalLength = 0;
            for (var i = 0; i < curve.data.length - 1; i++) {
                totalLength += this.calculateDistance(curve.data[i], curve.data[i + 1]);
            }
            var distance = 0;
            for (var i = 0; i < curve.data.length - 1; i++) {
                if (this.isDotOnLineSegment(line.dot, curve.data[i], curve.data[i + 1])) {
                    distance += this.calculateDistance(curve.data[i], line.dot);
                    break;
                }
                else {
                    distance += this.calculateDistance(curve.data[i], curve.data[i + 1]);
                }
            }
            return distance / totalLength;
        }
        return 0; // Default return if not a point-based curve or no dot
    };
    InteractiveCanvas.prototype.isDotOnLineSegment = function (dot, startPoint, endPoint) {
        // Check if dot is within the bounding box defined by startPoint and endPoint
        if (dot.x < Math.min(startPoint.x, endPoint.x) || dot.x > Math.max(startPoint.x, endPoint.x) ||
            dot.y < Math.min(startPoint.y, endPoint.y) || dot.y > Math.max(startPoint.y, endPoint.y)) {
            return false;
        }
        // Check if the dot, startPoint and endPoint are collinear
        // This can be done by comparing the slope of startPoint to dot and startPoint to endPoint
        var dy1 = dot.y - startPoint.y;
        var dx1 = dot.x - startPoint.x;
        var dy2 = endPoint.y - startPoint.y;
        var dx2 = endPoint.x - startPoint.x;
        // Compare slopes, considering floating point precision issues
        return Math.abs(dx1 * dy2 - dx2 * dy1) < 1e-10;
    };
    InteractiveCanvas.prototype.calculateAngle = function (x, y) {
        var _a, _b;
        var dx = x - ((_a = this.currentX) !== null && _a !== void 0 ? _a : 0);
        var dy = y - ((_b = this.currentY) !== null && _b !== void 0 ? _b : 0);
        var angle = Math.atan2(dy, dx) * (180 / Math.PI); // Convert radians to degrees
        angle = (angle + 360) % 360; // Ensure the angle is always positive
        return angle;
    };
    return InteractiveCanvas;
}());
var InkMLParser = /** @class */ (function () {
    function InkMLParser() {
    }
    InkMLParser.prototype.parseInkML = function (inkML) {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(inkML, "application/xml");
        var traceElements = xmlDoc.getElementsByTagName("trace");
        var curves = [];
        for (var i = 0; i < traceElements.length; i++) {
            var traceContent = traceElements[i].textContent;
            if (traceContent) {
                var points = traceContent
                    .trim()
                    .split(',')
                    .map(function (p) {
                    var _a = p.trim().split(' ').map(Number), x = _a[0], y = _a[1];
                    return { x: x, y: y };
                });
                curves.push({ type: 'points', data: points });
            }
            else {
                console.error("Trace element at index ".concat(i, " is empty."));
            }
        }
        return new Symbols(curves);
    };
    return InkMLParser;
}());
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
var canvasRenderer = new CanvasRenderer('canvasId');
var annotation = new Annotation(new Symbols([]));
// Instantiate the interactive canvas
var interactiveCanvas = new InteractiveCanvas('canvasId', canvasRenderer, annotation);
// Draw the symbol on the canvas
canvasRenderer.drawSymbol(annotation);
// Now you can interact with the canvas, the symbol will be displayed,
// and you can begin annotating and manipulating the symbol and its metric lines.
