// Plik: chart.js

document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://pinwestycji.onrender.com';
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];

    // =========================================================================
    // INICJALIZACJA WYKRESÓW
    // =========================================================================

    // Wykres 1: Historyczny wykres świecowy
    const chartContainer = document.getElementById('tvchart');
    const mainChart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 500,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false },
    });
    const candlestickSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries);
    const volumeSeries = mainChart.addSeries(LightweightCharts.HistogramSeries);
    candlestickSeries.applyOptions({
        upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)',
        borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)',
        wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)',
    });
    volumeSeries.applyOptions({
        priceFormat: { type: 'volume' }, priceScaleId: '',
        scaleMargins: { top: 0.65, bottom: 0 },
    });

 // Wykres 2: Wykres kolumnowy z prognozą cen
    const projectionChartContainer = document.getElementById('projectionChart');
    const projectionChart = LightweightCharts.createChart(projectionChartContainer, {
        width: projectionChartContainer.clientWidth,
        height: 300,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
    });
    const projectionSeries = projectionChart.addSeries(LightweightCharts.HistogramSeries);
    
    projectionSeries.applyOptions({
        color: 'rgba(33, 150, 243, 0.8)'
    });


    // =========================================================================
    // REFERENCJE DO ELEMENTÓW DOM
    // =========================================================================
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const chartTitle = document.getElementById('chart-title');
    const valuationTable = document.getElementById('valuationTable').getElementsByTagName('tbody')[0];
    const projectionTable = document.getElementById('projectionTable');


    // =========================================================================
    // NOWA FUNKCJA DO AKTUALIZACJI DANYCH WYCENY
    // =========================================================================
    function updateValuationData(ticker, data) {
        const isIndex = indexTickers.includes(ticker.toUpperCase());
        
        // Czyszczenie starych danych
        valuationTable.innerHTML = '';
        projectionTable.innerHTML = '';
        projectionSeries.setData([]);

        if (isIndex || data.length === 0) {
            // Jeśli to indeks lub brak danych, pozostawiamy sekcję pustą
            return;
        }

        // --- WYPEŁNIANIE LEWEJ TABELI (WYCENA) ---
        const lastPrice = data[data.length - 1].close; // Pobieramy ostatnią cenę zamknięcia
        const valuationData = {
            'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
            'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
            'EPS (zysk na akcję)': '5.20 zł',
            'Aktualny C/Z': (lastPrice / 5.20).toFixed(2),
            'Tempo wzrostu': '15%',
            'Stopa zwrotu za 5 lat': '15%',
            'Potencjalny C/Z za 5 lat': '30.00',
            'Wycena Akcji': '120.50 zł',
            'Dobra Cena': 'Tak' // W przyszłości tu będzie logika
        };

        for (const [key, value] of Object.entries(valuationData)) {
            let row = valuationTable.insertRow();
            let cell1 = row.insertCell(0);
            let cell2 = row.insertCell(1);
            cell1.innerHTML = key;
            cell2.innerHTML = value;
        }

        // --- WYPEŁNIANIE PRAWEJ TABELI (PROJEKCJE) ---
        // Nagłówek
        let pHeader = projectionTable.createTHead().insertRow(0);
        pHeader.insertCell(0).innerHTML = '';
        for (let i = 0; i < 5; i++) {
            pHeader.insertCell(i + 1).innerHTML = `<strong>${2026 + i}</strong>`;
        }
        // Wiersze
        let pBody = projectionTable.createTBody();
        const pEpsData = ['5.98', '6.88', '7.91', '9.10', '10.46']; // Testowe EPS
        const pPriceData = [179.40, 206.40, 237.30, 273.00, 313.80]; // Testowe ceny
        
        let epsRow = pBody.insertRow();
        epsRow.insertCell(0).innerHTML = '<strong>Zysk na akcję</strong>';
        pEpsData.forEach(val => epsRow.insertCell().innerHTML = `${val} zł`);

        let priceRow = pBody.insertRow();
        priceRow.insertCell(0).innerHTML = '<strong>Cena Akcji</strong>';
        pPriceData.forEach(val => priceRow.insertCell().innerHTML = `${val.toFixed(2)} zł`);

        // --- AKTUALIZACJA WYKRESU PROGNOZ ---
        const projectionChartData = pPriceData.map((price, index) => ({
            time: `${2026 + index}-01-01`,
            value: price,
        }));
        projectionSeries.setData(projectionChartData);
        projectionChart.timeScale().fitContent();
    }


    async function fetchStockData(ticker) {
        if (!ticker) return [];
        try {
            const response = await fetch(`${API_URL}/api/data/${ticker}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Błąd HTTP ${response.status}: ${errorData.error}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Błąd podczas pobierania danych giełdowych:", error);
            alert(`Wystąpił błąd: ${error.message}. Sprawdź symbol spółki lub spróbuj ponownie.`);
            return [];
        }
    }
    // Funkcja do pobierania propozycji wyszukiwania (autocomplete)
    async function fetchAutocomplete(query) {
        if (!query || query.length < 2) return [];
        try {
            const response = await fetch(`${API_URL}/api/search?query=${query}`);
            if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Błąd podczas pobierania propozycji wyszukiwania:", error);
            return [];
        }
    }

    // Funkcja do renderowania propozycji wyszukiwania
    function renderAutocomplete(suggestions) {
        searchDropdown.innerHTML = '';
        if (suggestions && suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const item = document.createElement('a');
                item.classList.add('list-group-item', 'list-group-item-action');
                item.href = "#";
                item.textContent = suggestion;
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    stockTickerInput.value = suggestion;
                    searchDropdown.style.display = 'none';
                    loadChartData(suggestion);
                });
                searchDropdown.appendChild(item);
            });
            searchDropdown.style.display = 'block';
        } else {
            searchDropdown.style.display = 'none';
        }
    }

 
    // =========================================================================
    // GŁÓWNA FUNKCJA ŁADOWANIA DANYCH (ZAKTUALIZOWANA)
    // =========================================================================
    async function loadChartData(ticker) {
        chartTitle.textContent = `Ładowanie danych dla ${ticker.toUpperCase()}...`;
        const data = await fetchStockData(ticker);
        
        const isIndex = indexTickers.includes(ticker.toUpperCase());

        if (data && data.length > 0) {
            candlestickSeries.setData(data);

            if (isIndex) {
                volumeSeries.setData([]);
                volumeSeries.applyOptions({ visible: false });
            } else {
                volumeSeries.applyOptions({ visible: true });
                const volumeData = data.map(d => ({
                    time: d.time, value: d.volume,
                    color: d.close >= d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)',
                }));
                volumeSeries.setData(volumeData);
            }

            mainChart.timeScale().fitContent();
            chartTitle.textContent = `Wykres dla: ${ticker.toUpperCase()}`;
        } else {
            candlestickSeries.setData([]);
            volumeSeries.setData([]);
            chartTitle.textContent = `Brak danych do wyświetlenia dla: ${ticker.toUpperCase()}`;
        }
        
        // WYWOŁANIE NOWEJ FUNKCJI
        updateValuationData(ticker, data);
    }


    // Reszta pliku bez zmian...
    stockTickerInput.addEventListener('input', async () => {
        const query = stockTickerInput.value.trim().toUpperCase();
        if (query.length > 1) {
            const suggestions = await fetchAutocomplete(query);
            renderAutocomplete(suggestions);
        } else {
            searchDropdown.style.display = 'none';
        }
    });
    
    document.addEventListener('click', function(event) {
        const isClickInside = stockTickerInput.contains(event.target) || searchDropdown.contains(event.target);
        if (!isClickInside) {
            searchDropdown.style.display = 'none';
        }
    });

    searchButton.addEventListener('click', () => {
        const ticker = stockTickerInput.value.trim().toUpperCase();
        if (ticker) {
            loadChartData(ticker);
            searchDropdown.style.display = 'none';
        }
    });

    stockTickerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    window.addEventListener('resize', () => {
        chart.applyOptions({ width: chartContainer.clientWidth });
    });

    loadChartData('WIG20');
});
