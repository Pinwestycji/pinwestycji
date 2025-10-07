// Plik: chart.js - Wersja z zaawansowanymi wskaźnikami technicznymi

document.addEventListener('DOMContentLoaded', function() {
    
    
    // ... (bez zmian na początku pliku, aż do sekcji rysowania)
    let companyList = []; 
    const API_URL = 'https://pinwestycji.onrender.com';
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];

    // === GŁÓWNE WYKRESY ===
    const chartContainer = document.getElementById('tvchart');
    const mainChart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight || 450,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        timeScale: { timeVisible: true, secondsVisible: false }
    });

    const candlestickSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries, { upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)', borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)', wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)' });

    const projectionChartContainer = document.getElementById('projectionChart');
    const projectionChart = LightweightCharts.createChart(projectionChartContainer, { width: projectionChartContainer.clientWidth, height: 300, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, rightPriceScale: { borderColor: '#cccccc' }, timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false } });

    const priceSeries = projectionChart.addSeries(LightweightCharts.HistogramSeries);
    priceSeries.applyOptions({ color: '#007bff' });

    let volumeChart = null;
    let volumeSeries = null;
    let rsiChart = null;
    let macdChart = null;
    let obvChart = null;

    let candlestickData = [];
    let activeIndicators = {};

    // === ELEMENTY DOM ===
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');
    const projectionTableBody = document.getElementById('projectionTableBody');


    // Plik: chart.js

