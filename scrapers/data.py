# Plik: scraper (kolejna kopia).py
# Wersja z dodaną funkcją przetwarzającą i zachowaną funkcją pobierającą surowe dane

import requests
import pandas as pd
import numpy as np
import logging
import time
import os
import re
from sqlalchemy import create_engine
from urllib.parse import quote_plus

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# =================================================================================
# CZĘŚĆ 1: Twoje funkcje do pobierania danych (bez zmian)
# =================================================================================

def get_wig_companies(url="https://www.bankier.pl/inwestowanie/profile/quote.html?symbol=WIG"):
    """
    Pobiera pełną tabelę ze składem indeksu WIG ze strony Bankier.pl.
    Zwraca pandas DataFrame z danymi lub None w przypadku błędu.
    """
    # ... Twoja funkcja bez zmian ...
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.bankier.pl/'
    }
    
    html_content = None
    try:
        logging.info(f"Pobieranie kodu HTML ze strony Bankier.pl: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        html_content = response.text
        
        logging.info("Parsowanie kodu HTML za pomocą pandas.read_html.")
        tables = pd.read_html(html_content, decimal=',', thousands='.', encoding='utf-8')
        
        df_companies = None
        for table in tables:
            # Sprawdzamy, czy tabela zawiera kolumnę "Nazwa"
            if 'Nazwa' in table.columns:
                df_companies = table
                break
        
        if df_companies is None:
            logging.error("Nie znaleziono tabeli ze składem WIG (brak kolumny 'Nazwa').")
            return None
        
        logging.info(f"Pomyślnie pobrano {len(df_companies)} spółek z indeksu WIG.")
        return df_companies

    except requests.exceptions.RequestException as e:
        logging.error(f"Wystąpił błąd podczas pobierania strony Bankier.pl: {e}")
        return None
    except Exception as e:
        logging.error(f"Wystąpił błąd podczas parsowania strony Bankier.pl: {e}")
        return None


def get_company_indicators(slug, source, col_name):
    """
    Pobiera dane o wskaźnikach finansowych dla konkretnej spółki ze strony StockWatch.pl.
    Zwraca pandas DataFrame z danymi lub None w przypadku błędu.
    """
    # ... Twoja funkcja bez zmian ... https://www.stockwatch.pl/gpw/pkobp,notowania,dane-finansowe.aspx#analiza
    url = f"https://www.stockwatch.pl/gpw/{slug}{source}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.stockwatch.pl/'
    }
    
    html_content = None
    try:
        logging.info(f"Pobieranie danych o wskaźnikach z: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        html_content = response.text
        
        tables = pd.read_html(html_content, header=0, decimal=',', thousands='.', encoding='utf-8')
        
        df_indicators = None
        for table in tables:
            cleaned_columns = [col.replace(' ', '').replace('>', '').strip() for col in table.columns]
            table.columns = cleaned_columns
            
            if col_name in table.columns:
                has_quarter_column = any(re.match(r'Q\d{1}\s*\d{4}', str(col)) for col in table.columns)
                if has_quarter_column:
                    df_indicators = table
                    break
        
        if df_indicators is None:
            logging.warning(f"Nie znaleziono tabeli z wskaźnikami dla spółki {slug}. Pomijam...")
            return None

        logging.info(f"Pomyślnie pobrano {len(df_indicators)} wskaźników.")
        return df_indicators

    except requests.exceptions.HTTPError as e:
        logging.warning(f"Wystąpił błąd HTTP podczas pobierania danych dla {slug}: {e}. Prawdopodobnie strona nie istnieje. Pomijam...")
        return None
    except Exception as e:
        logging.error(f"Wystąpił błąd podczas parsowania strony dla {slug}: {e}. Pomijam...")
        return None
        
import pandas as pd

def process_indicators_dataframe(df: pd.DataFrame, df_indicators: pd.DataFrame) -> pd.DataFrame:
    """
    Przekształca surowy DataFrame wskaźników z formatu szerokiego
    na format długi, łącząc dane o liczbie akcji i zysku netto
    z kwartałami w jednej kolumnie,  także wywołuje funkcję 'process_indicators_dataframe_add_price_column',
    która dodaje kurs akcji z danego kwartału.

    Args:
        df: Surowy DataFrame z danymi finansowymi.
				df_indicators: Surowy DataFrame z wskaźnikami.
    Returns:
        Przetworzony DataFrame z kolumnami 'Liczba akcji',
        'Zysk netto', 'Kwartał' oraz 'Kurs'.
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=['Liczba akcji', 'Zysk netto', 'Kwartał', 'Kurs'])

    try:
        # Ustawienie indeksu na kolumnę 'Dane/Okres'
        df.set_index('Dane/Okres', inplace=True)
        
        # --- Zaktualizowana logika ---
        # Usuwamy duplikaty wierszy na podstawie indeksu (nazwy wskaźnika),
        # pozostawiając tylko pierwszy napotkany wiersz dla każdego wskaźnika.
        df_unique = df[~df.index.duplicated(keep='first')]
        # df_unique = df.drop_duplicates(subset=['index'], keep='first') - to może być alternatywa
        # --- Koniec aktualizacji ---

        # Wybieramy tylko interesujące nas wiersze
        df_filtered = df_unique.loc[["Liczba akcji", "Zysk netto"]].copy()
        
        # Upewniamy się, że mamy dokładnie 2 wiersze do przetworzenia
        if len(df_filtered) != 2:
            logging.error("Nie znaleziono wierszy 'Liczba akcji' i 'Zysk netto'. Sprawdź nazwy.")
            return pd.DataFrame(columns=['Liczba akcji', 'Zysk netto', 'Kwartał', 'Kurs'])


        # Transponujemy DataFrame, aby kwartały stały się wierszami
        df_transposed = df_filtered.T
        

        # Zmieniamy nazwy kolumn na bardziej czytelne
        df_transposed.columns = ['Liczba akcji', 'Zysk netto']

        # Dodajemy kolumnę 'Kwartał', która jest indeksem po transpozycji
        df_transposed['Kwartał'] = df_transposed.index

        # Resetujemy indeks, aby "Kwartał" stał się regularną kolumną
        df_processed = df_transposed.reset_index(drop=True)

        # Dodajemy wywyołanie funkcji: 'process_indicators_dataframe_add_price_column' , która ma dodać właśnie kolumne Kurs z ramki danych df_indicators, oraz połączyć df_processed właśnie z kolumną Kurs w konćową ramkę danych
        df_processed_finsh = process_indicators_dataframe_add_price_column(df_processed, df_indicators)
				
        return df_processed_finsh

    except Exception as e:
        print(f"Błąd podczas przetwarzania ramki danych: {e}")
        return pd.DataFrame(columns=['Liczba akcji', 'Zysk netto', 'Kwartał', 'Kurs'])
        
def process_indicators_dataframe_add_price_column(df_one: pd.DataFrame, df_two: pd.DataFrame) -> pd.DataFrame:
    """
    Dodaje do przekształconych wcześniej danych wyłuskaną kolumnę z cenami akcji danej spółki, z danych: 'df_two',
    i łączy tę kolumnę z ramką danych 'df_one'.

    Args:
        df_one: Przetworzony DataFrame z danymi finansowymi ('Liczba Akcji', 'Zysk Netto', 'Kwartał').
        df_two: Surowy DataFrame z wskaźnikami, zawierający cenę akcji.
    Returns:
        Zwraca ostateczny DataFrame z kolumnami 'Kwartał', 'Liczba Akcji', 'Zysk Netto' i 'Kurs'.
    """
    if df_one.empty or df_two.empty:
        logging.warning("Jedna z ramek danych jest pusta. Zwracam pusty DataFrame.")
        return pd.DataFrame(columns=['Liczba Akcji', 'Zysk Netto', 'Kwartał', 'Kurs'])
    
    try:
        # Ustawienie indeksu na kolumnę 'Wskażnik/Okres' w df_two
        df_two.set_index('Wskażnik/Okres', inplace=True)
        
        # Usuwamy duplikaty wierszy na podstawie indeksu
        df_unique_two = df_two[~df_two.index.duplicated(keep='first')]
        
        # Wybieramy tylko wiersz "Kurs"
        # Używamy .loc[] z listą, aby zachować format DataFrame
        df_filtered_two = df_unique_two.loc[["Kurs"]].copy()
        
        # Transponujemy DataFrame, aby kwartały stały się wierszami
        df_transposed_two = df_filtered_two.T
        
           # --- NOWY KROK: Konwersja danych na typ liczbowy ---
        # Używamy .apply(pd.to_numeric, errors='coerce') do konwersji wszystkich kolumn
        # Argument 'errors='coerce'' zamieni wartości, których nie da się przekonwertować, na NaN.
        df_transposed_two = df_transposed_two.apply(pd.to_numeric, errors='coerce')
        
        # --- NOWY KROK: Zaokrąglanie wartości ---
        # Teraz możesz bezpiecznie zaokrąglić wartości do 2 miejsc po przecinku
        df_transposed_two = round(df_transposed_two, 2)
        
        # Zmieniamy nazwę kolumny na 'Kurs', jeśli jeszcze nie jest
        # Sprawdzamy, czy kolumna "Kurs" faktycznie istnieje w indeksie
        if 'Kurs' in df_transposed_two.columns:
            df_transposed_two.rename(columns={'Kurs': 'Kurs'}, inplace=True)
        else:
             logging.warning("Brak kolumny 'Kurs' w ramce danych ze wskaźnikami. Zwracam oryginalny DataFrame.")
             return df_one

        # Dodajemy kolumnę 'Kwartał' na podstawie indeksu
        df_transposed_two['Kwartał'] = df_transposed_two.index

        # Resetujemy indeks i łączymy z głównym DataFrame na podstawie kolumny 'Kwartał'
        # To jest kluczowy krok - łączenie danych!
        df_kurs = df_transposed_two.reset_index(drop=True)
        
        final_df = pd.merge(df_one, df_kurs, on='Kwartał', how='left')

        logging.info("Pomyślnie dodano kolumnę 'Kurs' do DataFrame.")
        return final_df

    except KeyError as e:
        logging.error(f"Klucz nie został znaleziony w ramce danych ze wskaźnikami: {e}. Sprawdź, czy 'Wskażnik/Okres' i 'Kurs' istnieją.")
        return pd.DataFrame(columns=['Liczba akcji', 'Zysk netto', 'Kwartał', 'Kurs'])
    except Exception as e:
        logging.error(f"Wystąpił nieoczekiwany błąd w funkcji: {e}")
        return pd.DataFrame(columns=['Liczba akcji', 'Zysk netto', 'Kwartał', 'Kurs'])
        
# =================================================================================
# CZĘŚĆ 3: Funkcje do obsługi bazy danych (bez zmian)
# =================================================================================
def create_database_engine():
    """Tworzy obiekt silnika bazy danych SQLAlchemy z użyciem zmiennych środowiskowych."""
    try:
        db_user = os.environ.get('DB_USER', 'admin') # dane fikcyjne musisz wprowadzić własne
        db_password = os.environ.get('DB_PASSWORD', '12345') # dane fikcyjne musisz wprowadzić własne
        db_host = os.environ.get('DB_HOST', 'localhost')
        db_port = os.environ.get('DB_PORT', '3306')
        db_name = os.environ.get('DB_NAME', 'gpw') # Najpierw stwórz taką bazę danych , albo zmień nazwę na taką jaką potrzebujesz 

        encoded_password = quote_plus(db_password)

        connection_url = f"mysql+mysqlconnector://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"

        logging.info(f"Próba połączenia z bazą danych pod adresem: {db_host}:{db_port}/{db_name}")

        engine = create_engine(connection_url, echo=False)
        return engine

    except Exception as e:
        logging.error(f"Błąd podczas tworzenia silnika bazy danych: {e}")
        return None

def save_dataframe_to_db(df, engine, table_name):
    """
    Zapisuje dane DataFrame do bazy danych MySQL.
    """
    if df is None or df.empty or not engine:
        logging.warning("DataFrame jest pusty lub silnik bazy danych nie jest dostępny. Anulowano zapisywanie.")
        return

    try:
        logging.info(f"Zapisywanie {len(df)} rekordów do tabeli '{table_name}'...")
        df.to_sql(name=table_name, con=engine, if_exists='replace', index=False)
        logging.info(f"Pomyślnie zapisano dane do bazy danych.")
        
    except Exception as e:
        logging.error(f"Wystąpił błąd podczas zapisywania danych do bazy danych: {e}")
        
# =================================================================================
# CZĘŚĆ 4: Główna logika skryptu (ZAKTUALIZOWANA)
# =================================================================================
if __name__ == "__main__":
    logging.info("="*80)
    logging.info("Rozpoczęto proces pobierania i przetwarzania wskaźników dla spółek WIG.")
    logging.info("="*80)
    
    companies_df = get_wig_companies()
    
    if companies_df is not None and not companies_df.empty:
        engine = create_database_engine()
        if engine:
            all_processed_dataframes = []  # Lista na przetworzone DataFrame'y
            successful_scrapes = 0
            failed_scrapes = 0
            
            for index, row in companies_df.iterrows():
                logging.info("-"*80)
                company_name = row['Nazwa']
                # Upewniamy się, że kolumna Ticker istnieje
                company_ticker = row.get('Ticker', row.get('Walor'))
                
                # Używamy kolumny 'Walor' lub 'Ticker' do stworzenia slug
                slug_base = row.get('Walor', row.get('Nazwa', company_name))
                company_slug = slug_base.lower().replace(' ', '').replace('.', '').replace('-', '')
                
                logging.info(f"Pobieranie surowych wskaźników dla: {company_name}")
                # Krok 1: Pobierz surowy DataFrame
                raw_data_of_finance_df = get_company_indicators(company_slug, ',notowania,dane-finansowe.aspx', 'Dane/Okres')
                raw_indicators_df = get_company_indicators(company_slug, ',notowania,wskazniki.aspx', 'Wskażnik/Okres')
                
                if raw_data_of_finance_df is not None and not raw_data_of_finance_df.empty and raw_indicators_df is not None and not raw_indicators_df.empty:
                    # Krok 2: Przetwórz DataFrame na format 'długi'
                    processed_df = process_indicators_dataframe(raw_data_of_finance_df, raw_indicators_df)
                    
                    if not processed_df.empty:
                        # Dodaj kolumny 'Spółka' i 'Ticker' do przetworzonego DataFrame
                        processed_df['Spółka'] = company_name
                        processed_df['Ticker'] = company_ticker
                        
                        all_processed_dataframes.append(processed_df)
                        successful_scrapes += 1
                        logging.info(f"Pomyślnie przetworzono dane dla: {company_name}")
                    else:
                        failed_scrapes += 1
                        logging.warning(f"Przetworzony DataFrame dla {company_name} jest pusty. Pomijam...")
                else:
                    failed_scrapes += 1
                    logging.warning(f"Surowy DataFrame dla {company_name} jest pusty. Pomijam...")
                
                time.sleep(2)
            
            logging.info("="*80)
            if all_processed_dataframes:
                logging.info("Łączenie wszystkich ramek danych w jeden finalny DataFrame...")
                # Krok 3: Stwórz jeden DataFrame z listy przetworzonych DataFrame'ów
                master_df = pd.concat(all_processed_dataframes, ignore_index=True)
                
                # Ustawienie ostatecznej kolejności kolumn
                column_order = ['Spółka', 'Ticker', 'Kwartał', 'Liczba akcji', 'Zysk netto', 'Kurs']
                master_df = master_df.reindex(columns=column_order)
                
                # Krok 4: Zapisz przetworzone dane do bazy
                save_dataframe_to_db(master_df, engine, 'wig_indicators_summary')
                
            else:
                logging.error("Nie udało się pobrać danych dla żadnej spółki.")
            
            logging.info("="*80)
            logging.info("PODSUMOWANIE:")
            logging.info(f"Pobrano i przetworzono dane dla {successful_scrapes} spółek.")
            logging.info(f"Pominięto {failed_scrapes} spółek.")
            logging.info("="*80)
            
    else:
        logging.error("Pobieranie listy spółek WIG nie powiodło się.")
    
    logging.info("Proces zakończony.")
