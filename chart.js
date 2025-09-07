// Plik: chart.js - Wersja z poprawionym wyświetlaniem sugestii, nową logiką wyceny i działającym wykresem projekcji

document.addEventListener('DOMContentLoaded', function() {
    // === POCZĄTEK ZMIAN: Dodajemy zmienną globalną na listę spółek ===
    let companyList = []; 
    // === KONIEC ZMIAN ===

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
    // const API_URL = 'http://127.0.0.1:5001'; // Lokalny adres do testów
    const indexTickers = ['WIG20', 'WIG', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'];

    const chartContainer = document.getElementById('tvchart');
    const mainChart = LightweightCharts.createChart(chartContainer, { width: chartContainer.clientWidth, height: 500, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, rightPriceScale: { borderColor: '#cccccc' }, timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false } });
    const candlestickSeries = mainChart.addSeries(LightweightCharts.CandlestickSeries);
    const volumeSeries = mainChart.addSeries(LightweightCharts.HistogramSeries);
    candlestickSeries.applyOptions({ upColor: 'rgba(0, 150, 136, 1)', downColor: 'rgba(255, 82, 82, 1)', borderDownColor: 'rgba(255, 82, 82, 1)', borderUpColor: 'rgba(0, 150, 136, 1)', wickDownColor: 'rgba(255, 82, 82, 1)', wickUpColor: 'rgba(0, 150, 136, 1)' });
    volumeSeries.applyOptions({ priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.65, bottom: 0 } });
    
    const projectionChartContainer = document.getElementById('projectionChart');
    const projectionChart = LightweightCharts.createChart(projectionChartContainer, { width: projectionChartContainer.clientWidth, height: 300, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, rightPriceScale: { borderColor: '#cccccc' }, timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false } });

    // Tworzenie tylko jednej serii - dla prognozowanych cen
    const priceSeries = projectionChart.addSeries(LightweightCharts.HistogramSeries);
    priceSeries.applyOptions({
        color: '#007bff'
    });

    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    const searchDropdown = document.getElementById('searchDropdown');
    const chartTitle = document.getElementById('chart-title');
    const projectionTableBody = document.getElementById('projectionTableBody');


    // === POCZĄTEK ZMIAN: CAŁKOWICIE PRZEBUDOWANA FUNKCJA ===
    async function updateValuationData(ticker, lastPrice, indicators) {
        const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');
        const valuationTableBody = valuationCalculatorSection.querySelector('#valuationTableBody');
        
        // Funkcja pomocnicza do bezpiecznego parsowania wartości
        const parseValue = (value) => {
            if (value === null || value === undefined || String(value).trim().toLowerCase() === 'n/a') {
                return null;
            }
            const num = parseFloat(String(value).replace(',', '.'));
            return isNaN(num) ? null : num;
        };

        // Pobieranie i parsowanie danych z obiektu 'indicators'
        const aktualnyEps = parseValue(indicators['Aktualny EPS']);
        const sredniCZ = parseValue(indicators['Średni wskaźnik C/Z']);
        const tempoWzrostu = parseValue(indicators['Średnia stopa wzrostu EPS r/r']);
        const prognozaCena = parseValue(indicators['Prognoza ceny akcji na następny rok']);

        // Obliczenia
        const currentCZ = (aktualnyEps && lastPrice) ? (lastPrice / aktualnyEps).toFixed(2) : 'Brak danych';
        const returnRate = (prognozaCena && lastPrice) ? (((prognozaCena / lastPrice) - 1) * 100).toFixed(2) : 'Brak danych';
        
        const valuationData = {
            'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
            'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
            'Aktualny EPS (zysk na akcję)': aktualnyEps !== null ? `${aktualnyEps.toFixed(2)} zł` : 'Brak danych',
            'Aktualny C/Z': currentCZ,
            'Średni C/Z': sredniCZ !== null ? sredniCZ.toFixed(2) : 'Brak danych',
            'Tempo wzrostu': tempoWzrostu !== null ? `${tempoWzrostu.toFixed(2)} %` : 'Brak danych',
            'Stopa zwrotu na marzec/kwiecień 2026 rok': returnRate !== 'Brak danych' ? `${returnRate} %` : 'Brak danych',
            'Wycena Akcji na marzec/kwiecień 2026 rok': prognozaCena !== null ? `${prognozaCena.toFixed(2)} zł` : 'Brak danych',
            'Dobra Cena': 'Tak' // Tu na razie bez zmian
        };

        // Tworzenie tabeli wyceny
        let valuationHtml = '';
        for (const key in valuationData) {
            valuationHtml += `<tr><th>${key}</th><td>${valuationData[key]}</td></tr>`;
        }
        valuationTableBody.innerHTML = valuationHtml;
        
        // Modyfikacja tabeli projekcji
        const projTableBody = valuationCalculatorSection.querySelector('#projectionTableBody');
        const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
        
        const pEpsData = ['<strong>Zysk na akcję</strong>'];
        const pPriceData = ['<strong>Cena Akcji</strong>'];
        const priceChartData = [];
        
        const currentYear = new Date().getFullYear();
        
        // Sprawdzamy, czy mamy potrzebne dane do prognoz
        if (aktualnyEps !== null && tempoWzrostu !== null && sredniCZ !== null) {
            const tempoWzrostuDecimal = tempoWzrostu / 100;

            for (let i = 1; i <= 5; i++) {
                const year = currentYear + i;
                
                // Obliczenie prognozowanego EPS
                const prognozaEps = aktualnyEps * Math.pow((1 + tempoWzrostuDecimal), i);
                pEpsData.push(`${prognozaEps.toFixed(2)} zł`);
                
                // Obliczenie prognozowanej ceny akcji
                const prognozaPrice = prognozaEps * sredniCZ;
                pPriceData.push(`${prognozaPrice.toFixed(2)} zł`);

                // Dodajemy dane do wykresu w formacie YYYY-MM-DD
                priceChartData.push({ time: `${year}-03-15`, value: prognozaPrice });
            }
        } else {
             // Jeśli brakuje danych, wypełniamy tabelę informacją o braku danych
            for (let i = 1; i <= 5; i++) {
                pEpsData.push('Brak danych');
                pPriceData.push('Brak danych');
            }
        }
        
        // Tworzenie tabeli projekcji
        let projHtml = `<tr><th>${pHeaderData[0]}</th>` + pHeaderData.slice(1).map(year => `<th>${year}</th>`).join('') + `</tr>`;
        projHtml += `<tr><td>${pEpsData[0]}</td>` + pEpsData.slice(1).map(eps => `<td>${eps}</td>`).join('') + `</tr>`;
        projHtml += `<tr><td>${pPriceData[0]}</td>` + pPriceData.slice(1).map(price => `<td>${price}</td>`).join('') + `</tr>`;
        projTableBody.innerHTML = projHtml;
        
        // Aktualizacja wykresu
        priceSeries.setData(priceChartData);
        projectionChart.timeScale().fitContent();
    }
    // === KONIEC ZMIAN ===
    
     // === POCZĄTEK ZMIAN: Wersja DIAGNOSTYCZNA funkcji loadChartData ===
    async function loadChartData(ticker) {
        if (!ticker) return;
        ticker = ticker.toUpperCase();
        console.log(`--- Rozpoczynam ładowanie danych dla: ${ticker} ---`);

        try {
            const [stooqResponse, indicatorsResponse] = await Promise.all([
                fetch(`${API_URL}/api/data/${ticker}`),
                fetch(`${API_URL}/api/indicators/${ticker}`)
            ]);

            console.log("Odpowiedź ze Stooq (ceny):", { ok: stooqResponse.ok, status: stooqResponse.status });
            console.log("Odpowiedź ze wskaźnikami:", { ok: indicatorsResponse.ok, status: indicatorsResponse.status });

            if (!stooqResponse.ok) {
                throw new Error(`Błąd pobierania danych Stooq dla ${ticker}: ${stooqResponse.statusText}`);
            }

            const stooqData = await stooqResponse.json();
            const candlestickData = stooqData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
            const volumeData = stooqData.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)' }));
            
            candlestickSeries.setData(candlestickData);
            volumeSeries.setData(volumeData);
            mainChart.timeScale().fitContent();
            document.getElementById('chart-title').textContent = `Wykres Świecowy - ${ticker}`;

            if (indicatorsResponse.ok && candlestickData.length > 0) {
                console.log("Odpowiedź ze wskaźnikami jest OK. Próbuję przetworzyć JSON.");
                
                // Zanim sparsujemy JSON, pobierzemy odpowiedź jako tekst, żeby zobaczyć, co serwer faktycznie zwrócił
                const rawText = await indicatorsResponse.text();
                console.log("Surowa odpowiedź tekstowa z serwera wskaźników:", rawText);

                // Teraz próbujemy parsować ten tekst jako JSON
                const indicatorsData = JSON.parse(rawText);
                console.log("Przetworzone dane wskaźników (JSON):", indicatorsData);

                if (!indicatorsData) {
                    throw new Error("Dane wskaźników po przetworzeniu są puste (null lub undefined).");
                }
                
                const lastPrice = candlestickData[candlestickData.length - 1].close;
                
                valuationCalculatorSection.style.display = '';
                console.log("Przekazuję dane do updateValuationData. Wszystko powinno być w porządku.");
                updateValuationData(ticker, lastPrice, indicatorsData);

            } else {
                console.warn(`Odpowiedź ze wskaźnikami NIE jest OK (status: ${indicatorsResponse.status}) lub brak danych cenowych. Ukrywam sekcję wyceny.`);
                valuationCalculatorSection.style.display = 'none';
            }

        } catch (error) {
            console.error(`!!! Krytyczny błąd w loadChartData dla ${ticker}:`, error);
            valuationCalculatorSection.style.display = 'none';
            alert(`Wystąpił krytyczny błąd podczas ładowania danych dla ${ticker}. Sprawdź konsolę (F12), aby uzyskać więcej informacji.`);
        }
    }
    // === KONIEC ZMIAN ===
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
        loadChartData('WIG');
    });
});
