from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import pandas as pd
import io
import requests # Nowy import: biblioteka do wykonywania żądań HTTP

app = Flask(__name__)
CORS(app)

# Prosta trasa testowa
@app.route('/')
def home():
    return "Witaj na serwerze danych GPW! Spróbuj /api/data/CDPROJEKT"

# Trasa do pobierania danych dla konkretnej spółki ze Stooq.pl
@app.route('/api/data/<ticker>')
def get_stock_data(ticker):
    stooq_ticker = ticker.lower()

    # Oblicz daty dla okresu np. ostatnich 3 miesięcy (90 dni)
    # Ustaw datę końcową na wczoraj, aby uniknąć problemów z danymi bieżącego dnia, które mogą być jeszcze przetwarzane
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=90) # Ostatnie 90 dni

    # Format daty dla URL Stooq (YYYYMMDD)
    start_date_str = start_date.strftime('%Y%m%d')
    end_date_str = end_date.strftime('%Y%m%d')

    stooq_url = (
        f"https://stooq.pl/q/d/l/?s={stooq_ticker}&d1={start_date_str}&d2={end_date_str}&i=d"
    )

    print(f"DEBUG: Próba pobrania danych ze Stooq.pl dla symbolu: {stooq_ticker} z URL: {stooq_url}")

    try:
        # Używamy requests.get z niestandardowym nagłówkiem User-Agent
        # To sprawi, że zapytanie będzie wyglądało bardziej jak z przeglądarki
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(stooq_url, headers=headers)
        response.raise_for_status() # Sprawdza, czy kod statusu HTTP to 200 (OK). Jeśli nie, rzuca wyjątek.

        print(f"DEBUG: Stooq.pl HTTP Status Code: {response.status_code}")
        print(f"DEBUG: Stooq.pl Response Content (pierwsze 500 znaków):\n{response.text[:500]}")

        # Czytamy zawartość jako string do DataFrame pandas
        stock_data = pd.read_csv(io.StringIO(response.text))

        if stock_data.empty:
            print(f"DEBUG: DataFrame dla {stooq_ticker} ze Stooq.pl jest pusty po wczytaniu.")
            return jsonify({"error": f"Brak danych dla symbolu {ticker.upper()} ze Stooq.pl lub problem z pobieraniem (DataFrame pusty)."}), 404

        # Mapujemy nazwy kolumn ze Stooq.pl na format Lightweight Charts
        stock_data = stock_data.rename(columns={
            "Data": "time",
            "Otwarcie": "open",
            "Najwyzszy": "high",
            "Najnizszy": "low",
            "Zamkniecie": "close",
            "Wolumen": "volume"
        })

        # Konwertujemy kolumnę 'time' do formatu 'YYYY-MM-DD'
        stock_data['time'] = pd.to_datetime(stock_data['time']).dt.strftime('%Y-%m-%d')

        # Wybieramy tylko potrzebne kolumny i konwertujemy na listę słowników
        formatted_data = stock_data[['time', 'open', 'high', 'low', 'close']].to_dict(orient='records')

        print(f"DEBUG: Pobrane i sformatowane dane dla {stooq_ticker} (pierwsze 5): {formatted_data[:5]}")
        return jsonify(formatted_data)

    except requests.exceptions.RequestException as req_e:
        # Obsługa błędów związanych z zapytaniami HTTP (np. 404, 500, brak połączenia)
        print(f"DEBUG: Błąd zapytania HTTP (requests) dla {ticker} ze Stooq.pl: {str(req_e)}")
        return jsonify({"error": f"Błąd połączenia ze Stooq.pl dla {ticker}: {str(req_e)}"}), 500
    except Exception as e:
        # Ogólna obsługa innych błędów
        print(f"DEBUG: Ogólny wyjątek podczas pobierania lub przetwarzania danych dla {ticker} ze Stooq.pl: {str(e)}")
        return jsonify({"error": f"Wystąpił ogólny błąd podczas pobierania danych dla {ticker} ze Stooq.pl: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=False) # Zmienione na False
