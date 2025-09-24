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

    // === SEKCJA RYSOWANIA - ZMODYFIKOWANA ===
    
    let drawingMode = null; // 'trendline', 'hline', 'vline', 'channel'
    let drawingPoints = [];
    let drawnShapes = [];
    let currentMousePoint = null; // Do dynamicznego rysowania

    let lineColor = document.getElementById('lineColor').value;
    let lineWidth = parseInt(document.getElementById('lineWidth').value, 10);
    
    const drawingCanvas = document.getElementById("drawingCanvas");
    const ctx = drawingCanvas.getContext("2d");

    document.getElementById('lineColor').addEventListener('input', (e) => { lineColor = e.target.value; });
    document.getElementById('lineWidth').addEventListener('input', (e) => { lineWidth = parseInt(e.target.value, 10); });
    document.getElementById('clearDrawingButton').addEventListener('click', clearDrawings);

    function clearDrawings() {
        drawnShapes = [];
        drawingPoints = [];
        drawingMode = null;
        masterRedraw(); 
    }

    /**
     * Główna funkcja rysująca. Czyści płótno, rysuje zapisane kształty,
     * a następnie rysuje aktualnie tworzony, dynamiczny kształt.
     */
    function masterRedraw() {
        const ratio = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, drawingCanvas.width / ratio, drawingCanvas.height / ratio);
        
        redrawShapes();      // Rysuj zapisane, statyczne kształty
        drawCurrentShape();  // Rysuj dynamiczny kształt podążający za myszką
    }

    function redrawShapes() {
        drawnShapes.forEach(shape => {
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = shape.width;
            ctx.beginPath();
    
            if (shape.type === 'trendline' || shape.type === 'channel_base') {
                const p1_coord = { x: mainChart.timeScale().timeToCoordinate(shape.p1.time), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                const p2_coord = { x: mainChart.timeScale().timeToCoordinate(shape.p2.time), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
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
                const x_coord = mainChart.timeScale().timeToCoordinate(shape.time);
                if (x_coord !== null) {
                    const ratio = window.devicePixelRatio || 1;
                    ctx.moveTo(x_coord, 0);
                    ctx.lineTo(x_coord, drawingCanvas.height / ratio);
                }
            } else if (shape.type === 'channel') {
                // Rysowanie głównej linii kanału
                const p1_coord = { x: mainChart.timeScale().timeToCoordinate(shape.p1.time), y: candlestickSeries.priceToCoordinate(shape.p1.price) };
                const p2_coord = { x: mainChart.timeScale().timeToCoordinate(shape.p2.time), y: candlestickSeries.priceToCoordinate(shape.p2.price) };
                
                if (p1_coord.x !== null && p2_coord.x !== null) {
                    ctx.moveTo(p1_coord.x, p1_coord.y);
                    ctx.lineTo(p2_coord.x, p2_coord.y);
                    
                    // Obliczanie przesunięcia dla linii równoległej
                    const p3_y_coord = candlestickSeries.priceToCoordinate(shape.p3.price);
                    const p1_y_coord_at_p3_time = candlestickSeries.priceToCoordinate(shape.p1_price_at_p3_time);
                    const dy = p3_y_coord - p1_y_coord_at_p3_time;

                    ctx.moveTo(p1_coord.x, p1_coord.y + dy);
                    ctx.lineTo(p2_coord.x, p2_coord.y + dy);
                }
            }
            ctx.stroke();
        });
    }

    /**
     * Funkcja rysująca kształt "podążający" za kursorem, zanim zostanie on ostatecznie narysowany.
     */
    function drawCurrentShape() {
        if (drawingPoints.length === 0 || !currentMousePoint) return;

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        const p1 = drawingPoints[0];
        const p1_coord = { x: mainChart.timeScale().timeToCoordinate(p1.time), y: candlestickSeries.priceToCoordinate(p1.price) };

        if (drawingMode === 'trendline' && drawingPoints.length === 1) {
            ctx.moveTo(p1_coord.x, p1_coord.y);
            ctx.lineTo(currentMousePoint.x, currentMousePoint.y);
        } else if (drawingMode === 'channel') {
            if (drawingPoints.length === 1) {
                // Rysuj pierwszą linię dynamicznie
                ctx.moveTo(p1_coord.x, p1_coord.y);
                ctx.lineTo(currentMousePoint.x, currentMousePoint.y);
            } else if (drawingPoints.length === 2) {
                // Rysuj drugą linię (równoległą) dynamicznie
                const p2 = drawingPoints[1];
                const p2_coord = { x: mainChart.timeScale().timeToCoordinate(p2.time), y: candlestickSeries.priceToCoordinate(p2.price) };

                // Linia główna (już statyczna)
                ctx.moveTo(p1_coord.x, p1_coord.y);
                ctx.lineTo(p2_coord.x, p2_coord.y);

                // Linia równoległa (dynamiczna)
                const dy = currentMousePoint.y - p1_coord.y;
                ctx.moveTo(p1_coord.x, p1_coord.y + dy);
                ctx.lineTo(p2_coord.x, p2_coord.y + dy);
            }
        }
        ctx.stroke();
    }
    
    function resizeDrawingCanvas() {
        const rect = chartContainer.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        
        drawingCanvas.style.width = rect.width + "px";
        drawingCanvas.style.height = rect.height + "px";
        drawingCanvas.width = Math.floor(rect.width * ratio);
        drawingCanvas.height = Math.floor(rect.height * ratio);
        ctx.scale(ratio, ratio);
        
        masterRedraw();
    }
    
    window.setDrawingMode = function(mode) {
        drawingMode = mode;
        drawingPoints = [];
        chartContainer.style.cursor = 'crosshair';
        console.log("Tryb rysowania:", mode);
    };

    // --- GŁÓWNE LISTENERY DO OBSŁUGI RYSOWANIA ---

    // 1. Listener do ruchu myszy (dla dynamicznego rysowania)
    mainChart.subscribeCrosshairMove((param) => {
        if (!drawingMode || drawingPoints.length === 0 || !param.point || !param.time) {
            currentMousePoint = null;
            return;
        }
        
        // Konwertuj współrzędne myszy na cenę
        const price = candlestickSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        currentMousePoint = {
            x: param.point.x,
            y: param.point.y,
            time: param.time,
            price: price
        };
        masterRedraw();
    });

    // 2. Listener do kliknięć (do ustawiania punktów)
    mainChart.subscribeClick((param) => {
        if (!drawingMode || !param.point || !param.time) return;

        // BARDZO WAŻNA POPRAWKA: Konwertujemy współrzędną Y kliknięcia na precyzyjną cenę.
        const price = candlestickSeries.coordinateToPrice(param.point.y);
        if (price === null) {
            // Czasem kliknięcie jest poza widoczną skalą cenową
            console.warn("Nie można ustalić ceny w punkcie kliknięcia.");
            return;
        }

        const currentPoint = { time: param.time, price: price };
        drawingPoints.push(currentPoint);
        
        if (drawingMode === 'hline') {
            drawnShapes.push({ type: "hline", price: currentPoint.price, color: lineColor, width: lineWidth });
            drawingMode = null;
            drawingPoints = [];
        } else if (drawingMode === 'vline') {
            drawnShapes.push({ type: "vline", time: currentPoint.time, color: lineColor, width: lineWidth });
            drawingMode = null;
            drawingPoints = [];
        } else if (drawingMode === 'trendline' && drawingPoints.length === 2) {
            drawnShapes.push({ type: 'trendline', p1: drawingPoints[0], p2: drawingPoints[1], color: lineColor, width: lineWidth });
            drawingMode = null;
            drawingPoints = [];
        } else if (drawingMode === 'channel' && drawingPoints.length === 3) {
            const [p1, p2, p3] = drawingPoints;
            
            // Do poprawnego obliczenia przesunięcia potrzebujemy znać cenę na głównej linii w momencie czasu p3
            const line = mainChart.getSeriesApi(candlestickSeries).createPriceLine({ price: 0, color: 'transparent' });
            line.applyOptions({ price: p1.price }); // Ustawienie początku
            const priceLineData = [ { time: p1.time, value: p1.price }, { time: p2.time, value: p2.price } ];
            // To jest mały trik - symulujemy linię, żeby znaleźć cenę w dowolnym punkcie czasu
            const interpolatedPrice = interpolatePrice(priceLineData, p3.time);
            mainChart.removePriceLine(line);

            drawnShapes.push({ 
                type: "channel", p1, p2, p3, 
                p1_price_at_p3_time: interpolatedPrice, // Zapisujemy tę wartość
                color: lineColor, width: lineWidth 
            });
            drawingMode = null;
            drawingPoints = [];
        }
        
        masterRedraw();

        if (!drawingMode) {
            chartContainer.style.cursor = 'default';
        }
    });

    // Funkcja pomocnicza do interpolacji ceny na linii
    function interpolatePrice(lineData, targetTime) {
        const p1 = lineData[0];
        const p2 = lineData[1];
        if (p1.time === p2.time) return p1.value;
        const slope = (p2.value - p1.value) / (p2.time - p1.time);
        return p1.value + slope * (targetTime - p1.time);
    }
    
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(() => { masterRedraw(); });

    resizeDrawingCanvas();
    window.addEventListener("resize", () => {
        resizeDrawingCanvas();
        mainChart.applyOptions({ width: chartContainer.clientWidth });
    });

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
            masterRedraw(); // Zmieniono z redrawShapes() na masterRedraw()
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

    // === Inicjalizacja ===
    loadCompanyData().then(() => {
        loadChartData('WIG');
    });
});
