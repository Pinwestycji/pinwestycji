document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://pinwestycji.onrender.com';

    // === POCZĄTEK ZMIAN ===
    // Lista znanych tickerów, które są indeksami i nie powinny pokazywać wolumenu
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];
    // === KONIEC ZMIAN ===

    const chartContainer = document.getElementById('tvchart');
    const chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 500,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false },
    });

    const candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries);
    const volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries);

    candlestickSeries.applyOptions({
        upColor: 'rgba(0, 150, 136, 1)',
        downColor: 'rgba(255, 82, 82, 1)',
        borderDownColor: 'rgba(255, 82, 82, 1)',
        borderUpColor: 'rgba(0, 150, 136, 1)',
        wickDownColor: 'rgba(255, 82, 82, 1)',
        wickUpColor: 'rgba(0, 150, 136, 1)',
    });

    volumeSeries.applyOptions({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: {
            top: 0.95,  // <-- ZMIANA: Dajemy 65% miejsca wykresowi cen, a 35% wolumenowi
            bottom: 0,
        },
    });

    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');

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

   // === POCZĄTEK ZMIAN w funkcji loadChartData ===
    async function loadChartData(ticker) {
        chartTitle.textContent = `Ładowanie danych dla ${ticker.toUpperCase()}...`;
        const data = await fetchStockData(ticker);
        
        const isIndex = indexTickers.includes(ticker.toUpperCase());

        if (data && data.length > 0) {
            candlestickSeries.setData(data);

            if (isIndex) {
                // Jeśli to indeks, czyścimy dane wolumenu i ukrywamy serię
                volumeSeries.setData([]);
                volumeSeries.applyOptions({ visible: false });
            } else {
                // Jeśli to zwykła spółka, pokazujemy serię i ustawiamy dane wolumenu
                volumeSeries.applyOptions({ visible: true });
                const volumeData = data.map(d => ({
                    time: d.time,
                    value: d.volume,
                    color: d.close >= d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)',
                }));
                volumeSeries.setData(volumeData);
            }

            chart.timeScale().fitContent();
            chartTitle.textContent = `Wykres dla: ${ticker.toUpperCase()}`;
        } else {
            candlestickSeries.setData([]);
            volumeSeries.setData([]);
            chartTitle.textContent = `Brak danych do wyświetlenia dla: ${ticker.toUpperCase()}`;
        }
    }
    // === KONIEC ZMIAN w funkcji loadChartData ===


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
