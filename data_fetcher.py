# Plik: data_fetcher.py

import pandas as pd
import requests
import io
import json
import os
from datetime import datetime

# === KONFIGURACJA ===
# Lista indeksów, które mają być pobierane statycznie
INDEX_TICKERS = ['WIG', 'WIG20', 'MWIG40', 'SWIG80', 'WIG-UKRAIN'] # Dodaj tutaj wszystkie potrzebne indeksy

# Lista tickerów musi być znana - musimy ją pobrać z Twojego wig_companies.csv
def get_all_tickers(csv_path='wig_companies.csv'):
    try:
        df_companies = pd.read_csv(csv_path)
        # Zakładamy, że kolumna 'Ticker' istnieje
        company_tickers = df_companies['Ticker'].str.upper().tolist()
        
        # === NOWA LOGIKA: Dodajemy tickery indeksów do listy ===
        all_tickers = company_tickers + INDEX_TICKERS
        
        # Usuń potencjalne duplikaty i zachowaj porządek (opcjonalnie, ale czysto)
        return sorted(list(set(all_tickers)))

    except Exception as e:
        print(f"Błąd podczas wczytywania listy tickerów: {e}")
        # W przypadku błędu, zwróć tylko listę indeksów, aby przynajmniej strona główna działała
        return INDEX_TICKERS 

# ... (reszta pliku: DATA_DIR, fetch_and_save_stooq_data, main)

# Folder docelowy dla statycznych danych
DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)


# Funkcja pobierająca (przeniesiona i zmodyfikowana z app.py)
def fetch_and_save_stooq_data(ticker):
    print(f"Pobieranie danych dla: {ticker}...")
    try:
        stooq_url = f"https://stooq.pl/q/d/l/?s={ticker.lower()}&i=d"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(stooq_url, headers=headers)
        
        if response.status_code != 200 or "Nie ma takiego symbolu" in response.text:
            print(f"Ostrzeżenie: Nie znaleziono danych dla symbolu: {ticker}")
            return False

        csv_data = io.StringIO(response.text)
        df = pd.read_csv(csv_data)
        
        if df.empty:
            print(f"Ostrzeżenie: Brak danych dla symbolu: {ticker}")
            return False

        # Przetwarzanie danych
        df.rename(columns={'Data': 'time', 'Otwarcie': 'open', 'Najwyzszy': 'high','Najnizszy': 'low', 'Zamkniecie': 'close', 'Wolumen': 'volume'}, inplace=True)
        # Konwersja czasu na timestampy - kluczowe dla Lightweight Charts!
        df['time'] = pd.to_datetime(df['time']).apply(lambda x: int(x.timestamp()))
        df.sort_values('time', inplace=True)
        
        # Konwersja i usuwanie NaN
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df.dropna(subset=['open', 'high', 'low', 'close'], inplace=True)
        
        # Zapis do pliku JSON
        data_json = df.to_dict('records')
        file_path = os.path.join(DATA_DIR, f'{ticker.upper()}.json')
        
        with open(file_path, 'w') as f:
            json.dump(data_json, f)
            
        print(f"Zapisano dane dla {ticker} do {file_path}")
        return True

    except Exception as e:
        print(f"Błąd w fetch_and_save_stooq_data dla {ticker}: {e}")
        return False

# Główna funkcja wykonawcza
def main():
    print(f"Rozpoczęcie pobierania danych o: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Pobieramy listę tickerów
    tickers = get_all_tickers()
    if not tickers:
        print("Nie znaleziono tickerów do przetworzenia. Zakończenie.")
        return

    # 2. Iterujemy i pobieramy dane
    for ticker in tickers:
        fetch_and_save_stooq_data(ticker)
        
    print("Zakończono pobieranie danych.")


if __name__ == "__main__":
    main()
