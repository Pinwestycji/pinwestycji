# Plik: app.py - Wersja z dodanym endpointem diagnostycznym /api/status

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import requests
import logging
import numpy as np
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# === POCZĄTEK ZMIAN: Wczytujemy OBA pliki CSV przy starcie ===

indicators_df = None
ticker_to_name_map = {}

try:
    # Wczytaj dane wskaźnikowe
    indicators_df = pd.read_csv('wig_indicators.csv')
    logging.info("Plik wig_indicators.csv załadowany pomyślnie.")
    
    # Poprawiona, standardowa wersja
    companies_df = pd.read_csv('wig_companies.csv')
    
    # Usuń cudzysłowy i białe znaki, tak jak w JS
    companies_df['Nazwa'] = companies_df['Nazwa'].str.replace('"', '').str.strip()
    companies_df['Ticker'] = companies_df['Ticker'].str.replace('"', '').str.strip()
    
    # Stwórz słownik/mapę: klucz to Ticker, wartość to Nazwa
    ticker_to_name_map = pd.Series(companies_df.Nazwa.values, index=companies_df.Ticker).to_dict()
    logging.info(f"Stworzono mapowanie dla {len(ticker_to_name_map)} spółek (Ticker -> Nazwa).")

except FileNotFoundError as e:
    logging.error(f"Krytyczny błąd: Nie znaleziono pliku CSV! {e.filename}")
except Exception as e:
    logging.error(f"Wystąpił nieoczekiwany błąd podczas wczytywania plików CSV: {e}")

# === KONIEC ZMIAN ===


@app.route('/api/data/<ticker>', methods=['GET'])
def get_stooq_data(ticker):
    # Ta funkcja pozostaje bez zmian
    # ...
    logging.info(f"Odebrano zapytanie do /api/data/{ticker} ze Stooq.pl")
    if not ticker: return jsonify({"error": "Brak symbolu spółki"}), 400
    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
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

@app.route('/api/indicators/<ticker>', methods=['GET'])
def get_company_indicators(ticker):
    # Ta funkcja pozostaje na razie bez zmian
    # ...
    if indicators_df is None:
        return jsonify({"error": "Dane wskaźnikowe są niedostępne na serwerze."}), 500
    try:
        company_name = ticker_to_name_map.get(ticker.upper())
        if not company_name:
            return jsonify({"error": f"Nie znaleziono nazwy dla tickera: {ticker}"}), 404
        company_df = indicators_df[indicators_df['Spółka'] == company_name].copy()
        if company_df.empty:
            return jsonify({"error": f"Nie znaleziono wskaźników dla spółki: {company_name}"}), 404
        results = {}
        for indicator_name in ["EPS(akcjonariuszy większościowych)", "C/Z"]:
            indicator_row = company_df[company_df['Wskaźnik/Okres'] == indicator_name]
            if not indicator_row.empty:
                values_only = indicator_row.iloc[:, 2:].replace('null', np.nan).astype(float)
                values_only.dropna(axis=1, how='all', inplace=True)
                avg_value = values_only.mean(axis=1).iloc[0]
                latest_value = values_only.iloc[0].dropna().iloc[-1] if not values_only.iloc[0].dropna().empty else None
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


# === POCZĄTEK NOWEJ SEKCJI: ENDPOINT DIAGNOSTYCZNY ===
@app.route('/api/status', methods=['GET'])
def status_check():
    """
    Zwraca status wczytania plików CSV i mapowania tickerów.
    """
    status = {
        "indicators_df_loaded": indicators_df is not None,
        "indicators_df_rows": len(indicators_df) if indicators_df is not None else 0,
        "map_created": bool(ticker_to_name_map),
        "mapped_tickers": len(ticker_to_name_map)
    }
    return jsonify(status)
# === KONIEC NOWEJ SEKCJI ===


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
