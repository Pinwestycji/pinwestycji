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

# Zamiast prostego CORS(app), skonfiguruj go bardziej szczegółowo
# Pozwoli to na dostęp do API tylko z Twojej strony na GitHub Pages
CORS(app, resources={r"/api/*": {"origins": "https://pinwestycji.github.io"}})
# app.py
# Plik: app.py

@app.route('/api/data/<ticker>', methods=['GET'])
def get_stooq_data(ticker):
    """
    Endpoint do pobierania danych historycznych (wraz z wolumenem) dla wykresu ze Stooq.pl.
    """
    logging.info(f"Odebrano zapytanie do /api/data/{ticker} ze Stooq.pl")
    if not ticker:
        return jsonify({"error": "Brak symbolu spółki"}), 400

    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        logging.info(f"Pobieranie danych z URL: {stooq_url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(stooq_url, headers=headers)
        
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
            'Zamkniecie': 'close',
            'Wolumen': 'volume'  # <-- ZMIANA: Dodajemy mapowanie dla wolumenu
        }, inplace=True)

        df['time'] = pd.to_datetime(df['time']).apply(lambda x: int(x.timestamp()))
        df.sort_values('time', inplace=True)
        
        # <-- ZMIANA: Dodajemy 'volume' do listy kolumn numerycznych
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df.dropna(inplace=True)
        
        # <-- ZMIANA: Dołączamy 'volume' do finalnego JSONa
        data_json = df[['time', 'open', 'high', 'low', 'close', 'volume']].to_dict('records')
        
        logging.info(f"Pomyślnie przetworzono {len(data_json)} rekordów dla {ticker}")
        return jsonify(data_json)

    except Exception as e:
        logging.error(f"Błąd podczas pobierania lub przetwarzania danych dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wystąpił wewnętrzny błąd serwera."}), 500
        
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
