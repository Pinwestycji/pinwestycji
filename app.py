# Plik: app.py - Wersja z nowym endpointem do wskaźników

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import requests
import logging
import numpy as np # Będziemy potrzebować numpy do obsługi danych
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# === POCZĄTEK NOWEJ SEKCJI: Wczytywanie i cachowanie danych wskaźnikowych ===
# Wczytujemy plik CSV tylko raz przy starcie aplikacji, co jest znacznie wydajniejsze
try:
    indicators_df = pd.read_csv('wig_indicators.csv')
    logging.info("Plik wig_indicators.csv załadowany pomyślnie.")
except FileNotFoundError:
    indicators_df = None
    logging.error("Błąd: Nie znaleziono pliku wig_indicators.csv!")
# === KONIEC NOWEJ SEKCJI ===


# Endpoint do danych historycznych (bez zmian)
@app.route('/api/data/<ticker>', methods=['GET'])
def get_stooq_data(ticker):
    # ... ta funkcja pozostaje bez zmian ...
    logging.info(f"Odebrano zapytanie do /api/data/{ticker} ze Stooq.pl")
    if not ticker:
        return jsonify({"error": "Brak symbolu spółki"}), 400
    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        headers = {
            'User-Agent': 'Mozilla/5.0'
        }
        response = requests.get(stooq_url, headers=headers)
        if response.status_code != 200 or "Nie ma takiego symbolu" in response.text:
            return jsonify({"error": f"Nie znaleziono danych dla symbolu: {ticker}"}), 404
        csv_data = io.StringIO(response.text)
        df = pd.read_csv(csv_data)
        if df.empty:
            return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404
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


# === POCZĄTEK NOWEJ SEKCJI: Endpoint do obliczania wskaźników ===
@app.route('/api/indicators/<ticker>', methods=['GET'])
def get_company_indicators(ticker):
    if indicators_df is None:
        return jsonify({"error": "Dane wskaźnikowe są niedostępne na serwerze."}), 500

    try:
        # 1. Filtruj dane dla konkretnej spółki
        company_df = indicators_df[indicators_df['Ticker'] == ticker.upper()].copy()
        if company_df.empty:
            return jsonify({"error": f"Nie znaleziono wskaźników dla spółki: {ticker}"}), 404

        # Słownik na wyniki
        results = {}

        # 2. Przetwarzaj wskaźniki: EPS i C/Z
        for indicator_name in ["EPS(akcjonariuszy większościowych)", "C/Z"]:
            # Filtruj wiersz dla danego wskaźnika
            indicator_row = company_df[company_df['Wskaźnik/Okres'] == indicator_name]
            
            if not indicator_row.empty:
                # Wybierz tylko kolumny z danymi (zazwyczaj od 3 kolumny)
                values_only = indicator_row.iloc[:, 2:].replace('null', np.nan).astype(float)
                
                # Usuń kolumny, które są całkowicie puste (NaN)
                values_only.dropna(axis=1, how='all', inplace=True)
                
                # Oblicz średnią, ignorując puste wartości
                avg_value = values_only.mean(axis=1).iloc[0]
                
                # Znajdź ostatnią (najnowszą) niepustą wartość
                latest_value = values_only.iloc[0].dropna().iloc[-1] if not values_only.iloc[0].dropna().empty else None

                # Zapisz wyniki
                if indicator_name == "EPS(akcjonariuszy większościowych)":
                    results['avg_eps'] = round(avg_value, 2) if pd.notna(avg_value) else None
                    results['latest_eps'] = round(latest_value, 2) if pd.notna(latest_value) else None
                elif indicator_name == "C/Z":
                    results['avg_cz'] = round(avg_value, 2) if pd.notna(avg_value) else None
                    results['latest_cz'] = round(latest_value, 2) if pd.notna(latest_value) else None
        
        return jsonify(results)

    except Exception as e:
        logging.error(f"Błąd w get_company_indicators dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wewnętrzny błąd serwera podczas przetwarzania wskaźników."}), 500
# === KONIEC NOWEJ SEKCJI ===


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
