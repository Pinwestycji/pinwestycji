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
    const priceSeries = projectionChart.addSeries(LightweightCharts.LineSeries);
    projectionSeries.applyOptions({
        color: '#007bff'
    });

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
    
    async function loadChartData(ticker) {
        if (!ticker) return;
        ticker = ticker.toUpperCase();

        try {
            // Równoległe pobieranie danych
            const [stooqResponse, indicatorsResponse] = await Promise.all([
                fetch(`${API_URL}/api/data/${ticker}`),
                fetch(`${API_URL}/api/indicators/${ticker}`)
            ]);

            if (!stooqResponse.ok) throw new Error(`Błąd pobierania danych Stooq dla ${ticker}: ${stooqResponse.statusText}`);
            if (!indicatorsResponse.ok) throw new Error(`Błąd pobierania wskaźników dla ${ticker}: ${indicatorsResponse.statusText}`);

            const stooqData = await stooqResponse.json();
            const indicatorsData = await indicatorsResponse.json();

            // Aktualizacja wykresu świecowego
            const candlestickData = stooqData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
            const volumeData = stooqData.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)' }));
            
            candlestickSeries.setData(candlestickData);
            volumeSeries.setData(volumeData);
            mainChart.timeScale().fitContent();
            
            document.getElementById('chart-title').textContent = `Wykres Świecowy - ${ticker}`;

            // Aktualizacja sekcji wyceny i projekcji
            if (candlestickData.length > 0) {
                const lastPrice = candlestickData[candlestickData.length - 1].close;
                updateValuationData(ticker, lastPrice, indicatorsData);
            }

        } catch (error) {
            console.error(`Błąd w loadChartData dla ${ticker}:`, error);
            alert(`Nie udało się załadować danych dla ${ticker}. Sprawdź konsolę, aby uzyskać więcej informacji.`);
        }
    }
    
    const searchDropdown = document.getElementById('searchDropdown');
    const stockTickerInput = document.getElementById('stockTickerInput');
    const searchButton = document.getElementById('searchButton');
    
    function findMatchingCompanies(query) {
        if (!query) return [];
        return companyList.filter(company => 
            company.nazwa.toLowerCase().includes(query.toLowerCase()) || 
            company.ticker.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    function renderAutocomplete(suggestions) {
        searchDropdown.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.slice(0, 10).forEach(company => {
                const item = document.createElement('a');
                item.href = "#";
                item.textContent = `${company.nazwa} (${company.ticker})`;
                item.className = "dropdown-item";
                item.addEventListener('click', (event) => {
                    event.preventDefault();
                    stockTickerInput.value = company.ticker;
                    loadChartData(company.ticker);
                    searchDropdown.style.display = 'none';
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
        const tickerToLoad = stockTickerInput.value.trim().toUpperCase();
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
        loadChartData('CDR'); // Ładujemy domyślną spółkę po załadowaniu listy
    });
});
