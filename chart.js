// Plik: chart(3).js
document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://pinwestycji.onrender.com';
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const searchButton = document.getElementById('searchButton');
    
    // Zmienna do przechowywania danych ze spółkami
    let popularCompanies = [];

    // =========================================================================
    // INICJALIZACJA WYKRESÓW
    // =========================================================================

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
    const candlestickSeries = mainChart.addSeries({
        upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)',
        borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)',
        wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)',
    });
    const volumeSeries = mainChart.addSeries({
        color: 'rgba(41, 98, 255, 0.5)',
        priceScaleId: 'volume',
        scaleMargins: { top: 0.8, bottom: 0 },
    });
    mainChart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        borderVisible: false,
    });
    
    // =========================================================================
    // FUNKCJE DO ŁADOWANIA DANYCH I WYSZUKIWANIA
    // =========================================================================

    // Funkcja do wczytywania danych z pliku CSV
    // Funkcja do wczytywania danych z pliku CSV
    async function loadCompanyData() {
        const csvUrl = 'https://pinwestycji.github.io/gpw-data-server/data/wig_companies.csv';
        try {
            const response = await fetch(csvUrl);
            const data = await response.text();
            
            // Parsowanie CSV i przygotowanie listy do wyszukiwania
            const rows = data.split('\n').slice(1); // Pomijamy nagłówek
            popularCompanies = rows.map(row => {
                const cols = row.split(',');
                // Upewnij się, że kolumny są w poprawnym indeksie
                const name = cols[0] ? cols[0].replace(/"/g, '') : '';
                const ticker = cols[1] ? cols[1].replace(/"/g, '') : '';
                return { name, ticker };
            }).filter(item => item.name && item.ticker); // Filtrujemy puste wiersze

            console.log("Pomyślnie załadowano dane spółek:", popularCompanies.length);
        } catch (error) {
            console.error("Błąd podczas ładowania danych spółek:", error);
        }
    }
    
    // Funkcja pobierająca dane ze Stooq.pl przez nasz serwer
    async function loadChartData(ticker) {
        const chartTitle = document.getElementById('chartTitle');
        chartTitle.textContent = `Ładowanie danych dla: ${ticker.toUpperCase()}...`;
        
        try {
            const response = await fetch(`${API_URL}/api/data/${ticker}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Błąd: Nie znaleziono danych dla tickera: ${ticker}.`);
                }
                throw new Error(`Wystąpił błąd serwera. Status: ${response.status}`);
            }
            const data = await response.json();

            if (data.length > 0) {
            // Dodajemy walidację, aby upewnić się, że dane są poprawne
            const validData = data.filter(d => 
                d.time && d.open && d.high && d.low && d.close && d.volume
            );

            if (validData.length === 0) {
                candlestickSeries.setData([]);
                volumeSeries.setData([]);
                chartTitle.textContent = `Brak poprawnych danych do wyświetlenia dla: ${ticker.toUpperCase()}`;
                return;
            }

            const processedData = validData.map(d => ({
                time: new Date(d.time).getTime() / 1000,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            const volumeData = validData.map(d => ({
                time: new Date(d.time).getTime() / 1000,
                value: d.volume,
                color: d.close > d.open ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 82, 82, 0.5)'
            }));

            candlestickSeries.setData(processedData);
            volumeSeries.setData(volumeData);
            chartTitle.textContent = `Wykres cenowy dla ${ticker.toUpperCase()}`;
        }
            } else {
                candlestickSeries.setData([]);
                volumeSeries.setData([]);
                chartTitle.textContent = `Brak danych do wyświetlenia dla: ${ticker.toUpperCase()}`;
            }
        } catch (error) {
            console.error("Błąd podczas pobierania danych wykresu:", error);
            candlestickSeries.setData([]);
            volumeSeries.setData([]);
            chartTitle.textContent = `Błąd: ${error.message}`;
        }
    }

    // =========================================================================
    // NOWA FUNKCJA WYSZUKIWANIA I AUTOUZUPEŁNIANIA
    // =========================================================================

    function filterCompanies(query) {
        query = query.toLowerCase().trim();
        return popularCompanies.filter(company => {
            const name = company.name.toLowerCase();
            const ticker = company.ticker.toLowerCase();
            return name.includes(query) || ticker.includes(query);
        });
    }

    function renderDropdown(companies) {
        searchDropdown.innerHTML = '';
        if (companies.length > 0) {
            companies.slice(0, 10).forEach(company => {
                const item = document.createElement('a');
                item.href = '#';
                item.classList.add('list-group-item', 'list-group-item-action');
                item.textContent = `${company.name} - ${company.ticker}`;
                item.dataset.ticker = company.ticker;
                searchDropdown.appendChild(item);
            });
            searchDropdown.style.display = 'block';
        } else {
            searchDropdown.style.display = 'none';
        }
    }

    // =========================================================================
    // OBSŁUGA ZDARZEŃ
    // =========================================================================
    
    // Obsługa wprowadzania tekstu
    stockTickerInput.addEventListener('input', () => {
        const query = stockTickerInput.value.trim();
        if (query.length > 1) {
            const matches = filterCompanies(query);
            renderDropdown(matches);
        } else {
            searchDropdown.style.display = 'none';
        }
    });

    // Obsługa kliknięcia na element w rozwijanej liście
    searchDropdown.addEventListener('click', (event) => {
        const selectedItem = event.target;
        if (selectedItem.tagName === 'A') {
            const ticker = selectedItem.dataset.ticker;
            stockTickerInput.value = selectedItem.textContent; // Wstawia pełną nazwę do inputu
            loadChartData(ticker);
            searchDropdown.style.display = 'none';
        }
    });
    
    // Obsługa kliknięcia przycisku wyszukiwania
    searchButton.addEventListener('click', () => {
        const query = stockTickerInput.value.trim();
        if (query) {
            // Spróbuj znaleźć pełny ticker na podstawie tekstu w polu input
            const foundCompany = popularCompanies.find(company => 
                (company.name.toLowerCase() + '-' + company.ticker.toLowerCase()) === query.toLowerCase() ||
                company.ticker.toLowerCase() === query.toLowerCase()
            );

            const tickerToSearch = foundCompany ? foundCompany.ticker : query;
            loadChartData(tickerToSearch);
            searchDropdown.style.display = 'none';
        }
    });

    // Obsługa wciśnięcia klawisza Enter
    stockTickerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    // Ukrywanie listy po kliknięciu poza nią
    document.addEventListener('click', function(event) {
        if (!stockTickerInput.contains(event.target) && !searchDropdown.contains(event.target)) {
            searchDropdown.style.display = 'none';
        }
    });

    // Obsługa zmiany rozmiaru okna
    window.addEventListener('resize', () => {
        mainChart.applyOptions({ width: chartContainer.clientWidth });
    });

    // Inicjalne załadowanie danych po załadowaniu DOM
    loadCompanyData().then(() => {
        // Po załadowaniu danych spółek, ładujemy domyślny wykres
        loadChartData('WIG20');
    });
});
