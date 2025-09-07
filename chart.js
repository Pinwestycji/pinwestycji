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
    const projectionChart = LightweightCharts.createChart(projectionChartContainer, { width: projectionChartContainer.clientWidth, height: 300, layout: { backgroundColor: '#ffffff', textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, rightPriceScale: { borderColor: '#cccccc' }, timeScale: { borderColor: '#cccccc', timeVisible: true, secondsVisible: false } });
    
    // Tworzenie tylko jednej serii - dla prognozowanych cen
    const priceSeries = projectionChart.addSeries(LightweightCharts.LineSeries); // Używamy koloru niebieskiego
    priceSeries.applyOptions({color: '#007bff'});

    async function updateValuationData(ticker, lastPrice, indicators) {
        const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');
        const valuationTableBody = valuationCalculatorSection.querySelector('#valuationTableBody');
        
        // Funkcje pomocnicze
        const getValue = (key) => indicators[key] || 'Brak danych';
        const parseValue = (value) => parseFloat(String(value).replace(/,/g, ''));
        const calculateRate = (future, present) => {
            const parsedFuture = parseValue(future);
            const parsedPresent = parseValue(present);
            return (parsedFuture / parsedPresent - 1) * 100;
        };
        
        const aktualnyEps = parseValue(getValue('Aktualny EPS'));
        const sredniCZ = parseValue(getValue('Średni wskaźnik C/Z'));
        const tempoWzrostu = parseValue(getValue('Średnia stopa wzrostu EPS r/r')) / 100; // Konwersja na ułamek
        const prognozaCena = parseValue(getValue('Prognoza ceny akcji na następny rok'));
        
        const currentCZ = (lastPrice / aktualnyEps).toFixed(2);
        const returnRate = calculateRate(prognozaCena, lastPrice).toFixed(2);
        
        const valuationData = {
            'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
            'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
            'Aktualny EPS (zysk na akcję)': `${aktualnyEps.toFixed(2)} zł`,
            'Aktualny C/Z': currentCZ,
            'Średni C/Z': sredniCZ ? `${sredniCZ.toFixed(2)}` : 'Brak danych',
            'Tempo wzrostu': tempoWzrostu ? `${(tempoWzrostu * 100).toFixed(2)} %` : 'Brak danych',
            'Stopa zwrotu na marzec/kwiecień 2026 rok': returnRate + '%',
            'Wycena Akcji na marzec/kwiecień 2026 rok': prognozaCena ? `${prognozaCena.toFixed(2)} zł` : 'Brak danych',
            'Dobra Cena': 'Tak' // Tu na razie bez zmian
        };

        // Tworzenie tabeli wyceny
        let valuationHtml = '';
        for (const key in valuationData) {
            valuationHtml += `<tr><th>${key}</th><td>${valuationData[key]}</td></tr>`;
        }
        valuationTableBody.innerHTML = valuationHtml;
        
        // === POCZĄTEK MODYFIKACJI TABELI PROJEKCJI ===
        
        const projTableBody = valuationCalculatorSection.querySelector('#projectionTableBody');
        const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
        
        const pEpsData = ['<strong>Zysk na akcję</strong>'];
        const pPriceData = ['<strong>Cena Akcji</strong>'];
        
        // Dane dla wykresu - tylko dla cen
        const priceChartData = [];
        
        const currentYear = new Date().getFullYear();
        
        for (let i = 1; i <= 5; i++) {
            const year = currentYear + i;
            // Obliczenie EPS na dany rok
            const prognozaEps = aktualnyEps * Math.pow((1 + tempoWzrostu), i);
            pEpsData.push(`${prognozaEps.toFixed(2)} zł`);
            
            // Obliczenie Ceny Akcji na dany rok
            const prognozaPrice = prognozaEps * sredniCZ;
            pPriceData.push(prognozaPrice.toFixed(2));

            // Dodajemy do danych wykresu tylko cenę
            priceChartData.push({ time: year, value: prognozaPrice });
        }
        
        // Tworzenie tabeli projekcji
        let projHtml = `<tr><th>${pHeaderData[0]}</th>` + pHeaderData.slice(1).map(year => `<th>${year}</th>`).join('') + `</tr>`;
        projHtml += `<tr><td>${pEpsData[0]}</td>` + pEpsData.slice(1).map(eps => `<td>${eps}</td>`).join('') + `</tr>`;
        projHtml += `<tr><td>${pPriceData[0]}</td>` + pPriceData.slice(1).map(price => `<td>${price} zł</td>`).join('') + `</tr>`;
        projTableBody.innerHTML = projHtml;
        
        // Aktualizacja wykresu - tylko jedna seria
        projectionChart.timeScale().fitContent();
        priceSeries.setData(priceChartData);
    }
    
    // Pozostała część kodu bez zmian
    const searchDropdown = document.getElementById('search-results');
    const stockTickerInput = document.getElementById('stock-ticker-input');
    const searchButton = document.getElementById('search-button');
    const companyCard = document.getElementById('companyCard');
    const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');
    
    // Funkcja do renderowania sugestii (bez zmian)
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