// === SEKCJA RYSOWANIA - WERSJA OPARTA NA INDEKSACH LOGICZNYCH ===
    
    
    let drawingMode = null; 
    let drawingPoints = [];
    let drawnShapes = [];
    let currentMousePoint = null; 
    let chartPaneDimensions = { x: 0, y: 0, width: 0, height: 0 }; 
    let shapeCounters = { trendline: 0, hline: 0, vline: 0, channel: 0 }; // <--- DODAJ TĘ LINIĘ
    let lineColor = document.getElementById('lineColor').value;
    let lineWidth = parseInt(document.getElementById('lineWidth').value, 10);
    let drawingTooltip = null; // Przechowa element tooltipa
    let hoveredShapeId = null; // Przechowa ID kształtu, nad którym jest kursor
    // === POCZĄTEK NOWEGO KODU ===
    let selectedShapeId = null;
    let isDragging = false;
    let draggedHandleIndex = null;
    const HANDLE_SIZE = 5; // Rozmiar (promień) uchwytów w pikselach
    // === KONIEC NOWEGO KODU ===
    
    const drawingCanvas = document.getElementById("drawingCanvas");
    const ctx = drawingCanvas.getContext("2d");

    document.getElementById('lineColor').addEventListener('input', (e) => { lineColor = e.target.value; });
    document.getElementById('lineWidth').addEventListener('input', (e) => { lineWidth = parseInt(e.target.value, 10); });
    document.getElementById('clearDrawingButton').addEventListener('click', clearDrawings);

    // Plik: chart.js - SEKCJA RYSOWANIA

    /**
     * Oblicza najkrótszą odległość od punktu p do odcinka linii (p1, p2).
     * @param {{x: number, y: number}} p - Punkt (np. kursor myszy).
     * @param {{x: number, y: number}} p1 - Początek odcinka.
     * @param {{x: number, y: number}} p2 - Koniec odcinka.
     * @returns {number} - Odległość w pikselach.
     */
    function getDistanceToLineSegment(p, p1, p2) {
        const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
        if (l2 === 0) return Math.sqrt((p.x - p1.x) ** 2 + (p.y - p1.y) ** 2);
        
        let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
    
        const closestX = p1.x + t * (p2.x - p1.x);
        const closestY = p1.y + t * (p2.y - p1.y);
    
        return Math.sqrt((p.x - closestX) ** 2 + (p.y - closestY) ** 2);
    }

        // Plik: chart.js - funkcja handleTooltipLogic
    function handleTooltipLogic(param) {
        if (!param.point || drawnShapes.length === 0 || drawingMode) {
            drawingTooltip.style.display = 'none';
            hoveredShapeId = null;
            return;
        }
    
        const mousePoint = { x: param.point.x, y: param.point.y };
        const HIT_THRESHOLD = 5;
        let foundShape = null;
    
        for (let i = drawnShapes.length - 1; i >= 0; i--) {
            const shape = drawnShapes[i];
            let distance = Infinity;
            // ... (cała logika obliczania odległości bez zmian) ...
            if (shape.type === 'hline') {
                const y_coord = candlestickSeries.priceToCoordinate(shape.price);
                if (y_coord !== null) {
                    distance = Math.abs(mousePoint.y - y_coord);
                }
            } else if (shape.type === 'vline') {
                const x_coord = mainChart.timeScale().logicalToCoordinate(shape.logical);
                if (x_coord !== null) {
                    distance = Math.abs(mousePoint.x - x_coord);
                }
            } else if (shape.type === 'trendline') {
                const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
                if (p1_coord.x !== null && p2_coord.x !== null) {
                    distance = getDistanceToLineSegment(mousePoint, p1_coord, p2_coord);
                }
            } else if (shape.type === 'channel') {
                 const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                 const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
                 if (p1_coord.x !== null && p2_coord.x !== null) {
                    const p3_y_coord = candlestickSeries.priceToCoordinate(shape.p3.price);
                    const interpolatedPrice = interpolatePriceByLogical(shape.p1, shape.p2, shape.p3.logical);
                    const p1_y_coord_at_p3_logical = candlestickSeries.priceToCoordinate(interpolatedPrice);
                    const dy = p3_y_coord - p1_y_coord_at_p3_logical;
                    const p1_parallel = {x: p1_coord.x, y: p1_coord.y + dy};
                    const p2_parallel = {x: p2_coord.x, y: p2_coord.y + dy};
                    const dist1 = getDistanceToLineSegment(mousePoint, p1_coord, p2_coord);
                    const dist2 = getDistanceToLineSegment(mousePoint, p1_parallel, p2_parallel);
                    distance = Math.min(dist1, dist2);
                 }
            }
    
            if (distance < HIT_THRESHOLD) {
                foundShape = shape;
                break;
            }
        }
    
        if (foundShape) {
            hoveredShapeId = foundShape.id; // Ustawiamy, nad czym jest kursor
            drawingTooltip.style.display = 'block';
            drawingTooltip.textContent = foundShape.id;
            drawingTooltip.style.left = (mousePoint.x + 15) + 'px';
            drawingTooltip.style.top = (mousePoint.y + 15) + 'px';
            // USUNIĘTO LINIĘ: chartContainer.style.cursor = 'pointer';
        } else {
            hoveredShapeId = null; // Zerujemy, jeśli kursor nie jest nad niczym
            drawingTooltip.style.display = 'none';
            // USUNIĘTO LINIĘ: chartContainer.style.cursor = ...;
        }
    }

    // Plik: chart.js

    function getShapeHandles(shape) {
        const handles = [];
        if (shape.type === 'trendline') {
            const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
            const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
            if (p1_coord.x !== null) handles.push(p1_coord);
            if (p2_coord.x !== null) handles.push(p2_coord);
        } else if (shape.type === 'hline') {
            const y_coord = candlestickSeries.priceToCoordinate(shape.price);
            const x_coord = chartPaneDimensions.x + chartPaneDimensions.width / 2; // Środek widocznego obszaru
            if (y_coord !== null) handles.push({ x: x_coord, y: y_coord });
        } 
        // === POCZĄTEK NOWEGO KODU ===
        else if (shape.type === 'vline') {
            const x_coord = mainChart.timeScale().logicalToCoordinate(shape.logical);
            const y_coord = chartPaneDimensions.y + chartPaneDimensions.height / 2; // Środek widocznego obszaru
            if (x_coord !== null) handles.push({ x: x_coord, y: y_coord });
        } else if (shape.type === 'channel') {
            const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
            const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
            const p3_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p3.logical), y: candlestickSeries.priceToCoordinate(shape.p3.price) };
            if (p1_coord.x !== null) handles.push(p1_coord);
            if (p2_coord.x !== null) handles.push(p2_coord);
            if (p3_coord.x !== null) handles.push(p3_coord);
        }
        // === KONIEC NOWEGO KODU ===
        return handles;
    }

    // Plik: chart.js

    function clearDrawings() {
        drawnShapes = [];
        drawingPoints = [];
        drawingMode = null;
        selectedShapeId = null; // <-- WAŻNE: Dodaj też resetowanie zaznaczenia
        shapeCounters = { trendline: 0, hline: 0, vline: 0, channel: 0 };
        updateClearButtonUI();
   //     updateCanvasPointerEvents(); // <-- DODAJ TĘ LINIĘ
    }

    
    // Plik: chart.js
    function removeShapeById(id) {
        // Jeśli usuwamy aktualnie zaznaczony kształt, musimy go "odznaczyć"
        if (selectedShapeId === id) {
            selectedShapeId = null;
      //      updateCanvasPointerEvents(); // I zaktualizować interaktywność płótna
        }
        drawnShapes = drawnShapes.filter(shape => shape.id !== id);
        updateClearButtonUI();
    }

    
    function updateClearButtonUI() {
        const mainButton = document.getElementById('clearDrawingButton');
        const dropdownToggle = document.getElementById('clearDropdownToggle');
        const dropdownMenu = document.getElementById('clearDropdownMenu');
        
        // Usuwamy wszystkie stare event listenery, aby uniknąć ich duplikacji
        mainButton.replaceWith(mainButton.cloneNode(true));
        document.getElementById('clearDrawingButton').addEventListener('click', clearDrawings);
    
    
        if (drawnShapes.length === 0) {
            // Stan domyślny: brak linii, przycisk czyści wszystko (co jest puste)
            dropdownToggle.style.display = 'none';
            dropdownMenu.innerHTML = '';
        } else {
            // Stan z liniami: pokazujemy strzałkę i budujemy menu
            dropdownToggle.style.display = '';
            dropdownMenu.innerHTML = ''; // Czyścimy stare menu
    
            drawnShapes.forEach(shape => {
                const item = document.createElement('a');
                item.className = 'dropdown-item d-flex align-items-center';
                item.href = '#';
                
                // Kwadracik z kolorem
                const colorSwatch = document.createElement('span');
                colorSwatch.style.backgroundColor = shape.color;
                colorSwatch.style.width = '15px';
                colorSwatch.style.height = '15px';
                colorSwatch.style.marginRight = '10px';
                colorSwatch.style.border = '1px solid #ccc';
    
                item.appendChild(colorSwatch);
                item.appendChild(document.createTextNode(shape.id)); // Używamy ID kształtu
                
                item.onclick = (e) => {
                    e.preventDefault();
                    removeShapeById(shape.id);
                };
                dropdownMenu.appendChild(item);
            });
    
            // Dodajemy separator i opcję "Wyczyść wszystko"
            const divider = document.createElement('div');
            divider.className = 'dropdown-divider';
            dropdownMenu.appendChild(divider);
    
            const clearAllItem = document.createElement('a');
            clearAllItem.className = 'dropdown-item';
            clearAllItem.href = '#';
            clearAllItem.textContent = 'Wyczyść wszystko';
            clearAllItem.onclick = (e) => {
                e.preventDefault();
                clearDrawings();
            };
            dropdownMenu.appendChild(clearAllItem);
        }
    }

    function masterRedraw() {
        const ratio = window.devicePixelRatio || 1;
        const canvasWidth = drawingCanvas.width / ratio;
        const canvasHeight = drawingCanvas.height / ratio;
    
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
        // === POCZĄTEK NOWEGO KODU ===
        ctx.save(); // Zapisujemy aktualny stan kontekstu (bez przycinania)
        
        // Tworzymy ścieżkę przycinania
        ctx.beginPath();
        ctx.rect(
            chartPaneDimensions.x, 
            chartPaneDimensions.y, 
            chartPaneDimensions.width, 
            chartPaneDimensions.height
        );
        ctx.clip(); // Aktywujemy przycinanie - wszystko rysowane poniżej pojawi się tylko w tym prostokącie
        // === KONIEC NOWEGO KODU ===
    
        // Te funkcje teraz będą rysować tylko w przyciętym obszarze
        redrawShapes();
        drawCurrentShape();
    
        // === POCZĄTEK NOWEGO KODU ===
        ctx.restore(); // Przywracamy kontekst do stanu sprzed przycięcia
        // === KONIEC NOWEGO KODU ===
    }

    // Plik: chart.js

    // Zastąp całą funkcję redrawShapes
    function redrawShapes() {
        drawnShapes.forEach(shape => {
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = shape.width;
            ctx.beginPath();
    
            // ... cała dotychczasowa logika rysowania linii (if-else dla typów) bez zmian ...
            if (shape.type === 'trendline') {
                const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
                if (p1_coord.x !== null && p2_coord.x !== null) {
                    ctx.moveTo(p1_coord.x, p1_coord.y);
                    ctx.lineTo(p2_coord.x, p2_coord.y);
                }
            } else if (shape.type === 'hline') {
                const y_coord = candlestickSeries.priceToCoordinate(shape.price);
                if (y_coord !== null) {
                    const ratio = window.devicePixelRatio || 1;
                    ctx.moveTo(0, y_coord);
                    ctx.lineTo(drawingCanvas.width / ratio, y_coord);
                }
            } else if (shape.type === 'vline') {
                const x_coord = mainChart.timeScale().logicalToCoordinate(shape.logical);
                if (x_coord !== null) {
                    const ratio = window.devicePixelRatio || 1;
                    ctx.moveTo(x_coord, 0);
                    ctx.lineTo(x_coord, drawingCanvas.height / ratio);
                }
            } else if (shape.type === 'channel') {
                const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p1.logical), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(shape.p2.logical), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
                if (p1_coord.x !== null && p2_coord.x !== null) {
                    ctx.moveTo(p1_coord.x, p1_coord.y);
                    ctx.lineTo(p2_coord.x, p2_coord.y);
                    const p3_y_coord = candlestickSeries.priceToCoordinate(shape.p3.price);
                    const interpolatedPrice = interpolatePriceByLogical(shape.p1, shape.p2, shape.p3.logical);
                    const p1_y_coord_at_p3_logical = candlestickSeries.priceToCoordinate(interpolatedPrice);
                    if (p3_y_coord !== null && p1_y_coord_at_p3_logical !== null) {
                        const dy = p3_y_coord - p1_y_coord_at_p3_logical;
                        ctx.moveTo(p1_coord.x, p1_coord.y + dy);
                        ctx.lineTo(p2_coord.x, p2_coord.y + dy);
                    }
                }
            }
            ctx.stroke();
    
            // === POCZĄTEK NOWEGO KODU - RYSOWANIE UCHWYTÓW ===
            if (shape.id === selectedShapeId) {
                const handles = getShapeHandles(shape);
                handles.forEach(handle => {
                    ctx.beginPath();
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = shape.color;
                    ctx.lineWidth = 2;
                    ctx.arc(handle.x, handle.y, HANDLE_SIZE, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                });
            }
            // === KONIEC NOWEGO KODU ===
        });
    }

    // ZMIANA: Funkcje rysujące używają teraz 'logical' zamiast 'time'
    function drawCurrentShape() {
        if (drawingPoints.length === 0 || !currentMousePoint) return;

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        const p1 = drawingPoints[0];
        const p1_coord = { x: mainChart.timeScale().logicalToCoordinate(p1.logical), y: candlestickSeries.priceToCoordinate(p1.price) };

        if (p1_coord.x === null || p1_coord.y === null) return;

        if (drawingMode === 'trendline' && drawingPoints.length === 1) {
            ctx.moveTo(p1_coord.x, p1_coord.y);
            ctx.lineTo(currentMousePoint.x, currentMousePoint.y);
        } else if (drawingMode === 'channel') {
            if (drawingPoints.length === 1) {
                ctx.moveTo(p1_coord.x, p1_coord.y);
                ctx.lineTo(currentMousePoint.x, currentMousePoint.y);
            } else if (drawingPoints.length === 2) {
                const p2 = drawingPoints[1];
                const p2_coord = { x: mainChart.timeScale().logicalToCoordinate(p2.logical), y: candlestickSeries.priceToCoordinate(p2.price) };
                
                if (p2_coord.x === null || p2_coord.y === null) return;
                ctx.moveTo(p1_coord.x, p1_coord.y);
                ctx.lineTo(p2_coord.x, p2_coord.y);
                
                if (p2_coord.x === p1_coord.x) return;
                const m = (p2_coord.y - p1_coord.y) / (p2_coord.x - p1_coord.x);
                const c = p1_coord.y - m * p1_coord.x;
                const y_on_line = m * currentMousePoint.x + c;
                const dy = currentMousePoint.y - y_on_line;
                ctx.moveTo(p1_coord.x, p1_coord.y + dy);
                ctx.lineTo(p2_coord.x, p2_coord.y + dy);
            }
        }
        ctx.stroke();
    }
    
    // Plik: chart.js

    
    function resizeDrawingCanvas() {
        const rect = chartContainer.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        
        // Ustawienie rozmiarów samego płótna (tak jak było)
        drawingCanvas.style.width = rect.width + "px";
        drawingCanvas.style.height = rect.height + "px";
        drawingCanvas.width = Math.floor(rect.width * ratio);
        drawingCanvas.height = Math.floor(rect.height * ratio);
        ctx.scale(ratio, ratio);
    
        // Pobieramy wymiary osi, aby je "odjąć" od całego obszaru
        const priceScaleWidth = candlestickSeries.priceScale().width();
        const timeScaleHeight = mainChart.timeScale().height();
    
        // Zapisujemy wymiary obszaru WEWNĄTRZ osi (Z POPRAWKĄ)
        chartPaneDimensions = {
            x: 0, // <-- ZMIANA: Zaczynamy od lewej krawędzi
            y: 0, 
            width: rect.width - priceScaleWidth, // <-- Szerokość to całość minus oś cen po prawej
            height: rect.height - timeScaleHeight // <-- Wysokość to całość minus oś czasu na dole
        };
    }
    
        // Plik: chart.js
    window.setDrawingMode = function(mode) {
        drawingMode = mode;
        drawingPoints = [];
        selectedShapeId = null; // Odznacz wszystko, gdy zaczynasz rysować
        chartContainer.style.cursor = 'crosshair';
   //     updateCanvasPointerEvents(); // <-- DODAJ TĘ LINIĘ
    };

    // ZMIANA: Pobieramy 'logical' zamiast 'time'
    // Plik: chart.js - SEKCJA RYSOWANIA

    mainChart.subscribeCrosshairMove((param) => {
        // CAŁY STARY KOD Z TEJ FUNKCJI ZASTĄP PONIŻSZYM:
    
        // Logika dla podpowiedzi (tooltip)
        handleTooltipLogic(param);
    
        // Poniższa logika jest potrzebna tylko podczas aktywnego rysowania
        if (!drawingMode || drawingPoints.length === 0 || !param.point) {
            currentMousePoint = null;
            return;
        }
        const x = param.point.x;
        const y = param.point.y;
        const price = candlestickSeries.coordinateToPrice(y);
        const logical = mainChart.timeScale().coordinateToLogical(x);
        currentMousePoint = { x, y, logical, price };
    });

    // ZMIANA: Zapisujemy punkt z 'logical' zamiast 'time'

    mainChart.subscribeClick((param) => {
        // 1. Logika zaznaczania (gdy NIE jesteśmy w trybie rysowania)
        if (!drawingMode) {
            selectedShapeId = hoveredShapeId || null;
            return; // Zakończ. Kliknięcie albo zaznaczyło, albo odznaczyło kształt.
        }
    
        // 2. Logika rysowania (gdy JESTEŚMY w trybie rysowania)
        if (!param.point) return;
    
        const price = candlestickSeries.coordinateToPrice(param.point.y);
        const logical = mainChart.timeScale().coordinateToLogical(param.point.x);
        if (price === null || logical === null) return;
    
        const currentPoint = { logical, price };
        drawingPoints.push(currentPoint);
        
        let shapeAdded = false;
        
        // ... (reszta kodu rysującego kształty pozostaje bez zmian) ...
        if (drawingMode === 'hline') {
            shapeCounters.hline++;
            const id = `Pozioma ${shapeCounters.hline}`;
            drawnShapes.push({ type: "hline", id: id, price: currentPoint.price, color: lineColor, width: lineWidth });
            shapeAdded = true;
        } else if (drawingMode === 'vline') {
            shapeCounters.vline++;
            const id = `Pionowa ${shapeCounters.vline}`;
            drawnShapes.push({ type: "vline", id: id, logical: currentPoint.logical, color: lineColor, width: lineWidth });
            shapeAdded = true;
        } else if (drawingMode === 'trendline' && drawingPoints.length === 2) {
            shapeCounters.trendline++;
            const id = `Linia Trendu ${shapeCounters.trendline}`;
            drawnShapes.push({ type: 'trendline', id: id, p1: drawingPoints[0], p2: drawingPoints[1], color: lineColor, width: lineWidth });
            shapeAdded = true;
        } else if (drawingMode === 'channel' && drawingPoints.length === 3) {
            shapeCounters.channel++;
            const id = `Kanał ${shapeCounters.channel}`;
            const [p1, p2, p3] = drawingPoints;
            const interpolatedPrice = interpolatePriceByLogical(p1, p2, p3.logical);
            drawnShapes.push({ type: "channel", id: id, p1, p2, p3, interpolatedPrice: interpolatedPrice, color: lineColor, width: lineWidth });
            shapeAdded = true;
        }
        
        if (shapeAdded) {
            drawingMode = null;
            drawingPoints = [];
            updateClearButtonUI();
            chartContainer.style.cursor = 'default';
        }
    });
    // ZMIANA: Nowa funkcja pomocnicza operująca na 'logical'
    function interpolatePriceByLogical(p1, p2, targetLogical) {
        if (p1.logical === p2.logical) return p1.price; 
        const slope = (p2.price - p1.price) / (p2.logical - p1.logical);
        return p1.price + slope * (targetLogical - p1.logical);
    }
    
    resizeDrawingCanvas();
    window.addEventListener("resize", () => {
        mainChart.applyOptions({ width: chartContainer.clientWidth });
        resizeDrawingCanvas();
    });

    function animationLoop() {
        masterRedraw();
        requestAnimationFrame(animationLoop);
    }
    // Plik: chart.js

    function handleMouseDown(e) {
        if (!selectedShapeId) return;
    
        // ZMIANA TUTAJ: pobieramy 'rect' z chartContainer
        const rect = chartContainer.getBoundingClientRect(); 
        const mousePoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
        // ... (reszta funkcji bez zmian) ...
        const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);
        if (!selectedShape) return;
    
        const handles = getShapeHandles(selectedShape);
        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];
            const distance = Math.sqrt((mousePoint.x - handle.x)**2 + (mousePoint.y - handle.y)**2);
            if (distance <= HANDLE_SIZE) {
                isDragging = true;
                draggedHandleIndex = i;
                mainChart.applyOptions({ handleScroll: false, handleScale: false }); 
                return;
            }
        }
    }
    
        // Plik: chart.js

    function handleMouseMove(e) {
        const rect = chartContainer.getBoundingClientRect();
        const mousePoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
        // --- ZAKTUALIZOWANA LOGIKA KURORA I PRZECIĄGANIA ---
    
        let onHandle = false;
        // Sprawdzamy, czy kursor jest nad uchwytem ZAZNACZONEGO kształtu
        if (selectedShapeId && !isDragging) { 
            const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);
            if (selectedShape) {
                const handles = getShapeHandles(selectedShape);
                for (const handle of handles) {
                    const distance = Math.sqrt((mousePoint.x - handle.x)**2 + (mousePoint.y - handle.y)**2);
                    if (distance <= HANDLE_SIZE) {
                        onHandle = true;
                        break;
                    }
                }
            }
        }
        
        // Ustawiamy styl kursora na podstawie wszystkich możliwych stanów
        if (onHandle || isDragging) {
            chartContainer.style.cursor = 'move'; // Kursor "przesuń" nad uchwytem lub podczas przeciągania
        } else if (hoveredShapeId) {
            chartContainer.style.cursor = 'pointer'; // Kursor "rączki" nad DOWOLNYM kształtem
        } else if (drawingMode) {
            chartContainer.style.cursor = 'crosshair'; // Kursor rysowania
        } else {
            chartContainer.style.cursor = 'default'; // Domyślny kursor
        }
        
        // Logika przeciągania - jeśli nie przeciągamy, kończymy
        if (!isDragging) return;
        
        const price = candlestickSeries.coordinateToPrice(mousePoint.y);
        const logical = mainChart.timeScale().coordinateToLogical(mousePoint.x);
        if (price === null || logical === null) return;
    
        const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);
        
        if (selectedShape.type === 'trendline') {
            if (draggedHandleIndex === 0) {
                selectedShape.p1 = { price, logical };
            } else if (draggedHandleIndex === 1) {
                selectedShape.p2 = { price, logical };
            }
        } else if (selectedShape.type === 'hline') {
            selectedShape.price = price;
        } 
        // === POCZĄTEK NOWEGO KODU ===
        else if (selectedShape.type === 'vline') {
            selectedShape.logical = logical; // Zmieniamy tylko pozycję w czasie
        }else if (selectedShape.type === 'channel') {
            if (draggedHandleIndex === 0 || draggedHandleIndex === 1) {
                const oldP1 = { ...selectedShape.p1 };
                const oldP2 = { ...selectedShape.p2 };
                const oldP3 = { ...selectedShape.p3 };

                const oldInterpolatedPrice = interpolatePriceByLogical(oldP1, oldP2, oldP3.logical);
                const priceOffset = oldP3.price - oldInterpolatedPrice;

                const oldMidpointLogical = (oldP1.logical + oldP2.logical) / 2;
                const logicalOffset = oldP3.logical - oldMidpointLogical;

                if (draggedHandleIndex === 0) {
                    selectedShape.p1 = { price, logical };
                } else {
                    selectedShape.p2 = { price, logical };
                }

                const newMidpointLogical = (selectedShape.p1.logical + selectedShape.p2.logical) / 2;
                
                // <<< KLUCZOWA ZMIANA: Zaokrąglamy OSTATECZNY wynik >>>
                // To zapobiega błędom precyzji i niestabilności, które powodują miganie.
                selectedShape.p3.logical = Math.round(newMidpointLogical + logicalOffset);

                const newInterpolatedPrice = interpolatePriceByLogical(selectedShape.p1, selectedShape.p2, selectedShape.p3.logical);
                selectedShape.p3.price = newInterpolatedPrice + priceOffset;

            } else if (draggedHandleIndex === 2) {
                selectedShape.p3.price = price;
            }
        }

