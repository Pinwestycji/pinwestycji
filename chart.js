// Plik: chart.js - Wersja z dodanymi wskaźnikami analizy technicznej i poprawioną składnią
document.addEventListener('DOMContentLoaded', function() {
    let companyList = [];
    const API_URL = 'https://pinwestycji.onrender.com';
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];
    let chartData = []; // Globalna zmienna do przechowywania danych cenowych

    // === POCZĄTEK ZMIANY: Utworzenie nowych serii dla SMA, EMA, WMA ===
    let smaSeries = new Map();
    let emaSeries = new Map();
    let wmaSeries = new Map();
    // === KONIEC ZMIANY ===

    // === POCZĄTEK ZMIANY: Nowe wykresy dla wskaźników ===
    const mainChartContainer = document.getElementById('tvchart');
    const mainChart = LightweightCharts.createChart(mainChartContainer, {
        width: mainChartContainer.clientWidth,
        height: 500,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false }
    });
    
    // Użycie poprawnej składni dla serii świecowej
    const candlestickSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries);
    candlestickSeries.applyOptions({
        upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)',
        borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)',
        wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)'
    });

    const volumeChartContainer = document.getElementById('volume-chart');
    const volumeChart = LightweightCharts.createChart(volumeChartContainer, {
        width: volumeChartContainer.clientWidth,
        height: 200,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false }
    });
    
    // Użycie poprawnej składni dla serii wolumenu
    const volumeSeries = volumeChart.addSeries(LightweightCharts.HistogramSeries);
    volumeSeries.applyOptions({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: { top: 0.8, bottom: 0 }
    });

    const rsiChartContainer = document.getElementById('rsi-chart');
    const rsiChart = LightweightCharts.createChart(rsiChartContainer, {
        width: rsiChartContainer.clientWidth,
        height: 200,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false }
    });
    // Użycie poprawnej składni dla serii RSI
    const rsiSeries = rsiChart.addSeries(LightweightCharts.LineSeries);
    rsiSeries.applyOptions({ color: 'purple', lineWidth: 2 });
    // Dodanie poziomów 30 i 70 dla RSI
    rsiChart.addPriceLine({ price: 30, color: '#FF7F50', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted });
    rsiChart.addPriceLine({ price: 70, color: '#FF7F50', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted });

    const macdChartContainer = document.getElementById('macd-chart');
    const macdChart = LightweightCharts.createChart(macdChartContainer, {
        width: macdChartContainer.clientWidth,
        height: 200,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false }
    });
    // Użycie poprawnej składni dla serii MACD
    const macdSeries = macdChart.addSeries(LightweightCharts.LineSeries);
    macdSeries.applyOptions({ color: 'blue', lineWidth: 2 });
    const signalSeries = macdChart.addSeries(LightweightCharts.LineSeries);
    signalSeries.applyOptions({ color: 'red', lineWidth: 2 });
    const macdHistogramSeries = macdChart.addSeries(LightweightCharts.HistogramSeries);
    macdHistogramSeries.applyOptions({ priceScaleId: '', scaleMargins: { top: 0.1, bottom: 0.1 } });
    macdChart.addPriceLine({ price: 0, color: '#cccccc', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Solid });

    const obvChartContainer = document.getElementById('obv-chart');
    const obvChart = LightweightCharts.createChart(obvChartContainer, {
        width: obvChartContainer.clientWidth,
        height: 200,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false }
    });
    // Użycie poprawnej składni dla serii OBV
    const obvSeries = obvChart.addSeries(LightweightCharts.LineSeries);
    obvSeries.applyOptions({ color: 'green', lineWidth: 2 });
    // === KONIEC ZMIANY ===

    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');
    const valuationTableBody = document.getElementById('valuationTableBody');
    const projectionTableBody = document.getElementById('projectionTableBody');
    const indicatorsModal = new bootstrap.Modal(document.getElementById('indicatorsModal'));
    const indicatorsButton = document.getElementById('indicatorsButton');
    const applyIndicatorsBtn = document.getElementById('applyIndicatorsBtn');

    // === POCZĄTEK NOWYCH FUNKCJI OBLICZENIOWYCH ===
    // Funkcja do obliczania Prostej Średniej Kroczącej (SMA)
    function calculateSMA(data, period) {
        let smaData = [];
        for (let i = period - 1; i < data.length; i++) {
            const periodData = data.slice(i - (period - 1), i + 1);
            const sum = periodData.reduce((acc, current) => acc + current.close, 0);
            const sma = sum / period;
            smaData.push({ time: data[i].time, value: sma });
        }
        return smaData;
    }

    // Funkcja do obliczania Wykładniczej Średniej Kroczącej (EMA)
    function calculateEMA(data, period) {
        let emaData = [];
        let multiplier = 2 / (period + 1);
        let ema = data[0].close;
        emaData.push({ time: data[0].time, value: ema });
        for (let i = 1; i < data.length; i++) {
            ema = ((data[i].close - ema) * multiplier) + ema;
            emaData.push({ time: data[i].time, value: ema });
        }
        return emaData;
    }

    // Funkcja do obliczania Ważonej Średniej Kroczącej (WMA)
    function calculateWMA(data, period) {
        let wmaData = [];
        let sumWeights = (period * (period + 1)) / 2;
        for (let i = period - 1; i < data.length; i++) {
            let weightedSum = 0;
            for (let j = 0; j < period; j++) {
                weightedSum += data[i - j].close * (period - j);
            }
            let wma = weightedSum / sumWeights;
            wmaData.push({ time: data[i].time, value: wma });
        }
        return wmaData;
    }

    // Funkcja do obliczania Wskaźnika Siły Względnej (RSI)
    function calculateRSI(data, period = 14) {
        let rsiData = [];
        let gains = [];
        let losses = [];
        for (let i = 1; i < data.length; i++) {
            let change = data[i].close - data[i - 1].close;
            gains.push(Math.max(0, change));
            losses.push(Math.max(0, -change));
            if (i >= period) {
                let avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
                let avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
                let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                let rsi = 100 - (100 / (1 + rs));
                rsiData.push({ time: data[i].time, value: rsi });
            }
        }
        return rsiData;
    }
    
    // Funkcja do obliczania MACD
    function calculateMACD(data) {
        const fastPeriod = 12;
        const slowPeriod = 26;
        const signalPeriod = 9;

        const fastEMA = calculateEMA(data, fastPeriod);
        const slowEMA = calculateEMA(data, slowPeriod);

        const macdLine = [];
        for (let i = 0; i < fastEMA.length; i++) {
            let slowEMAValue = slowEMA.find(d => d.time === fastEMA[i].time)?.value;
            if (slowEMAValue) {
                macdLine.push({ time: fastEMA[i].time, value: fastEMA[i].value - slowEMAValue });
            }
        }

        const signalLine = calculateEMA(macdLine, signalPeriod);
        const macdHistogram = [];
        for (let i = 0; i < macdLine.length; i++) {
            let signalLineValue = signalLine.find(d => d.time === macdLine[i].time)?.value;
            if (signalLineValue) {
                macdHistogram.push({ time: macdLine[i].time, value: macdLine[i].value - signalLineValue });
            }
        }

        return { macdLine, signalLine, macdHistogram };
    }

    // Funkcja do obliczania On-Balance Volume (OBV)
    function calculateOBV(data) {
        if (data.length === 0) return [];
        let obvData = [{ time: data[0].time, value: 0 }];
        let obv = 0;
        for (let i = 1; i < data.length; i++) {
            if (data[i].close > data[i - 1].close) {
                obv += data[i].volume;
            } else if (data[i].close < data[i - 1].close) {
                obv -= data[i].volume;
            }
            obvData.push({ time: data[i].time, value: obv });
        }
        return obvData;
    }
    // === KONIEC NOWYCH FUNKCJI OBLICZENIOWYCH ===

    async function loadCompanyData() {
        try {
            const response = await fetch('wig_companies.csv');
            const csvText = await response.text();
            
            const rows = csvText.trim().split(/\r?\n/).slice(1);
            companyList = rows.map(row => {
                const [nazwa, ticker] = row.split(',');
                if (nazwa && ticker) {
                    return { 
                        nazwa: nazwa.replace(/^"|"$/g, '').trim(), 
                        ticker: ticker.replace(/^"|"$/g, '').trim() 
                    };
                }
                return null;
            }).filter(company => company !== null);

            console.log(`Załadowano ${companyList.length} spółek.`);
        } catch (error) {
            console.error("Błąd podczas wczytywania pliku wig_companies.csv:", error);
        }
    }

    // === POCZĄTEK ZMIANY: Implementacja funkcji do zarządzania wskaźnikami ===
    function clearAllIndicators() {
        // Usunięcie serii SMA, EMA, WMA
        smaSeries.forEach(series => mainChart.removeSeries(series));
        emaSeries.forEach(series => mainChart.removeSeries(series));
        wmaSeries.forEach(series => mainChart.removeSeries(series));
        smaSeries.clear();
        emaSeries.clear();
        wmaSeries.clear();

        // Ukrycie wykresów wskaźników
        document.getElementById('volume-chart-container').style.display = 'none';
        document.getElementById('rsi-chart-container').style.display = 'none';
        document.getElementById('macd-chart-container').style.display = 'none';
        document.getElementById('obv-chart-container').style.display = 'none';
    }

    function updateIndicators() {
        clearAllIndicators();

        const periods = {
            sma: document.getElementById('smaPeriods').value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0),
            ema: document.getElementById('emaPeriods').value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0),
            wma: document.getElementById('wmaPeriods').value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0)
        };

        // Rysowanie SMA
        if (document.getElementById('toggleSMA').checked) {
            periods.sma.forEach((period, index) => {
                const smaData = calculateSMA(chartData, period);
                const series = mainChart.addSeries(LightweightCharts.LineSeries);
                series.applyOptions({
                    color: `hsl(${index * 60}, 100%, 50%)`, // Różne kolory
                    lineWidth: 1,
                    title: `SMA(${period})`
                });
                series.setData(smaData);
                smaSeries.set(period, series);
            });
        }

        // Rysowanie EMA
        if (document.getElementById('toggleEMA').checked) {
            periods.ema.forEach((period, index) => {
                const emaData = calculateEMA(chartData, period);
                const series = mainChart.addSeries(LightweightCharts.LineSeries);
                series.applyOptions({
                    color: `hsl(${index * 90 + 30}, 100%, 50%)`, // Różne kolory
                    lineWidth: 1,
                    title: `EMA(${period})`
                });
                series.setData(emaData);
                emaSeries.set(period, series);
            });
        }

        // Rysowanie WMA
        if (document.getElementById('toggleWMA').checked) {
            periods.wma.forEach((period, index) => {
                const wmaData = calculateWMA(chartData, period);
                const series = mainChart.addSeries(LightweightCharts.LineSeries);
                series.applyOptions({
                    color: `hsl(${index * 120 + 60}, 100%, 50%)`, // Różne kolory
                    lineWidth: 1,
                    title: `WMA(${period})`
                });
                series.setData(wmaData);
                wmaSeries.set(period, series);
            });
        }

        // Rysowanie Wolumenu
        if (document.getElementById('toggleVolume').checked) {
            const volumeContainer = document.getElementById('volume-chart-container');
            volumeContainer.style.display = 'block';
            const newVolumeData = chartData.map(d => ({
                time: d.time,
                value: d.volume,
                color: d.open > d.close ? 'rgba(255, 82, 82, 0.8)' : 'rgba(0, 150, 136, 0.8)'
            }));
            volumeSeries.setData(newVolumeData);
            volumeChart.timeScale().fitContent();
        }

        // Rysowanie RSI
        if (document.getElementById('toggleRSI').checked) {
            const rsiPeriod = parseInt(document.getElementById('rsiPeriod').value) || 14;
            document.getElementById('rsi-chart-container').style.display = 'block';
            const rsiData = calculateRSI(chartData, rsiPeriod);
            rsiSeries.setData(rsiData);
            rsiChart.timeScale().fitContent();
        }

        // Rysowanie MACD
        if (document.getElementById('toggleMACD').checked) {
            document.getElementById('macd-chart-container').style.display = 'block';
            const { macdLine, signalLine, macdHistogram } = calculateMACD(chartData);
            macdSeries.setData(macdLine);
            signalSeries.setData(signalLine);
            macdHistogramSeries.setData(macdHistogram.map(d => ({
                time: d.time,
                value: d.value,
                color: d.value > 0 ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)'
            })));
            macdChart.timeScale().fitContent();
        }

        // Rysowanie OBV
        if (document.getElementById('toggleOBV').checked) {
            document.getElementById('obv-chart-container').style.display = 'block';
            const obvData = calculateOBV(chartData);
            obvSeries.setData(obvData);
            obvChart.timeScale().fitContent();
        }

        // Zamknięcie modala
        indicatorsModal.hide();
    }
    // === KONIEC ZMIANY ===


    async function loadChartData(ticker) {
        try {
            const response = await fetch(`${API_URL}/api/data/${ticker}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const stooqData = await response.json();
            
            const ohlcData = stooqData.map(item => ({
                time: item.date,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume
            }));

            // Aktualizacja globalnej zmiennej chartData
            chartData = ohlcData;

            candlestickSeries.setData(ohlcData);
            chartTitle.textContent = `Wykres cenowy dla: ${ticker.toUpperCase()}`;

            // Pokaż przycisk wskaźników
            document.getElementById('indicatorsButton').style.display = 'block';

            // Po załadowaniu danych wywołujemy funkcję aktualizującą wskaźniki
            updateIndicators();

            const lastPrice = ohlcData.length > 0 ? ohlcData[ohlcData.length - 1].close : null;
            if (lastPrice) {
                await updateValuationData(ticker, lastPrice);
            }
            
        } catch (error) {
            console.error("Błąd podczas pobierania danych:", error);
            chartTitle.textContent = `Nie udało się załadować danych dla: ${ticker.toUpperCase()}`;
            clearAllIndicators();
        }
    }


    async function updateValuationData(ticker, lastPrice) {
        try {
            const response = await fetch(`${API_URL}/api/indicators/${ticker}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Upewnij się, że tabela wyceny jest pusta przed dodaniem nowych danych
            valuationTableBody.innerHTML = '';
            
            if (lastPrice) {
                // Tworzenie wierszy w tabeli dla wyceny
                const currentPriceRow = valuationTableBody.insertRow();
                currentPriceRow.insertCell(0).textContent = "Aktualna cena akcji";
                currentPriceRow.insertCell(1).textContent = lastPrice.toFixed(2);
            }

            // ... (tworzenie pozostałych wierszy w tabeli, pozostały kod w tej funkcji) ...
            let currentPrice = lastPrice;

            if (data.hasOwnProperty('Średnia stopa wzrostu EPS r/r') && data['Średnia stopa wzrostu EPS r/r'] !== null) {
                const avgGrowthRate = parseFloat(data['Średnia stopa wzrostu EPS r/r']);
                const growthRow = valuationTableBody.insertRow();
                growthRow.insertCell(0).textContent = "Średnia stopa wzrostu EPS r/r";
                growthRow.insertCell(1).textContent = `${avgGrowthRate.toFixed(2)}%`;
            }

            if (data.hasOwnProperty('Średni wskaźnik C/Z') && data['Średni wskaźnik C/Z'] !== null) {
                const avgPE = parseFloat(data['Średni wskaźnik C/Z']);
                const peRow = valuationTableBody.insertRow();
                peRow.insertCell(0).textContent = "Średni wskaźnik C/Z";
                peRow.insertCell(1).textContent = avgPE.toFixed(2);
            }

            if (data.hasOwnProperty('Prognoza EPS na kolejny rok') && data['Prognoza EPS na kolejny rok'] !== null) {
                const nextYearEps = parseFloat(data['Prognoza EPS na kolejny rok']);
                const epsRow = valuationTableBody.insertRow();
                epsRow.insertCell(0).textContent = "Prognoza EPS na kolejny rok";
                epsRow.insertCell(1).textContent = nextYearEps.toFixed(2);
            }

            if (data.hasOwnProperty('Prognoza ceny akcji na następny rok') && data['Prognoza ceny akcji na następny rok'] !== null) {
                const nextYearPrice = parseFloat(data['Prognoza ceny akcji na następny rok']);
                const priceRow = valuationTableBody.insertRow();
                priceRow.insertCell(0).textContent = "Prognoza ceny akcji na następny rok";
                priceRow.insertCell(1).textContent = nextYearPrice.toFixed(2);
            }


        } catch (error) {
            console.error("Błąd podczas pobierania wskaźników:", error);
            // Wyświetlenie komunikatu o błędzie w tabeli
            valuationTableBody.innerHTML = `<tr><td colspan="2">Brak danych wskaźnikowych dla tej spółki.</td></tr>`;
        }
    }
    
    function findMatchingCompanies(query) {
        if (!query || query.length < 2) {
            return [];
        }
        const lowerCaseQuery = query.toLowerCase();
        return companyList.filter(company => 
            company.nazwa.toLowerCase().includes(lowerCaseQuery) || 
            company.ticker.toLowerCase().includes(lowerCaseQuery)
        ).slice(0, 10);
    }

    function renderAutocomplete(suggestions) {
        searchDropdown.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.forEach(company => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.href = '#';
                item.textContent = `${company.nazwa} (${company.ticker})`;
                item.addEventListener('click', () => {
                    stockTickerInput.value = company.ticker;
                    searchDropdown.style.display = 'none';
                    loadChartData(company.ticker);
                });
                searchDropdown.appendChild(item);
            });
            searchDropdown.style.display = 'block';
        } else {
            searchDropdown.style.display = 'none';
        }
    }
    
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

    // === POCZĄTEK ZMIANY: Event Listenery dla nowych przycisków i modala ===
    indicatorsButton.addEventListener('click', () => {
        indicatorsModal.show();
    });

    applyIndicatorsBtn.addEventListener('click', updateIndicators);

    // Po załadowaniu strony ukrywamy przycisk wskaźników, dopóki dane nie zostaną załadowane
    document.getElementById('indicatorsButton').style.display = 'none';
    // === KONIEC ZMIANY ===

    window.addEventListener('resize', () => {
        mainChart.applyOptions({ width: mainChartContainer.clientWidth });
        volumeChart.applyOptions({ width: volumeChartContainer.clientWidth });
        rsiChart.applyOptions({ width: rsiChartContainer.clientWidth });
        macdChart.applyOptions({ width: macdChartContainer.clientWidth });
        obvChart.applyOptions({ width: obvChartContainer.clientWidth });
    });

    loadCompanyData().then(() => {
        loadChartData('WIG');
    });

});
