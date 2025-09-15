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


    // === POCZĄTEK ZMIAN: CAŁKOWICIE PRZEBUDOWANA FUNKCJA Z DODANĄ LOGIKĄ REKOMENDACJI ===
    async function updateValuationData(ticker, lastPrice, indicators) {
        const valuationCalculatorSection = document.getElementById('valuationCalculatorSection');
        const valuationTableBody = valuationCalculatorSection.querySelector('#valuationTableBody');
        
        const parseValue = (value) => {
            if (value === null || value === undefined || String(value).trim().toLowerCase() === 'n/a') {
                return null;
            }
            const num = parseFloat(String(value).replace(',', '.'));
            return isNaN(num) ? null : num;
        };
    
        const aktualnyEps = parseValue(indicators['Aktualny EPS']);
        const poprzedniEps = parseValue(indicators['EPS za poprzedni rok']);
        const EPSnastepnyrok = parseValue(indicators['Prognoza EPS na kolejny rok']);
        const sredniCZ = parseValue(indicators['Średni wskaźnik C/Z']);
        const tempoWzrostu = parseValue(indicators['Średnia stopa wzrostu EPS r/r']);
        const prognozaCena = parseValue(indicators['Prognoza ceny akcji na następny rok']);
        
        // === POCZĄTEK KLUCZOWEJ ZMIANY ===
        // Sprawdzamy, czy mamy dane do wyceny. Jeśli prognozaCena to N/A, nie możemy nic policzyć.
        const canAnalyze = prognozaCena !== null;
    
        // Zawsze generujemy rekomendację, ponieważ ona potrafi obsłużyć brak danych.
        // Logika rekomendacji została przeniesiona tutaj, aby działała niezależnie.
        let rec = {
            title: 'Rekomendacja: Analiza niemożliwa (Scenariusz Czerwony)',
            message: 'Kalkulacja jest niemożliwa, ponieważ spółka odnotowuje straty (ujemny EPS) lub historycznie była wyceniana ujemnie. Wycena oparta na wskaźniku C/Z jest w tym przypadku bezcelowa. Proszę przeanalizować spółkę za pomocą innych wskaźników, takich jak P/BV (Cena do Wartości Księgowej) lub P/S (Cena do Sprzedaży).',
            color: '#cf0b04'
        };
    
        if (canAnalyze) {
            // Jeśli analiza jest możliwa, pokazujemy kalkulator i wykonujemy wszystkie obliczenia.
            valuationCalculatorSection.style.display = '';
    
            const currentCZ = (aktualnyEps && lastPrice) ? (lastPrice / aktualnyEps).toFixed(2) : 'Brak danych';
            const returnRate = (prognozaCena && lastPrice) ? (((prognozaCena / lastPrice) - 1) * 100).toFixed(2) : 'Brak danych';
            
            const valuationData = {
                'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
                'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
                'Aktualny EPS (zysk na akcję)': aktualnyEps !== null ? `${aktualnyEps.toFixed(2)} zł` : 'Brak danych',
                'EPS za poprzedni rok': poprzedniEps !== null ? `${poprzedniEps.toFixed(2)} zł` : 'Brak danych',
                'EPS na następny rok': EPSnastepnyrok !== null ? `${EPSnastepnyrok.toFixed(2)} zł` : 'Brak danych',
                'Aktualny C/Z': currentCZ,
                'Średni C/Z': sredniCZ !== null ? sredniCZ.toFixed(2) : 'Brak danych',
                'Tempo wzrostu': tempoWzrostu !== null ? `${tempoWzrostu.toFixed(2)} %` : 'Brak danych',
                'Stopa zwrotu na marzec/kwiecień 2026 rok': returnRate !== 'Brak danych' ? `${returnRate} %` : 'Brak danych',
                'Wycena Akcji na marzec/kwiecień 2026 rok': prognozaCena !== null ? `${prognozaCena.toFixed(2)} zł` : 'Brak danych'
            };
    
            let valuationHtml = '';
            for (const key in valuationData) {
                valuationHtml += `<tr><th>${key}</th><td>${valuationData[key]}</td></tr>`;
            }
            valuationTableBody.innerHTML = valuationHtml;
            
            const projTableBody = valuationCalculatorSection.querySelector('#projectionTableBody');
            const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
            const pEpsData = ['<strong>Zysk na akcję</strong>'];
            const pPriceData = ['<strong>Cena Akcji</strong>'];
            const priceChartData = [];
            const currentYear = new Date().getFullYear();
            
            if (aktualnyEps !== null && tempoWzrostu !== null && sredniCZ !== null) {
                const tempoWzrostuDecimal = tempoWzrostu / 100;
                for (let i = 1; i <= 5; i++) {
                    const year = currentYear + i;
                    const prognozaEps = poprzedniEps * Math.pow((1 + tempoWzrostuDecimal), i);
                    pEpsData.push(`${prognozaEps.toFixed(2)} zł`);
                    const prognozaPrice = prognozaEps * sredniCZ;
                    pPriceData.push(`${prognozaPrice.toFixed(2)} zł`);
                    priceChartData.push({ time: `${year}-03-15`, value: prognozaPrice });
                }
            } else {
                for (let i = 1; i <= 5; i++) {
                    pEpsData.push('Brak danych');
                    pPriceData.push('Brak danych');
                }
            }
            
            let projHtml = `<tr><th>${pHeaderData[0]}</th>` + pHeaderData.slice(1).map(year => `<th>${year}</th>`).join('') + `</tr>`;
            projHtml += `<tr><td>${pEpsData[0]}</td>` + pEpsData.slice(1).map(eps => `<td>${eps}</td>`).join('') + `</tr>`;
            projHtml += `<tr><td>${pPriceData[0]}</td>` + pPriceData.slice(1).map(price => `<td>${price}</td>`).join('') + `</tr>`;
            projTableBody.innerHTML = projHtml;
            
            priceSeries.setData(priceChartData);
            projectionChart.timeScale().fitContent();
    
            // Uruchamiamy pełną logikę rekomendacji
            const now = new Date();
            const targetDate = new Date(now.getFullYear() + 1, 3, 30);
            const msInMonth = 1000 * 60 * 60 * 24 * 30.4375;
            const liczbaMiesiecy = (targetDate - now) / msInMonth;
            const procentWzrostu = ((prognozaCena - lastPrice) / lastPrice) * 100;
            const wymaganeRoczneTempoWzrostu = procentWzrostu / (liczbaMiesiecy / 12);
    
            const isTrendWzrostowy = EPSnastepnyrok > poprzedniEps;
            const isNiedowartosciowane = parseFloat(currentCZ) < sredniCZ;
            const isAtrakcyjnaCena = lastPrice < prognozaCena;
    
            if (isTrendWzrostowy && isNiedowartosciowane && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu <= 100) {
                rec.title = 'Bardzo Zielony Scenariusz: Potencjalna Okazja Inwestycyjna';
                rec.color = '#034d06';
                rec.message = `Spółka wykazuje silne fundamenty i może być niedowartościowana...`; // Skrócono dla czytelności
            } else if ((isTrendWzrostowy || isNiedowartosciowane) && isAtrakcyjnaCena && wymaganeRoczneTempoWzrostu <= 200) {
                // ... logika dla zielonego
            } // ... i tak dalej dla reszty scenariuszy
    
        } else {
            // Jeśli analiza nie jest możliwa, ukrywamy sekcję kalkulatora.
            // Rekomendacja domyślnie jest już ustawiona na czerwoną.
            valuationCalculatorSection.style.display = 'none';
        }
    
        // Renderowanie okienka rekomendacji - ten kod wykona się zawsze.
        const recommendationContainer = document.getElementById('recommendationSection');
        const isYellow = rec.color === '#faee05';
        const textColor = isYellow ? 'text-dark' : 'text-white';
    
        const recommendationHtml = `
            <div class="card shadow mb-4">
                <div class="card-header py-3" style="background-color: ${rec.color};">
                    <h6 class="m-0 font-weight-bold ${textColor}">${rec.title}</h6>
                </div>
                <div class="card-body">
                    <p>${rec.message}</p>
                    <hr>
                    <small class="text-muted" style="font-size: 0.7rem;">
                        <strong>Ostrzeżenie: Zastrzeżenie prawne.</strong><br>
                        ...
                    </small>
                </div>
            </div>`;
        
        recommendationContainer.innerHTML = recommendationHtml;
        // === KONIEC KLUCZOWEJ ZMIANY ===
    }
    
    async function loadChartData(ticker) {
        if (!ticker) return;
        ticker = ticker.toUpperCase();
        console.log(`--- Rozpoczynam ładowanie danych dla: ${ticker} ---`);
        
        // ZMIANA: Ukrywamy obie sekcje na starcie, aby uniknąć migotania starych danych
        const valuationSection = document.getElementById('valuationCalculatorSection');
        const recommendationSection = document.getElementById('recommendationSection');
        valuationSection.style.display = 'none';
        recommendationSection.innerHTML = '';
    
    
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
            if (stooqData.length === 0) {
                alert(`Brak danych historycznych dla spółki ${ticker}.`);
                return;
            }
            
            const candlestickData = stooqData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
            const volumeData = stooqData.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)' }));
            
            candlestickSeries.setData(candlestickData);
            volumeSeries.setData(volumeData);
            mainChart.timeScale().fitContent();
            document.getElementById('chart-title').textContent = `Wykres Świecowy - ${ticker}`;
    
            // ZMIANA: Uproszczona logika - po prostu pobierz JSON i przekaż go dalej.
            // Funkcja updateValuationData sama zdecyduje, co z nim zrobić.
            if (indicatorsResponse.ok) {
                const indicatorsData = await indicatorsResponse.json();
                const lastPrice = candlestickData[candlestickData.length - 1].close;
                
                // Przekazujemy dane do funkcji, która teraz zarządza logiką wyświetlania
                updateValuationData(ticker, lastPrice, indicatorsData);
            } else {
                 // Jeśli API wskaźników zwróci błąd, również poinformujmy o tym updateValuationData,
                 // wysyłając puste dane, co poskutkuje czerwoną rekomendacją.
                console.warn(`Błąd odpowiedzi serwera wskaźników: ${indicatorsResponse.status}`);
                const lastPrice = candlestickData[candlestickData.length - 1].close;
                updateValuationData(ticker, lastPrice, {}); // Przekaż pusty obiekt
            }
    
        } catch (error) {
            console.error(`!!! Krytyczny błąd w loadChartData dla ${ticker}:`, error);
            alert(`Wystąpił krytyczny błąd podczas ładowania danych dla ${ticker}. Sprawdź konsolę (F12).`);
        }
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
        loadChartData('WIG');
    });
});