// ... fragment kodu po ...
        // === KONIEC NOWEGO KODU ===
    }
    
     function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            draggedHandleIndex = null;
            // Przywróć normalną interakcję z wykresem
            mainChart.applyOptions({ handleScroll: true, handleScale: true });
        }
        // Po puszczeniu myszy, stan się nie zmienia (kształt wciąż jest zaznaczony)
        // ale na wszelki wypadek można tu zostawić wywołanie
      //  updateCanvasPointerEvents();
    }
    
    animationLoop();
    updateClearButtonUI(); // <--- DODAJ TĘ LINIĘ

    // === POCZĄTEK NOWEGO KODU ===
//    drawingCanvas.addEventListener('mousedown', handleMouseDown);
 //   drawingCanvas.addEventListener('mousemove', handleMouseMove);
  //  window.addEventListener('mouseup', handleMouseUp); // Nasłuchujemy na całym oknie

    // Plik: chart.js (na samym dole)
    
    // NOWA, POPRAWNA WERSJA:
    chartContainer.addEventListener('mousedown', handleMouseDown);
    chartContainer.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
// === KONIEC NOWEGO KODU ===
// === KONIEC SEKCJI RYSOWANIA ===
    

    // === LOGIKA APLIKACJI ===
    async function loadCompanyData() {
            try {
                const response = await fetch('wig_companies.csv');
                const csvText = await response.text();
                const rows = csvText.trim().split(/\r?\n/).slice(1);
                companyList = rows.map(row => {
                    const [nazwa, ticker] = row.split(',');
                    if (nazwa && ticker) {
                        return { nazwa: nazwa.replace(/^"|"$/g, '').trim(), ticker: ticker.replace(/^"|"$/g, '').trim() };
                    }
                    return null;
                }).filter(company => company !== null);
            } catch (error) {
                console.error("Błąd podczas wczytywania pliku wig_companies.csv:", error);
            }
        }
    
        // === NOWA FUNKCJA: Aktualizacja wszystkich wykresów na podstawie danych ===
        function updateAllCharts(stooqData) {
            if (!stooqData || stooqData.length === 0) {
                console.error('❌ Brak danych do aktualizacji wykresów.');
                return;
            }
        
            candlestickData = stooqData.map(d => ({
                time: d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume
            }));
        
            const volumeData = stooqData.map(d => ({
                time: d.time,
                value: d.volume,
                color: d.close > d.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)'
            }));
        
            console.log("📊 updateAllCharts: świec =", candlestickData.length);
            console.log("📊 updateAllCharts: wolumen =", volumeData.length, 
                        "pierwsze punkty =", volumeData.slice(0, 5));
        
            candlestickSeries.setData(candlestickData);
        
            if (volumeSeries) {
                volumeSeries.setData(volumeData);
                console.log("📈 Volume zaktualizowany w updateAllCharts:", volumeData.length);
            }else {
                console.warn("⚠️ volumeSeries jest undefined w momencie updateAllCharts");
            }
        
            updateAllIndicators();
            mainChart.timeScale().fitContent();
        //    masterRedraw(); // Zmieniono z redrawShapes() na masterRedraw()
        }



    
    // Poniżej wklej swoją ostatnią działającą wersję funkcji loadChartData
    // Poniżej znajduje się PRZYKŁAD, upewnij się, że masz tam swoją działającą wersję
     // Poniżej znajduje się PRZYKŁAD, upewnij się, że masz tam swoją działającą wersję
    async function loadChartData(ticker) {
        if (!ticker) return;
        ticker = ticker.toUpperCase();
        console.log(`--- Rozpoczynam ładowanie danych dla: ${ticker} ---`);
    
        const valuationSection = document.getElementById('valuationCalculatorSection');
        const recommendationSection = document.getElementById('recommendationSection');
        
        valuationSection.style.display = 'none';
        recommendationSection.innerHTML = '';
        
        clearDrawings(); // Czyścimy rysunki przy zmianie spółki
    
        try {
            const stooqResponse = await fetch(`${API_URL}/api/data/${ticker}`);
            
            if (!stooqResponse.ok) {
                throw new Error(`Błąd pobierania danych Stooq dla ${ticker}: ${stooqResponse.statusText}`);
            }
    
            const stooqData = await stooqResponse.json();
            if (stooqData.length === 0) {
                alert(`Brak danych historycznych dla spółki ${ticker}.`);
                return;
            }
    
            // !!! Kluczowa zmiana: Zamiast rysować bezpośrednio, wywołujemy nową funkcję
            updateAllCharts(stooqData);

            document.getElementById('chart-title').textContent = `Wykres Świecowy - ${ticker}`;
    
            if (indexTickers.includes(ticker)) {
                console.log(`Wykryto indeks giełdowy (${ticker}). Kalkulator i rekomendacje nie będą wyświetlane.`);
                valuationSection.style.display = 'none';
                recommendationSection.innerHTML = '';
                return; 
            }
    
            const indicatorsResponse = await fetch(`${API_URL}/api/indicators/${ticker}`);
            const lastPrice = stooqData[stooqData.length - 1].close;
    
            if (indicatorsResponse.ok) {
                try {
                    const indicatorsData = await indicatorsResponse.json();
                    updateValuationData(ticker, lastPrice, indicatorsData);
                } catch (jsonError) {
                    console.error(`Błąd parsowania JSON dla ${ticker}, mimo odpowiedzi OK.`, jsonError);
                    updateValuationData(ticker, lastPrice, {});
                }
            } else {
                console.warn(`Serwer wskaźników zwrócił błąd: ${indicatorsResponse.status}`);
                updateValuationData(ticker, lastPrice, {});
            }
    
        } catch (error) {
            console.error(`!!! Krytyczny błąd w loadChartData dla ${ticker}:`, error);
            valuationSection.style.display = 'none';
            recommendationSection.innerHTML = '';
            alert(`Wystąpił krytyczny błąd podczas ładowania danych dla ${ticker}. Sprawdź konsolę (F12).`);
        }
    }


    // Wklej tutaj swoją ostatnią działającą funkcję updateValuationData
    async function updateValuationData(ticker, lastPrice, indicators) {
        const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');
        const valuationTableBody = valuationCalculatorSection.querySelector('#valuationTableBody');
        
        const parseValue = (value) => {
            if (value === null || value === undefined || String(value).trim().toLowerCase() === 'n/a') {
                return null;
            }
            const num = parseFloat(String(value).replace(',', '.'));
            return isNaN(num) ? null : num;
        };
    
        const aktualnyEps = parseValue(indicators['Aktualny EPS']);
        const poprzedniEps = parseValue(indicators['EPS za poprzedni rok']);
        const EPSnastepnyrok = parseValue(indicators['Prognoza EPS na kolejny rok']);
        const sredniCZ = parseValue(indicators['Średni wskaźnik C/Z']);
        const tempoWzrostu = parseValue(indicators['Średnia stopa wzrostu EPS r/r']);
        const prognozaCena = parseValue(indicators['Prognoza ceny akcji na następny rok']);
        
        const canAnalyze = prognozaCena !== null;
    
        let rec = {
            title: 'Rekomendacja: Analiza niemożliwa (Scenariusz Czerwony)',
            message: `Kalkulacja jest niemożliwa, ponieważ spółka odnotowuje straty (ujemny EPS) lub historycznie była wyceniana ujemnie. Wycena oparta na wskaźniku C/Z jest w tym przypadku bezcelowa. Proszę przeanalizować spółkę za pomocą innych wskaźników, takich jak P/BV (Cena do Wartości Księgowej) lub P/S (Cena do Sprzedaży).`,
            color: '#cf0b04'
        };
    
        if (canAnalyze) {
            valuationCalculatorSection.style.display = '';
    
            const currentCZ = (aktualnyEps && lastPrice) ? (lastPrice / aktualnyEps).toFixed(2) : 'Brak danych';
            const returnRate = (prognozaCena && lastPrice) ? (((prognozaCena / lastPrice) - 1) * 100).toFixed(2) : 'Brak danych';
            
            const valuationData = {
                'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
                'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
                'Aktualny EPS (zysk na akcję)': aktualnyEps !== null ? `${aktualnyEps.toFixed(2)} zł` : 'Brak danych',
                'EPS za poprzedni rok': poprzedniEps !== null ? `${poprzedniEps.toFixed(2)} zł` : 'Brak danych',
                'EPS na następny rok': EPSnastepnyrok !== null ? `${EPSnastepnyrok.toFixed(2)} zł` : 'Brak danych',
                'Aktualny C/Z': currentCZ,
                'Średni C/Z': sredniCZ !== null ? sredniCZ.toFixed(2) : 'Brak danych',
                'Tempo wzrostu': tempoWzrostu !== null ? `${tempoWzrostu.toFixed(2)} %` : 'Brak danych',
                'Stopa zwrotu na marzec/kwiecień 2026 rok': returnRate !== 'Brak danych' ? `${returnRate} %` : 'Brak danych',
                'Wycena Akcji na marzec/kwiecień 2026 rok': prognozaCena !== null ? `${prognozaCena.toFixed(2)} zł` : 'Brak danych'
            };
    
            let valuationHtml = '';
            for (const key in valuationData) {
                valuationHtml += `<tr><th>${key}</th><td>${valuationData[key]}</td></tr>`;
            }
            valuationTableBody.innerHTML = valuationHtml;
            
            const projTableBody = valuationCalculatorSection.querySelector('#projectionTableBody');
            const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
            const pEpsData = ['<strong>Zysk na akcję</strong>'];
            const pPriceData = ['<strong>Cena Akcji</strong>'];
            const priceChartData = [];
            const currentYear = new Date().getFullYear();
            
            if (aktualnyEps !== null && tempoWzrostu !== null && sredniCZ !== null) {
                const tempoWzrostuDecimal = tempoWzrostu / 100;
                for (let i = 1; i <= 5; i++) {
                    const year = currentYear + i;
                    const prognozaEps = poprzedniEps * Math.pow((1 + tempoWzrostuDecimal), i);
                    pEpsData.push(`${prognozaEps.toFixed(2)} zł`);
                    const prognozaPrice = prognozaEps * sredniCZ;
                    pPriceData.push(`${prognozaPrice.toFixed(2)} zł`);
                    priceChartData.push({ time: `${year}-03-15`, value: prognozaPrice });
                }
            } else {
                for (let i = 1; i <= 5; i++) {
                    pEpsData.push('Brak danych');
                    pPriceData.push('Brak danych');
                }
            }
            
            let projHtml = `<tr><th>${pHeaderData[0]}</th>` + pHeaderData.slice(1).map(year => `<th>${year}</th>`).join('') + `</tr>`;
            projHtml += `<tr><td>${pEpsData[0]}</td>` + pEpsData.slice(1).map(eps => `<td>${eps}</td>`).join('') + `</tr>`;
            projHtml += `<tr><td>${pPriceData[0]}</td>` + pPriceData.slice(1).map(price => `<td>${price}</td>`).join('') + `</tr>`;
            projTableBody.innerHTML = projHtml;
            
            priceSeries.setData(priceChartData);
            projectionChart.timeScale().fitContent();
    
            const now = new Date();
            const targetDate = new Date(now.getFullYear() + 1, 3, 30);
            const msInMonth = 1000 * 60 * 60 * 24 * 30.4375;
            const liczbaMiesiecy = (targetDate - now) / msInMonth;
            const procentWzrostu = ((prognozaCena - lastPrice) / lastPrice) * 100;
            const wymaganeRoczneTempoWzrostu = procentWzrostu / (liczbaMiesiecy / 12);
    
            const isTrendWzrostowy = EPSnastepnyrok > poprzedniEps;
            const isNiedowartosciowane = parseFloat(currentCZ) < sredniCZ;
            const isAtrakcyjnaCena = lastPrice < prognozaCena;
    
            if (isTrendWzrostowy && isNiedowartosciowane && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu <= 100) {
                rec.title = 'Bardzo Zielony Scenariusz: Potencjalna Okazja Inwestycyjna';
                rec.color = '#034d06';
                rec.message = `Spółka wykazuje silne fundamenty i może być niedowartościowana. Jej zyski rosną zgodnie z historycznym trendem, a rynkowa wycena jest niższa niż jej długoterminowa średnia. Kalkulacja wskazuje, że aktualny kurs jest poniżej prognozowanej wartości, a wymagane roczne tempo wzrostu jest w realistycznym zakresie, co sugeruje duży potencjał wzrostu.`;
            } else if ((isTrendWzrostowy || isNiedowartosciowane) && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu <= 200) {
                rec.color = '#0bde12';
                rec.title = 'Rekomendacja: Warta uwagi (Scenariusz Zielony)';
                if (isTrendWzrostowy && isNiedowartosciowane) {
                    rec.message = `Spółka wykazuje cechy solidnej, wartościowej inwestycji. Jej zyski rosną zgodnie z historycznym trendem, a wycena jest atrakcyjna. Wycena wskazuje na atrakcyjny potencjał, choć wymaga on nieco szybszego wzrostu niż w najlepszym scenariuszu. To połączenie czynników czyni ją bardzo interesującą.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                } else if (isTrendWzrostowy) {
                    rec.message = `Spółka wykazuje solidny trend wzrostu zysków. Chociaż rynek nie wycenia jej poniżej historycznej średniej (C/Z), to prognozowany wzrost zysków sugeruje, że jej wartość może rosnąć w przyszłości. Potencjał wyceny jest w realistycznym zakresie.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                } else {
                    rec.message = `Spółka wydaje się być niedowartościowana, ponieważ rynek wycenia ją poniżej jej historycznej normy (C/Z). Chociaż jej zyski nie wykazują silnego trendu wzrostowego, to obecna niska wycena może stanowić okazję. Potencjał wyceny jest w realistycznym zakresie.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                }
            } else if ((isTrendWzrostowy || isNiedowartosciowane) && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu > 200 && wymaganeRoczneTempoWzrostu <= 400) {
                rec.color = '#faee05';
                rec.title = 'Rekomendacja: Podwyższone ryzyko (Scenariusz Żółty)';
                 if (isTrendWzrostowy && isNiedowartosciowane) {
                    rec.message = `Spółka wykazuje dobre cechy, które mogą sugerować potencjał wzrostu, jednak jej wycena wskazuje na wysokie ryzyko. Aby zrealizować wyliczoną wartość, cena akcji musiałaby rosnąć w bardzo szybkim tempie, które jest trudne do osiągnięcia. Taka sytuacja czyni inwestycję wysoce ryzykowną i wymaga pogłębionej analizy...<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                } else if (isTrendWzrostowy) {
                    rec.message = `Spółka wykazuje silny trend wzrostu zysków, ale jej wycena jest bardzo ryzykowna i wymaga ostrożności. Potencjał wyceny jest ekstremalnie wysoki i może być trudny do osiągnięcia, co czyni ją spekulacyjną inwestycją.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                } else {
                    rec.message = `Spółka jest wyceniana poniżej jej historycznej średniej (C/Z), co może sugerować niedowartościowanie. Jednak potencjał wyceny jest ekstremalnie wysoki, a jego osiągnięcie jest bardzo mało prawdopodobne, co czyni inwestycję bardzo ryzykowną i spekulacyjną.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
                }
            } else if ((isTrendWzrostowy || isNiedowartosciowane) && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu > 400) {
                rec.color = '#fa6f05';
                rec.title = 'Rekomendacja: Wysokie ryzyko (Scenariusz Pomarańczowy)';
                rec.message = `Wycena spółki wskazuje na ekstremalnie wysokie ryzyko, a wyliczony potencjał wzrostu jest bardzo mało prawdopodobny do osiągnięcia... Zakładanie, że akcja osiągnie tę wartość, jest spekulacją, a nie inwestowaniem.<br><br><strong>Rekomendowana Cena Sprzedaży Akcji: ${prognozaCena.toFixed(2)} zł</strong>`;
            } else {
                 if (!isAtrakcyjnaCena) {
                    rec.title = 'Rekomendacja: Spółka przewartościowana (Scenariusz Czerwony)';
                    rec.message = 'Aktualna cena akcji jest wyższa niż jej prognozowana wartość, co sugeruje, że spółka może być przewartościowana... Rekomendacja ma charakter negatywny, ponieważ sugeruje, że akcje są w tej chwili drogie.';
                } else if (!isTrendWzrostowy && !isNiedowartosciowane) {
                    rec.title = 'Rekomendacja: Brak fundamentalnych przesłanek (Scenariusz Czerwony)';
                    rec.message = 'Spółka nie wykazuje kluczowych cech, które mogłyby uzasadnić potencjał wzrostu... Analiza wskazuje, że nie ma wystarczających przesłanek fundamentalnych do rekomendowania zakupu.';
                } else {
                    rec.title = 'Rekomendacja: Niejednoznaczny sygnał (Scenariusz Czerwony)';
                    rec.message = 'Analiza fundamentalna spółki nie daje jednoznacznych sygnałów do podjęcia decyzji inwestycyjnej. Zalecana jest dalsza, pogłębiona analiza lub obserwacja.';
                }
            }
        } else {
            valuationCalculatorSection.style.display = 'none';
        }
    
        const recommendationContainer = document.getElementById('recommendationSection');
        const isYellow = rec.color === '#faee05';
        const textColor = isYellow ? 'text-dark' : 'text-white';
    
        const recommendationHtml = `
            <div class="card shadow mb-4">
                <div class="card-header py-3" style="background-color: ${rec.color};">
                    <h6 class="m-0 font-weight-bold ${textColor}">${rec.title}</h6>
                </div>
                <div class="card-body">
                    <p>${rec.message}</p>
                    <hr>
                    <small class="text-muted" style="font-size: 0.7rem;">
                        <strong>Ostrzeżenie: Zastrzeżenie prawne.</strong><br>
                        Ten kalkulator oraz wygenerowane przez niego rekomendacje mają charakter wyłącznie poglądowy i edukacyjny. Nie stanowią one profesjonalnej porady inwestycyjnej ani oficjalnej rekomendacji w rozumieniu przepisów prawa. Wycena opiera się na uproszczonym modelu matematycznym, który nie uwzględnia wszystkich czynników rynkowych, makroekonomicznych, ani specyficznej sytuacji finansowej spółki. Każdy inwestor powinien przeprowadzić własną, dogłębną analizę i podejmować decyzje inwestycyjne na własne ryzyko. Odpowiedzialność za podjęte decyzje spoczywa wyłącznie na inwestorze.
                    </small>
                </div>
            </div>`;
        
        recommendationContainer.innerHTML = recommendationHtml;
    }

    // === FUNKCJE OBLICZAJĄCE WSKAŹNIKI ===
    const calculateSMA = (data, period) => {
        let result = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            result.push({ time: data[i].time, value: sum / period });
        }
        return result;
    };

    function calculateEMA(data, period) {
        if (!data || data.length < period) {
            console.warn(`⚠️ calculateEMA: za mało danych (potrzeba ${period}, mamy ${data ? data.length : 0})`);
            return [];
        }
    
        const k = 2 / (period + 1);
        const emaArray = [];
    
        // 🔑 Pierwsza wartość EMA to średnia z pierwszych 'period' cen
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i].close !== undefined ? data[i].close : data[i].value;
        }
        let prevEma = sum / period;
        emaArray.push({ time: data[period - 1].time, value: prevEma });
    
        // 🔑 Potem dopiero iterujemy
        for (let i = period; i < data.length; i++) {
            const price = data[i].close !== undefined ? data[i].close : data[i].value;
            prevEma = price * k + prevEma * (1 - k);
            emaArray.push({ time: data[i].time, value: prevEma });
        }
    
        return emaArray;
    }

    
    const calculateWMA = (data, period) => {
        let result = [];
        const weightSum = period * (period + 1) / 2;
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close * (period - j);
            }
            result.push({ time: data[i].time, value: sum / weightSum });
        }
        return result;
    };

    function calculateRSI(data, period = 14) {
        let gains = 0, losses = 0;
        const result = [];
    
        for (let i = 1; i < data.length; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (i <= period) {
                diff > 0 ? gains += diff : losses += Math.abs(diff);
            } else {
                gains = (gains * (period - 1) + (diff > 0 ? diff : 0)) / period;
                losses = (losses * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
            }
    
            if (i >= period) {
                const rs = losses === 0 ? 100 : gains / losses;
                const rsi = 100 - (100 / (1 + rs));
                result.push({ time: data[i].time, value: rsi }); // 👈 zawsze {time, value}
            }
        }
    
        return result;
    }

    
   function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (!data || data.length < slowPeriod) {
            console.warn("⚠️ calculateMACD: za mało danych");
            return { macd: [], signal: [], histogram: [] };
        }
    
        const emaFast = calculateEMA(data, fastPeriod);
        const emaSlow = calculateEMA(data, slowPeriod);
    
        const macdLine = [];
    
        const slowMap = new Map(emaSlow.map(s => [s.time, s.value]));
    
        emaFast.forEach(fastPoint => {
            const slowValue = slowMap.get(fastPoint.time);
            if (slowValue !== undefined) {
                macdLine.push({
                    time: fastPoint.time,
                    value: fastPoint.value - slowValue
                });
            }
        });
    
        if (macdLine.length === 0) {
            return { macd: [], signal: [], histogram: [] };
        }
    
        const signalLine = calculateEMA(macdLine, signalPeriod);
    
                // Tworzymy mapę Signal po dacie
        const signalMap = new Map(signalLine.map(s => [s.time, s.value]));
        
        // Histogram = różnica MACD - Signal dla wspólnej daty
        const histogram = macdLine.map(point => {
            const sigValue = signalMap.get(point.time);
            if (sigValue !== undefined) {
                return { time: point.time, value: point.value - sigValue };
            }
            return null;
        }).filter(Boolean);

    
        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }




    function calculateOBV(data) {
        let obv = 0;
        const result = [];
    
        for (let i = 1; i < data.length; i++) {
            if (data[i].close > data[i - 1].close) {
                obv += data[i].volume;
            } else if (data[i].close < data[i - 1].close) {
                obv -= data[i].volume;
            }
            result.push({ time: data[i].time, value: obv }); // 👈 zawsze {time, value}
        }
    
        return result;
    }



    // === ZARZĄDZANIE WSKAŹNIKAMI ===
    function addIndicator(id, type, settings, data) {
        if (activeIndicators[id]) {
            console.warn(`⚠️ Wskaźnik ${id} już istnieje, pomijam dodanie.`);
            return;
        }
    
        console.log(`➕ Dodaję wskaźnik ${type} (${id}), liczba punktów:`, data ? data.length : "brak");
    
        let series;
    
        switch (type) {
            case 'SMA':
            case 'EMA':
            case 'WMA':
                series = mainChart.addSeries(LightweightCharts.LineSeries, {
                    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                    lineWidth: 2,
                    title: id
                });
                series.setData(data);
                break;
    
            case 'Volume': {
                const container = document.getElementById('volume-chart-container');
                container.style.display = 'block';
            
                if (!volumeChart) {
                    volumeChart = LightweightCharts.createChart(container, {
                        width: container.clientWidth,
                        height: 100,
                        layout: { backgroundColor: '#ffffff', textColor: '#333' },
                        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
                        timeScale: { timeVisible: true, secondsVisible: false }
                    });
            
                    volumeSeries = volumeChart.addSeries(LightweightCharts.HistogramSeries, {
                        priceFormat: { type: 'volume' }
                    });
                }
            
                if (candlestickData.length > 0) {
                    const vol = candlestickData.map(d => ({
                        time: d.time,
                        value: d.volume,
                        color: d.close > d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)'
                    }));
                    volumeSeries.setData(vol);
                }
            
                setTimeout(() => {
                    volumeChart.resize(container.clientWidth, 100);
                    volumeChart.timeScale().fitContent();
                }, 0);
            
                series = volumeSeries;
                break;
            }
   
            case 'RSI': {
                const container = document.getElementById('rsi-chart-container');
                container.style.display = 'block';
    
                if (!rsiChart) {
                    rsiChart = LightweightCharts.createChart(container, {
                        width: container.clientWidth,
                        height: 120,
                        layout: { backgroundColor: '#fff', textColor: '#333' },
                        grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
                        timeScale: { timeVisible: true, secondsVisible: false }
                    });
                }
    
                series = rsiChart.addSeries(LightweightCharts.LineSeries, { color: 'purple', lineWidth: 2 });
                series.setData(data);
                rsiChart.timeScale().fitContent();
                break;
            }
    
            case 'MACD': {
                const container = document.getElementById('macd-chart-container');
                container.style.display = 'block';
    
                if (!macdChart) {
                    macdChart = LightweightCharts.createChart(container, {
                        width: container.clientWidth,
                        height: 120,
                        layout: { backgroundColor: '#fff', textColor: '#333' },
                        grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
                        timeScale: { timeVisible: true, secondsVisible: false }
                    });
                }
    
                const macdSeries = macdChart.addSeries(LightweightCharts.LineSeries, { color: 'blue', lineWidth: 2 });
                const signalSeries = macdChart.addSeries(LightweightCharts.LineSeries, { color: 'orange', lineWidth: 2 });
                const histSeries = macdChart.addSeries(LightweightCharts.HistogramSeries, { color: 'gray' });
    
                macdSeries.setData(data.macd);
                signalSeries.setData(data.signal);
                histSeries.setData(data.histogram);
    
                series = { macd: macdSeries, signal: signalSeries, histogram: histSeries };
                macdChart.timeScale().fitContent();
                break;
            }
    
            case 'OBV': {
                const container = document.getElementById('obv-chart-container');
                container.style.display = 'block';
    
                if (!obvChart) {
                    obvChart = LightweightCharts.createChart(container, {
                        width: container.clientWidth,
                        height: 120,
                        layout: { backgroundColor: '#fff', textColor: '#333' },
                        grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
                        timeScale: { timeVisible: true, secondsVisible: false }
                    });
                }
    
                series = obvChart.addSeries(LightweightCharts.LineSeries, { color: 'green', lineWidth: 2 });
                series.setData(data);
                obvChart.timeScale().fitContent();
                break;
            }
        }
    
        activeIndicators[id] = { type, series, settings };
        updateActiveIndicatorsList();
    }



    function removeIndicator(id) {
        const indicator = activeIndicators[id];
        if (!indicator) return;
    
        if (indicator.type === 'MACD') {
            if (macdChart) {
                macdChart.removeSeries(indicator.series.macd);
                macdChart.removeSeries(indicator.series.signal);
                macdChart.removeSeries(indicator.series.histogram);
            }
            document.getElementById('macd-chart-container').style.display = 'none';
        } else if (indicator.type === 'Volume') {
            // 🔑 NIE usuwamy serii volumeSeries, tylko chowamy kontener
            document.getElementById('volume-chart-container').style.display = 'none';
        } else {
            const chartMap = {
                'SMA': mainChart,
                'EMA': mainChart,
                'WMA': mainChart,
                'RSI': rsiChart,
                'OBV': obvChart
            };
    
            const chart = chartMap[indicator.type];
            if (chart && indicator.series) {
                chart.removeSeries(indicator.series);
            }
    
            if (['RSI', 'OBV'].includes(indicator.type)) {
                document.getElementById(`${indicator.type.toLowerCase()}-chart-container`).style.display = 'none';
            }
        }
    
        delete activeIndicators[id];
        updateActiveIndicatorsList();
    }



    
    function updateAllIndicators() {
        if (candlestickData.length === 0) {
            console.warn("⚠️ updateAllIndicators: brak danych w candlestickData");
            return;
        }
    
        console.log("🔄 Aktualizacja wskaźników, liczba świec:", candlestickData.length);
    
        Object.keys(activeIndicators).forEach(id => {
            const indicator = activeIndicators[id];
            let data;
    
            switch (indicator.type) {
                case 'SMA':
                    data = calculateSMA(candlestickData, indicator.settings.period);
                    console.log(`SMA (${indicator.settings.period}) punkty:`, data.length);
                    indicator.series.setData(data);
                    break;
    
                case 'EMA':
                    data = calculateEMA(candlestickData, indicator.settings.period);
                    console.log(`EMA (${indicator.settings.period}) punkty:`, data.length);
                    indicator.series.setData(data);
                    break;
    
                case 'WMA':
                    data = calculateWMA(candlestickData, indicator.settings.period);
                    console.log(`WMA (${indicator.settings.period}) punkty:`, data.length);
                    indicator.series.setData(data);
                    break;
    
                case 'Volume':
                    const vol = candlestickData.map(d => ({
                        time: d.time,
                        value: d.volume,
                        color: d.close > d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)'
                    }));
                    console.log("Volume punkty:", vol.length);
                    volumeSeries.setData(vol);
                    break;
    
                case 'RSI':
                    data = calculateRSI(candlestickData);
                    console.log("RSI punkty:", data.length);
                    indicator.series.setData(data);
                    break;
    
                case 'MACD':
                    data = calculateMACD(candlestickData);
                    console.log(`MACD aktualizacja: macd=${data.macd.length}, signal=${data.signal.length}, hist=${data.histogram.length}`);
                    indicator.series.macd.setData(data.macd);
                    indicator.series.signal.setData(data.signal);
                    indicator.series.histogram.setData(data.histogram);
                    break;
    
                case 'OBV':
                    data = calculateOBV(candlestickData);
                    console.log("OBV punkty:", data.length);
                    indicator.series.setData(data);
                    break;
            }
        });
    }


    function updateActiveIndicatorsList() {
        const list = document.getElementById('activeIndicatorsList');
        list.innerHTML = '';
        Object.keys(activeIndicators).forEach(id => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.textContent = id.toUpperCase();
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-danger btn-sm';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                if (['Volume', 'RSI', 'MACD', 'OBV'].includes(activeIndicators[id].type)) {
                    document.getElementById(`${id.toLowerCase()}Toggle`).checked = false;
                }
                removeIndicator(id);
            };
            item.appendChild(removeBtn);
            list.appendChild(item);
        });
    }


    // === EVENT LISTENERS MODAL ===
    document.getElementById('addMaButton').addEventListener('click', () => {
        const type = document.getElementById('maType').value;
        const period = parseInt(document.getElementById('maPeriod').value, 10);
        if (isNaN(period) || period < 1) {
            alert("Proszę podać prawidłowy okres.");
            return;
        }
        const id = `${type}-${period}`;
        let data;
        if(type === 'SMA') data = calculateSMA(candlestickData, period);
        if(type === 'EMA') data = calculateEMA(candlestickData, period);
        if(type === 'WMA') data = calculateWMA(candlestickData, period);

        addIndicator(id, type, { period }, data);
    });

    ['volume', 'rsi', 'macd', 'obv'].forEach(name => {
        const toggleEl = document.getElementById(`${name}Toggle`);
        if (!toggleEl) return;
    
        toggleEl.addEventListener('change', (e) => {
            const id = name;
            const type = (name === 'volume') ? 'Volume' : name.toUpperCase();
    
            if (e.target.checked) {
                let data;
                if (type === 'Volume') data = candlestickData;
                if (type === 'RSI') data = calculateRSI(candlestickData);
                if (type === 'MACD') data = calculateMACD(candlestickData);
                if (type === 'OBV') data = calculateOBV(candlestickData);
    
                addIndicator(id, type, {}, data);
            } else {
                removeIndicator(id);
            }
        });
    });


    async function fetchStockData(ticker) {
        // === POCZĄTEK BLOKU DIAGNOSTYCZNEGO ===
        // Wklej ten fragment na samym początku funkcji
        console.log("--- Diagnostyka Tickera ---");
        console.log("Otrzymany ticker:", ticker);
        console.log("Długość tickera:", ticker.length);
    
        // Sprawdzamy kody poszczególnych znaków
        let codes = [];
        for (let i = 0; i < ticker.length; i++) {
            codes.push(ticker.charCodeAt(i));
        }
        console.log("Kody znaków (ASCII):", codes.join(', '));
        console.log("--------------------------");
        // === KONIEC BLOKU DIAGNOSTYCZNEGO ===
    
        if (!ticker) return [];
    
        try {
            const response = await fetch(`${API_URL}/api/data/${ticker}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Błąd HTTP ${response.status}: ${errorData.error || 'Nieznany błąd serwera'}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Błąd podczas pobierania danych giełdowych:", error);
            alert(`Wystąpił błąd: ${error.message}. Sprawdź symbol spółki lub spróbuj ponownie.`);
            return [];
        }
    }
    
     // === POCZĄTEK ZMIANY: ULEPSZONA FUNKCJA FILTRUJĄCA ===
    function findMatchingCompanies(query) {
        if (!query || query.length < 1) return []; // Zmieniono na 1, aby wyszukiwać od pierwszej litery
        const lowerCaseQuery = query.toLowerCase();
        
        // Nowa, bardziej precyzyjna logika filtrowania
        return companyList.filter(company => {
            const lowerCaseNazwa = company.nazwa.toLowerCase();
            const lowerCaseTicker = company.ticker.toLowerCase();
            
            // Zwróć prawdę, jeśli NAZWA lub TICKER ZACZYNA SIĘ OD wpisanego tekstu
            return lowerCaseNazwa.startsWith(lowerCaseQuery) || lowerCaseTicker.startsWith(lowerCaseQuery);
        });
    }
    // === KONIEC ZMIANY ===

    function renderAutocomplete(suggestions) {
        searchDropdown.innerHTML = '';
        if (suggestions && suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const item = document.createElement('a');
                item.classList.add('list-group-item', 'list-group-item-action');
                item.href = "#";
                // === POCZĄTEK POPRAWKI ===
                // Składamy tekst z właściwości obiektu, zamiast wstawiać cały obiekt
                item.textContent = `${suggestion.nazwa}-${suggestion.ticker}`;
                // === KONIEC POPRAWKI ===
                
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    stockTickerInput.value = item.textContent;
                    searchDropdown.style.display = 'none';
                    loadChartData(suggestion.ticker);
                });
                searchDropdown.appendChild(item);
            });
            searchDropdown.style.display = 'block';
        } else {
            searchDropdown.style.display = 'none';
        }
    }

    // Pozostałe event listenery...
    stockTickerInput.addEventListener('input', () => {
        const query = stockTickerInput.value.trim();
        const suggestions = findMatchingCompanies(query);
        renderAutocomplete(suggestions);
    });

    document.addEventListener('click', function(event) {
        const isClickInside = stockTickerInput.contains(event.target) || searchDropdown.contains(event.target);
        if (!isClickInside) {
            searchDropdown.style.display = 'none';
        }
    });

    searchButton.addEventListener('click', () => {
        const inputValue = stockTickerInput.value.trim();
        let tickerToLoad = inputValue.toUpperCase();
        if (inputValue.includes('-')) {
            const parts = inputValue.split('-');
            tickerToLoad = parts[parts.length - 1].toUpperCase();
        }
        if (tickerToLoad) {
            loadChartData(tickerToLoad);
            searchDropdown.style.display = 'none';
        }
    });

    stockTickerInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); searchButton.click(); } });

    window.addEventListener('resize', () => {
        mainChart.applyOptions({ width: chartContainer.clientWidth });
        projectionChart.applyOptions({ width: projectionChartContainer.clientWidth });
    });
    // === POCZÁTEK NOWEGO KODU ===
    drawingTooltip = document.getElementById('drawingTooltip');
    // === KONIEC NOWEGO KODU ===
    // === Inicjalizacja ===
    loadCompanyData().then(() => {
        loadChartData('WIG');
    });
});
