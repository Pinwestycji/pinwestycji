from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta

import pandas as pd
import io
# Konfiguracja logowania, aby wiadomości DEBUG były widoczne na Renderze
logging.basicConfig(level=logging.DEBUG)
import logging
import requests # Nowy import: biblioteka do wykonywania żądań HTTP

app = Flask(__name__)
CORS(app)

# Prosta trasa testowa
@app.route('/')
def home():
    return "Witaj na serwerze danych GPW! Spróbuj /api/data/CDPROJEKT"

# Trasa do pobierania danych dla konkretnej spółki ze Stooq.pl
@app.route('/api/data/<ticker>')
@app.route('/api/data/<ticker>', defaults={'days_back': 20})
@app.route('/api/data/<ticker>/<int:days_back>')
def get_stock_data(ticker, days_back):
    logging.info(f"Odebrano żądanie dla symbolu: {ticker}, dni wstecz: {days_back}")
    stooq_url = f"https://stooq.pl/q/d/l/?s={ticker}&d1={days_back}"

    logging.debug(f"Próba pobrania danych ze Stooq.pl dla symbolu: {ticker} z URL: {stooq_url}")

    try:
        # Dodanie timeoutu do żądania requests.get()
        # Jeśli Stooq nie odpowie w ciągu 30 sekund, requests sam zgłosi błąd Timeout
        response = requests.get(stooq_url, timeout=30)

        logging.debug(f"Status odpowiedzi ze Stooq: {response.status_code}")

        if response.status_code == 200:
            # Sprawdzamy, czy odpowiedź nie jest pusta przed próbą parsowania
            if not response.text.strip():
                logging.warning(f"Otrzymano pustą odpowiedź ze Stooq dla {ticker}.")
                return jsonify([]), 200

            try:
                # Używamy io.StringIO do odczytu danych CSV z tekstu odpowiedzi
                df = pd.read_csv(io.StringIO(response.text))

                # Sprawdź, czy DataFrame nie jest pusty po parsowaniu
                if df.empty:
                    logging.warning(f"DataFrame jest pusty po parsowaniu danych ze Stooq dla {ticker}.")
                    return jsonify([]), 200

                # Standardyzacja nazw kolumn
                df.columns = df.columns.str.lower()
                df = df[['data', 'otwarcie', 'max', 'min', 'zamkniecie']]
                df.columns = ['time', 'open', 'high', 'low', 'close']

                # Formatowanie daty i konwersja na listę słowników
                df['time'] = pd.to_datetime(df['time']).dt.strftime('%Y-%m-%d')
                data = df.to_dict(orient='records')

                logging.info(f"Pomyślnie pobrano i przetworzono dane dla {ticker}. Liczba rekordów: {len(data)}")
                return jsonify(data)

            except pd.errors.EmptyDataError:
                logging.warning(f"Brak danych lub pusty plik CSV ze Stooq dla {ticker}. Treść odpowiedzi (pierwsze 500 znaków): {response.text[:500]}...")
                return jsonify([]), 200
            except Exception as e:
                logging.error(f"Błąd podczas parsowania danych ze Stooq dla {ticker}: {e}. Pełna odpowiedź (pierwsze 1000 znaków): {response.text[:1000]}...")
                return jsonify({"error": "Błąd przetwarzania danych ze Stooq"}), 500
        else:
            logging.error(f"Błąd odpowiedzi ze Stooq dla {ticker}. Status: {response.status_code}. Treść odpowiedzi (pierwsze 1000 znaków): {response.text[:1000]}...")
            return jsonify({"error": f"Błąd pobierania danych ze Stooq: Status {response.status_code}"}), 500

    except requests.exceptions.Timeout:
        logging.error(f"Zapytanie do Stooq dla {ticker} przekroczyło limit czasu (30s) na poziomie requests.")
        return jsonify({"error": "Przekroczono limit czasu podczas łączenia ze Stooq"}), 500
    except requests.exceptions.ConnectionError as e:
        logging.error(f"Błąd połączenia ze Stooq dla {ticker}: {e}")
        return jsonify({"error": "Błąd połączenia ze Stooq"}), 500
    except Exception as e:
        logging.error(f"Nieoczekiwany błąd w API dla {ticker}: {e}")
        return jsonify({"error": "Nieoczekiwany błąd serwera"}), 500

if __name__ == '__main__':
    app.run(debug=True)
