// Plik: chart.js - Wersja z poprawionym wyświetlaniem sugestii

document.addEventListener('DOMContentLoaded', function() {
    async function loadCompanyData() {
        try {
            const response = await fetch('wig_companies.csv');
            const csvText = await response.text();
            
            // Poprawiona, odporna wersja
            const rows = csvText.trim().split(/\r?\n/).slice(1);
            companyList = rows.map(row => {
                const [nazwa, ticker] = row.split(',');
                if (nazwa && ticker) {
                    // Nowy kod usuwa cudzysłów z początku i końca, a następnie przycina białe znaki
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

    const API_URL = 'https://pinwestycji.onrender.com';
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];

    const chartContainer = document.getElementById('tvchart');
    const mainChart = LightweightCharts.createChart(chartContainer, { width: chartContainer.clientWidth, height: 500, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, rightPriceScale: { borderColor: '#cccccc' }, timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false } });
    const candlestickSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries);
    const volumeSeries = mainChart.addSeries(LightweightCharts.HistogramSeries);
    candlestickSeries.applyOptions({ upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)', borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)', wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)' });
    volumeSeries.applyOptions({ priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.65, bottom: 0 } });

    const projectionChartContainer = document.getElementById('projectionChart');
    const projectionChart = LightweightCharts.createChart(projectionChartContainer, { width: projectionChartContainer.clientWidth, height: 300, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } } });
    const projectionSeries = projectionChart.addSeries(LightweightCharts.HistogramSeries);
    projectionSeries.applyOptions({
        color: 'rgba(33, 150, 243, 0.8)'
    });

    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');
    const valuationTableBody = document.getElementById('valuationTableBody');
    const projectionTableBody = document.getElementById('projectionTableBody');
    const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');

    // === POCZĄTEK NOWEJ SEKCJI: Funkcja do pobierania wskaźników z API ===
    async function fetchIndicatorData(ticker) {
        try {
            const response = await fetch(`${API_URL}/api/indicators/${ticker}`);
            if (!response.ok) {
                // Jeśli serwer zwróci błąd (np. 404), zwróć pusty obiekt
                console.warn(`Nie udało się pobrać wskaźników dla ${ticker}, status: ${response.status}`);
                return {}; 
            }
            return await response.json();
        } catch (error) {
            console.error("Błąd podczas pobierania danych wskaźnikowych:", error);
            return {}; // Zwróć pusty obiekt w razie błędu sieciowego
        }
    }
    // === KONIEC NOWEJ SEKCJI ===

    // Funkcja do pobierania gotowych wskaźników (bez zmian w wywołaniu)
    async function fetchIndicatorData(ticker) {
        try {
            const response = await fetch(`${API_URL}/api/indicators/${ticker}`);
            // Zwracamy cały obiekt odpowiedzi, aby sprawdzić status (np. 404)
            return response;
        } catch (error) {
            console.error("Błąd sieci podczas pobierania danych wskaźnikowych:", error);
            return null; // Zwróć null w razie błędu sieciowego
        }
    }

   // === POCZĄTEK POPRAWKI w funkcji `updateValuationData` ===
    async function updateValuationData(ticker, data) {
        const isIndex = indexTickers.includes(ticker.toUpperCase());

        // Ukrywamy całą sekcję na start, aby uniknąć mrugania starymi danymi
        valuationCalculatorSection.style.display = 'none';
        valuationCalculatorSection.innerHTML = ''; // Czyścimy zawartość na wypadek starych komunikatów o błędach

        if (isIndex || data.length === 0) {
            return; // Dla indeksów i braku danych po prostu nic nie pokazujemy
        }
        
        const indicatorResponse = await fetchIndicatorData(ticker);
        let message = '';

        if (!indicatorResponse || !indicatorResponse.ok) {
            message = indicatorResponse && indicatorResponse.status === 404
                ? `Nie znaleziono spółki '${ticker.toUpperCase()}' w bazie wskaźników.`
                : 'Błąd serwera podczas pobierania wskaźników.';
        } else {
            const indicators = await indicatorResponse.json();
            if (indicators.latest_eps === null || indicators.latest_eps === undefined) {
                message = `Brak danych EPS bądź C/Z ze strony https://www.stockwatch.pl/ dla spółki '${ticker.toUpperCase()}'.`;
            } else {
                // --- SUKCES: Mamy dane, budujemy HTML kalkulatora ---
                const lastPrice = data[data.length - 1].close;
                let currentCZ = (indicators.latest_eps > 0) ? (lastPrice / indicators.latest_eps).toFixed(2) : 'Brak danych';

                const valuationData = {
                    'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
                    'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
                    'EPS (zysk na akcję)': `${indicators.latest_eps} zł`,
                    'Aktualny C/Z': currentCZ,
                    'Średni EPS': indicators.avg_eps ? `${indicators.avg_eps} zł` : 'Brak danych',
                    'Średni C/Z': indicators.avg_cz ? `${indicators.avg_cz} zł` : 'Brak danych',
                    'Tempo wzrostu': '15%', 'Stopa zwrotu za 5 lat': '15%',
                    'Potencjalny C/Z za 5 lat': '30.00', 'Wycena Akcji': '120.50 zł',
                    'Dobra Cena': 'Tak'
                };

                // Odtwarzamy HTML kalkulatora
                valuationCalculatorSection.innerHTML = document.getElementById('kalkulator-template').innerHTML;
                
                // Wypełniamy tabele nowymi danymi
                const valTableBody = valuationCalculatorSection.querySelector('#valuationTableBody');
                for (const [key, value] of Object.entries(valuationData)) {
                    let row = valTableBody.insertRow();
                    row.insertCell(0).innerHTML = key;
                    row.insertCell(1).innerHTML = value;
                }
                
                // ... (logika dla prawej tabeli i wykresu prognoz) ...
                 const projTableBody = valuationCalculatorSection.querySelector('#projectionTableBody');
                 const projChartContainer = valuationCalculatorSection.querySelector('#projectionChart');

                 const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
                 const pEpsData = ['<strong>Zysk na akcję</strong>', '5.98 zł', '6.88 zł', '7.91 zł', '9.10 zł', '10.46 zł'];
                 const pPriceData = ['<strong>Cena Akcji</strong>', 179.40, 206.40, 237.30, 273.00, 313.80];
                 let headerRow = projTableBody.insertRow();
                 pHeaderData.forEach(text => headerRow.insertCell().innerHTML = `<strong>${text}</strong>`);
                 let epsRow = projTableBody.insertRow();
                 pEpsData.forEach(text => epsRow.insertCell().innerHTML = text);
                 let priceRow = projTableBody.insertRow();
                 pPriceData.forEach(text => priceRow.insertCell().innerHTML = typeof text === 'number' ? `${text.toFixed(2)} zł` : text);
                 
                 // Ponowna inicjalizacja wykresu prognoz, ponieważ odtworzyliśmy jego kontener
                 projectionChart.remove(); // Usuwamy stary wykres
                
                 const newProjectionChart = LightweightCharts.createChart(projectionChartContainer, { width: projectionChartContainer.clientWidth, height: 300, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } } });
                 const newProjectionSeries =  newProjectionChart.addSeries(LightweightCharts.HistogramSeries);
                 newProjectionSeries.applyOptions({
                    color: 'rgba(33, 150, 243, 0.8)'
                 });
                 const projectionChartData = pPriceData.slice(1).map((price, index) => ({ time: `${2026 + index}-01-01`, value: price }));
                 newProjectionSeries.setData(projectionChartData);
                 newProjectionChart.timeScale().fitContent();

                valuationCalculatorSection.style.display = 'flex'; // Pokaż całą sekcję
                return; // Zakończ pomyślnie
            }
        }
        
        // Jeśli wystąpił jakikolwiek błąd, wyświetl komunikat
        valuationCalculatorSection.innerHTML = `<div class="col-12 text-center text-muted p-5"><i class="fas fa-exclamation-triangle fa-2x mb-2"></i><br>${message}</div>`;
        valuationCalculatorSection.style.display = 'flex';
    }
    // === KONIEC POPRAWKI ===
    
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
        updateValuationData(ticker, data);
    }

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

    loadCompanyData().then(() => {
        loadChartData('WIG20');
    });
});
