// Plik: chart.js

document.addEventListener('DOMContentLoaded', function() {
    // URL twojego API na Render.com - upewnij się, że jest poprawny
    const API_URL = 'https://pinwestycji.onrender.com';

    // Inicjalizacja wykresu
    const chartContainer = document.getElementById('tvchart');
    const chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 500,
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
   
   // === POCZĄTEK ZMIAN ===
   // Twoja obecna, poprawna składnia tworzenia serii
    const candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries);
    const volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries);

    // ROZWIĄZANIE: Dodajemy konfigurację za pomocą applyOptions
    
    // 1. Opcje dla wykresu świecowego (kolory)
    candlestickSeries.applyOptions({
        upColor: 'rgba(0, 150, 136, 1)',      // Zielony
        downColor: 'rgba(255, 82, 82, 1)',    // Czerwony
        borderDownColor: 'rgba(255, 82, 82, 1)',
        borderUpColor: 'rgba(0, 150, 136, 1)',
        wickDownColor: 'rgba(255, 82, 82, 1)',
        wickUpColor: 'rgba(0, 150, 136, 1)',
    });

    // 2. Opcje dla wolumenu (osobny panel i skala)
    volumeSeries.applyOptions({
        priceFormat: {
            type: 'volume',
        },
        // --- TO JEST KLUCZOWY ELEMENT ---
        // Puste ID odłącza serię od głównej skali cenowej i tworzy dla niej nowy panel
        priceScaleId: '', 
        // ---------------------------------
        scaleMargins: {
            top: 0.8, // 80% miejsca od góry na wykres cenowy
            bottom: 0,  // 20% miejsca na dole dla wolumenu
        },
    });
    
    // === KONIEC ZMIAN ===


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
            // === POCZĄTEK ZMIAN ===

            // Ustaw dane dla serii świecowej (bez zmian)
            candlestickSeries.setData(data);

            // Przygotuj i ustaw dane dla serii wolumenu
            const volumeData = data.map(d => ({
                time: d.time,
                value: d.volume,
                // Ustaw kolor słupka wolumenu w zależności od tego, czy świeca była wzrostowa czy spadkowa
                color: d.close >= d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)',
            }));
            volumeSeries.setData(volumeData);
            
            // === KONIEC ZMIAN ===

            chart.timeScale().fitContent();
            chartTitle.textContent = `Wykres świecowy dla: ${ticker.toUpperCase()}`;
            console.log(`Dane giełdowe dla ${ticker} załadowane pomyślnie.`);
        } else {
            candlestickSeries.setData([]);
            volumeSeries.setData([]); // Czyścimy również dane wolumenu
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

    loadChartData('JSW');
});
