# Plik: app.py - Wersja serwująca przetworzone dane z pliku CSV

import pandas as pd
from flask import Flask, jsonify
from flask_cors import CORS
import logging
import numpy as np
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# === POCZĄTEK ZMIAN: Wczytujemy plik wig_company_forecasts.csv ===

indicators_summary_df = None
try:
    # Wczytujemy plik wig_company_forecasts.csv
    indicators_summary_df = pd.read_csv('wig_company_forecasts.csv')
    # Ustawiamy 'Ticker' jako indeks dla szybkiego wyszukiwania
    indicators_summary_df.set_index('Ticker', inplace=True)
    logging.info("Plik wig_company_forecasts.csv załadowany pomyślnie.")
except FileNotFoundError:
    logging.error("Krytyczny błąd: Nie znaleziono pliku wig_company_forecasts.csv!")
except Exception as e:
    logging.error(f"Wystąpił nieoczekiwany błąd podczas wczytywania pliku CSV: {e}")

# === KONIEC ZMIAN ===


@app.route('/api/data/<ticker>', methods=['GET'])
def get_stooq_data(ticker):
    # Ta funkcja pozostaje bez zmian
    # ...
    logging.info(f"Odebrano zapytanie do /api/data/{ticker} ze Stooq.pl")
    if not ticker: return jsonify({"error": "Brak symbolu spółki"}), 400
    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(stooq_url, headers=headers)
        if response.status_code != 200 or "Nie ma takiego symbolu" in response.text:
            return jsonify({"error": f"Nie znaleziono danych dla symbolu: {ticker}"}), 404
        csv_data = io.StringIO(response.text)
        df = pd.read_csv(csv_data)
        if df.empty: return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404
        df.rename(columns={'Data': 'time', 'Otwarcie': 'open', 'Najwyzszy': 'high','Najnizszy': 'low', 'Zamkniecie': 'close', 'Wolumen': 'volume'}, inplace=True)
        df['time'] = pd.to_datetime(df['time']).apply(lambda x: int(x.timestamp()))
        df.sort_values('time', inplace=True)
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df.dropna(subset=['open', 'high', 'low', 'close'], inplace=True)
        data_json = df.to_dict('records')
        return jsonify(data_json)
    except Exception as e:
        logging.error(f"Błąd w get_stooq_data dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wewnętrzny błąd serwera."}), 500



# === POCZĄTEK ZMIAN: Funkcja jest już zgodna z nowym plikiem CSV ===
@app.route('/api/indicators/<ticker>', methods=['GET'])
def get_company_indicators(ticker):
    if indicators_summary_df is None:
        return jsonify({"error": "Dane wskaźnikowe są niedostępne na serwerze."}), 503

    try:
        # Wyszukujemy dane dla danego tickera w naszym DataFrame
        # .loc[] jest bardzo szybkie, gdy szukamy po indeksie
        indicator_data = indicators_summary_df.loc[ticker.upper()]
        
        # Konwertujemy wynik do słownika i zwracamy jako JSON
        # Ta część kodu jest uniwersalna i będzie działać poprawnie z nowymi kolumnami
        result = indicator_data.to_dict()
        return jsonify(result)
        
    except KeyError:
        # Ten błąd wystąpi, jeśli ticker nie zostanie znaleziony w indeksie DataFrame
        return jsonify({"error": f"Nie znaleziono wskaźników dla spółki: {ticker}"}), 404
    except Exception as e:
        logging.error(f"Błąd w get_company_indicators dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wewnętrzny błąd serwera podczas przetwarzania wskaźników."}), 500
# === KONIEC ZMIAN ===

if __name__ == '__main__':
    # Aby uruchomić lokalnie:
    # app.run(debug=True, port=5001)

    # Aby uruchomić na serwerze Render:
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port)
