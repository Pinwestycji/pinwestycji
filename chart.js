document.addEventListener('DOMContentLoaded', function() {
    // URL twojego API na Render.com
    const API_URL = 'https://pinwestycji.onrender.com';

    // Inicjalizacja wykresu
    const chartContainer = document.getElementById('tvchart');
    const chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 500, // Zwiększona wysokość dla lepszej widoczności
        layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
        },
        grid: {
            vertLines: { color: '#f0f0f0' },
            horzLines: { color: '#f0f0f0' },
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#cccccc' },
        timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false },
    });

    // Dodaj serię świecową (candlestick series)
    const candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries);

    // Referencje do elementów DOM
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');

    // Funkcja do pobierania danych giełdowych z API
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

    // Funkcja do ładowania danych na wykres
    async function loadChartData(ticker) {
        chartTitle.textContent = `Ładowanie danych dla ${ticker.toUpperCase()}...`;
        const data = await fetchStockData(ticker);
        if (data && data.length > 0) {
            candlestickSeries.setData(data);
            chart.timeScale().fitContent(); // Automatycznie dopasuj widok
            chartTitle.textContent = `Wykres świecowy dla: ${ticker.toUpperCase()}`;
            console.log(`Dane giełdowe dla ${ticker} załadowane pomyślnie.`);
        } else {
            candlestickSeries.setData([]);
            chartTitle.textContent = `Brak danych do wyświetlenia dla: ${ticker.toUpperCase()}`;
            console.warn(`Brak danych do wyświetlenia dla symbolu ${ticker}.`);
        }
    }

    // Obsługa zdarzeń
    stockTickerInput.addEventListener('input', async () => {
        const query = stockTickerInput.value.trim().toUpperCase();
        if (query.length > 1) {
            const suggestions = await fetchAutocomplete(query);
            renderAutocomplete(suggestions);
        } else {
            searchDropdown.style.display = 'none';
        }
    });
    
    // Ukrywanie sugestii po kliknięciu gdziekolwiek indziej
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

    // Ustawienie skalowania dla responsywności
    window.addEventListener('resize', () => {
        chart.applyOptions({ width: chartContainer.clientWidth });
    });

    // Załaduj przykładowy wykres na starcie (opcjonalnie)
    loadChartData('JSW');
});
