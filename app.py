import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import requests
import logging
from datetime import datetime
import os

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

# app.py

@app.route('/api/data/<ticker>', methods=['GET'])
def get_stooq_data(ticker):
    """
    Endpoint do pobierania danych historycznych dla wykresu ze Stooq.pl.
    Pobiera dane w formacie CSV, przetwarza je i zwraca jako JSON.
    """
    logging.info(f"Odebrano zapytanie do /api/data/{ticker} ze Stooq.pl")
    if not ticker:
        return jsonify({"error": "Brak symbolu spółki"}), 400

    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        logging.info(f"Pobieranie danych z URL: {stooq_url}")
        
        # === POCZĄTEK ZMIANY ===
        # Dodajemy nagłówek User-Agent, aby symulować zapytanie z przeglądarki
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Używamy nagłówków w zapytaniu GET
        response = requests.get(stooq_url, headers=headers)
        # === KONIEC ZMIANY ===
        
        if response.status_code != 200 or "Nie ma takiego symbolu" in response.text:
            logging.error(f"Błąd: Nie udało się pobrać danych dla symbolu {ticker}. Sprawdź, czy symbol jest poprawny.")
            return jsonify({"error": f"Nie znaleziono danych dla symbolu: {ticker}"}), 404
        
        csv_data = io.StringIO(response.text)
        df = pd.read_csv(csv_data)
        
        if df.empty:
            logging.warning(f"Otrzymano pusty zbiór danych dla {ticker}")
            return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404

        df.rename(columns={
            'Data': 'time',
            'Otwarcie': 'open',
            'Najwyzszy': 'high',
            'Najnizszy': 'low',
            'Zamkniecie': 'close'
        }, inplace=True)

        df['time'] = pd.to_datetime(df['time']).apply(lambda x: int(x.timestamp()))
        df.sort_values('time', inplace=True)
        
        for col in ['open', 'high', 'low', 'close']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df.dropna(inplace=True)
        
        data_json = df[['time', 'open', 'high', 'low', 'close']].to_dict('records')
        logging.info(f"Pomyślnie przetworzono {len(data_json)} rekordów dla {ticker}")
        return jsonify(data_json)

    except Exception as e:
        logging.error(f"Błąd podczas pobierania lub przetwarzania danych dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wystąpił wewnętrzny błąd serwera."}), 500
@app.route('/api/search', methods=['GET'])
def search_stock():
    """
    Endpoint do wyszukiwania spółek.
    Stooq.pl nie oferuje prostego API do wyszukiwania, więc ten endpoint
    zostanie uproszczony i zwróci listę popularnych symboli.
    """
    query = request.args.get('query', '').upper()
    logging.info(f"Odebrano zapytanie do wyszukiwania: {query}")
    
    # Lista popularnych tickerów, którą będziemy filtrować
    popular_tickers = [
        "WIG20", "CDPROJEKT", "PKO", "PEKAO", "ORLEN", "KGHM",
        "ALLEGRO", "JSW", "SANPL", "CCC", "MBANK", "INGBSK"
    ]
    
    suggestions = [ticker for ticker in popular_tickers if query in ticker]
    
    return jsonify(suggestions)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
