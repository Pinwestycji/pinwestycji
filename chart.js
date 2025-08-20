// Plik: chart.js - Wersja z poprawionym wyświetlaniem sugestii

document.addEventListener('DOMContentLoaded', function() {
    let companyList = []; 

    async function loadCompanyData() {
        try {
            const response = await fetch('wig_companies.csv');
            const csvText = await response.text();
            
            const rows = csvText.trim().split('\n').slice(1);
            companyList = rows.map(row => {
                const [nazwa, ticker] = row.split(',');
                if (nazwa && ticker) {
                    return { nazwa: nazwa.trim(), ticker: ticker.trim() };
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

    function updateValuationData(ticker, data) {
        const isIndex = indexTickers.includes(ticker.toUpperCase());
        if (isIndex || data.length === 0) {
            valuationCalculatorSection.style.display = 'none';
            return;
        }
        valuationCalculatorSection.style.display = 'flex';
        valuationTableBody.innerHTML = '';
        projectionTableBody.innerHTML = '';
        
        const lastPrice = data[data.length - 1].close;
        const valuationData = {
            'Symbol': `<strong>${ticker.toUpperCase()}</strong>`,
            'Aktualna Cena': `<strong>${lastPrice.toFixed(2)} zł</strong>`,
            'EPS (zysk na akcję)': '5.20 zł', 'Aktualny C/Z': (lastPrice / 5.20).toFixed(2),
            'Tempo wzrostu': '15%', 'Stopa zwrotu za 5 lat': '15%',
            'Potencjalny C/Z za 5 lat': '30.00', 'Wycena Akcji': '120.50 zł',
            'Dobra Cena': 'Tak'
        };
        for (const [key, value] of Object.entries(valuationData)) {
            let row = valuationTableBody.insertRow();
            let cell1 = row.insertCell(0); let cell2 = row.insertCell(1);
            cell1.innerHTML = key; cell2.innerHTML = value;
        }

        const pHeaderData = ['', '2026', '2027', '2028', '2029', '2030'];
        const pEpsData = ['<strong>Zysk na akcję</strong>', '5.98 zł', '6.88 zł', '7.91 zł', '9.10 zł', '10.46 zł'];
        const pPriceData = ['<strong>Cena Akcji</strong>', 179.40, 206.40, 237.30, 273.00, 313.80];
        
        let headerRow = projectionTableBody.insertRow();
        pHeaderData.forEach(text => headerRow.insertCell().innerHTML = `<strong>${text}</strong>`);
        let epsRow = projectionTableBody.insertRow();
        pEpsData.forEach(text => epsRow.insertCell().innerHTML = text);
        let priceRow = projectionTableBody.insertRow();
        pPriceData.forEach(text => priceRow.insertCell().innerHTML = typeof text === 'number' ? `${text.toFixed(2)} zł` : text);

        const projectionChartData = pPriceData.slice(1).map((price, index) => ({
            time: `${2026 + index}-01-01`, value: price,
        }));
        projectionSeries.setData(projectionChartData);
        projectionChart.timeScale().fitContent();
    }
    
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

    async function fetchStockData(ticker) { if (!ticker) return []; try { const response = await fetch(`${API_URL}/api/data/${ticker}`); if (!response.ok) { const errorData = await response.json(); throw new Error(`Błąd HTTP ${response.status}: ${errorData.error}`); } return await response.json(); } catch (error) { console.error("Błąd podczas pobierania danych giełdowych:", error); alert(`Wystąpił błąd: ${error.message}. Sprawdź symbol spółki lub spróbuj ponownie.`); return []; } }
    
    function findMatchingCompanies(query) {
        if (!query || query.length < 2) return [];
        const lowerCaseQuery = query.toLowerCase();
        return companyList.filter(company => {
            const searchString = `${company.nazwa}-${company.ticker}`.toLowerCase();
            return searchString.includes(lowerCaseQuery);
        });
    }

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
        let tickerToLoad = inputValue.toLowerCase();
        if (inputValue.includes('-')) {
            const parts = inputValue.split('-');
            tickerToLoad = parts[parts.length - 1].toLowerCase();
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
