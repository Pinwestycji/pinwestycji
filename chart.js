document.addEventListener('DOMContentLoaded', function() {
    // URL twojego API na Render.com
    const API_URL = 'https://pinwestycji.onrender.com';

    // Inicjalizacja wykresu i serii danych (część Twojego oryginalnego kodu)
    const chart = LightweightCharts.createChart(document.getElementById('tvchart'), {
        width: document.getElementById('tvchart').clientWidth,
        height: 400,
        layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
        },
        grid: {
            vertLines: {
                color: '#e0e0e0',
            },
            horzLines: {
                color: '#e0e0e0',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#e0e0e0',
        },
        timeScale: {
            borderColor: '#e0e0e0',
        },
    });

    const candlestickSeries = chart.addCandlestickSeries();

    // Referencje do elementów DOM
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');

    // Funkcja do pobierania danych giełdowych z API
    async function fetchStockData(ticker) {
        if (!ticker) {
            return [];
        }
        try {
            const response = await fetch(`${API_URL}/api/data/${ticker}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Błąd HTTP: ${response.status} - ${errorData.error}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Błąd podczas pobierania danych giełdowych:", error);
            alert(`Wystąpił błąd podczas pobierania danych: ${error.message}. Sprawdź symbol spółki.`);
            return [];
        }
    }

    // Funkcja do pobierania propozycji wyszukiwania (autocomplete)
    async function fetchAutocomplete(query) {
        if (!query || query.length < 2) { // Minimalna długość zapytania
            return [];
        }
        try {
            const response = await fetch(`${API_URL}/api/search?query=${query}`);
            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Błąd podczas pobierania propozycji wyszukiwania:", error);
            return [];
        }
    }

    // Funkcja do renderowania propozycji wyszukiwania w dropdownie
    function renderAutocomplete(suggestions) {
        searchDropdown.innerHTML = ''; // Wyczyść poprzednie propozycje
        if (suggestions && suggestions.length > 0) {
            searchDropdown.style.display = 'block'; // Pokaż dropdown
            suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.classList.add('list-group-item', 'list-group-item-action');
                li.textContent = suggestion;
                li.addEventListener('click', () => {
                    stockTickerInput.value = suggestion;
                    searchDropdown.style.display = 'none';
                    loadChartData(suggestion);
                });
                searchDropdown.appendChild(li);
            });
        } else {
            searchDropdown.style.display = 'none'; // Ukryj dropdown, jeśli brak propozycji
        }
    }

    // Funkcja do ładowania danych na wykres
    async function loadChartData(ticker) {
        const data = await fetchStockData(ticker);
        if (data && data.length > 0) {
            candlestickSeries.setData(data);
            console.log(`Dane giełdowe dla ${ticker} załadowane pomyślnie.`);
        } else {
            candlestickSeries.setData([]);
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

    searchButton.addEventListener('click', () => {
        const ticker = stockTickerInput.value.trim().toUpperCase();
        loadChartData(ticker);
        searchDropdown.style.display = 'none';
    });

    stockTickerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    // Początkowe ładowanie pustego wykresu
    candlestickSeries.setData([]);

    // Ustawienie skalowania dla responsywności
    window.addEventListener('resize', () => {
        chart.applyOptions({ width: document.getElementById('tvchart').clientWidth });
    });
});
