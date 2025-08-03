import requests
import pandas as pd
from bs4 import BeautifulSoup
import logging
import re
import time
from urllib.parse import quote_plus
import os # Dodaj import os do zmiennych środowiskowych
from sqlalchemy import create_engine # Dodaj import do bazy danych

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_wig_companies(url="https://www.stockwatch.pl/gpw/indeks/wig,sklad.aspx"):
    # ... (Twój istniejący kod funkcji get_wig_companies) ...
    """
    Pobiera listę pełnych nazw spółek wchodzących w skład indeksu WIG
    ze strony StockWatch.pl.

    Args:
        url (str): Adres URL strony do pobrania składu indeksu WIG.
                   Domyślnie ustawiony na StockWatch.pl.

    Returns:
        list: Lista stringów z nazwami spółek lub pusta lista w przypadku błędu.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    max_retries = 5
    base_delay = 2
    html_content = None

    for attempt in range(max_retries):
        try:
            logging.info(f"Pobieranie kodu HTML z: {url} (Próba {attempt + 1}/{max_retries})")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status() # Sprawdza, czy zapytanie zakończyło się sukcesem (kody 2xx)
            html_content = response.text
            break # Jeśli pobrano pomyślnie, wyjdź z pętli ponawiania
        except requests.exceptions.RequestException as e:
            logging.warning(f"Błąd podczas pobierania strony {url} (Próba {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logging.info(f"Czekam {delay:.1f} sekund przed kolejną próbą...")
                time.sleep(delay)
            else:
                logging.error(f"Wszystkie {max_retries} próby pobrania strony nie powiodły się.")
                return [] # Wszystkie próby wyczerpane, zwróć pustą listę

    if not html_content:
        logging.error("Nie udało się pobrać zawartości HTML strony.")
        return []

    try:
        wig_companies = []
        soup = BeautifulSoup(html_content, 'html.parser')

        # StockWatch.pl: Nazwy spółek są w <td><strong><a href="...">NAZWA SPÓŁKI</a></strong></td>
        company_links = soup.select('td > strong > a[href*="/gpw/"]')

        if company_links:
            logging.info(f"Znaleziono {len(company_links)} potencjalnych linków do spółek.")
            for link in company_links:
                company_name = link.get_text(strip=True)
                if company_name and company_name.upper() != "WIĘCEJ":
                    wig_companies.append(company_name)

            if len(wig_companies) < 100:
                logging.warning(f"Znaleziono tylko {len(wig_companies)} spółek, co jest podejrzanie małą liczbą dla WIG.")

        else:
            logging.warning("Nie znaleziono linków do spółek za pomocą selektora CSS. Próba parsowania za pomocą pandas.read_html.")
            tables = pd.read_html(html_content, decimal=',', thousands='.')
            for df in tables:
                for col_name in df.columns:
                    if df[col_name].dtype == 'object' and not df[col_name].empty:
                        sample_values = df[col_name].dropna().head(5).tolist()
                        if all(isinstance(v, str) and len(v.strip()) > 1 and not v.strip().replace('.', '', 1).isdigit() for v in sample_values):
                            wig_companies = df[col_name].dropna().tolist()
                            wig_companies = [name.strip() for name in wig_companies if name.strip() and name.upper() != "WIĘCEJ"]
                            if wig_companies:
                                logging.info(f"Pobrano spółki za pomocą pandas.read_html i heurystyki kolumn. Znaleziono: {len(wig_companies)}")
                                break
                if wig_companies:
                    break

        if not wig_companies:
            logging.error("Nie udało się pobrać listy spółek WIG. Sprawdź, czy struktura strony się nie zmieniła.")
            return []

        logging.info(f"Pobrano {len(wig_companies)} spółek z indeksu WIG.")
        return wig_companies

    except ValueError as e:
        logging.error(f"Błąd parsowania HTML (pandas.read_html) ze StockWatch.pl: {e}")
        logging.info("Upewnij się, że strona zawiera prawidłowe tabele HTML.")
        return []
    except Exception as e:
        logging.error(f"Nieoczekiwany błąd w funkcji get_wig_companies: {e}")
        return []

def get_historical_data(company_name: str) -> pd.DataFrame:
    # ... (Twój istniejący kod funkcji get_historical_data) ...
    """
    Pobiera historyczne dane notowań dla danej spółki z archiwum GPW.
    Zakłada, że URL z pustym parametrem 'date' zwraca wszystkie dane.
    UWAGA: GPW API wymaga PEŁNEJ NAZWY INSTRUMENTU (spółki), a nie symbolu.

    Args:
        company_name (str): Pełna nazwa spółki (np. "CDPROJEKT", "PKO BP").

    Returns:
        pd.DataFrame: DataFrame z oczyszczonymi danymi historycznymi.
                      Pusta DataFrame w przypadku błędu.
    """
    base_url = "https://www.gpw.pl/archiwum-notowan-full"

    processed_company_name = company_name.replace(' ', '')
    url = f"{base_url}?type=10&instrument={processed_company_name}&date="

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    max_retries = 3
    base_delay = 2

    for attempt in range(max_retries):
        try:
            logging.info(f"Pobieranie danych historycznych dla spółki: {company_name} z URL: {url} (Próba {attempt + 1}/{max_retries})")
            response = requests.get(url, headers=headers, timeout=120)
            response.raise_for_status()

            try:
                tables = pd.read_html(response.text, decimal=',', thousands='.')
            except ValueError:
                logging.warning(f"Pandas nie znalazł żadnych tabel na stronie dla {company_name}.")
                return pd.DataFrame()

            historical_df = pd.DataFrame()

            # [MODYFIKACJA] Sprawdzanie kluczowych kolumn po ich dokładnych nazwach
            required_columns = ['Data sesji', 'Kurs otwarcia', 'Kurs zamknięcia', 'Wolumen obrotu (w szt.)']

            for i, table in enumerate(tables):
                # Sprawdza, czy wszystkie wymagane kolumny istnieją w tej tabeli
                if all(col in table.columns for col in required_columns):
                    logging.info(f"Znaleziono tabelę z danymi historycznymi (indeks: {i}) dla {company_name} po dokładnych nazwach kolumn.")
                    historical_df = table
                    break

            if historical_df.empty:
                logging.warning(f"Nie znaleziono tabeli zawierającej wszystkie wymagane kolumny dla {company_name} na stronie {url}.")
                continue

            # [MODYFIKACJA] Użycie dokładnych nazw kolumn jako kluczy
            column_mapping = {
                'Data sesji': 'date',
                'Kurs otwarcia': 'open_rate',
                'Kurs maksymalny': 'max_rate',
                'Kurs minimalny': 'min_rate',
                'Kurs zamknięcia': 'close_rate',
                'Zmiana kursu %': 'change_percent',
                'Wolumen obrotu (w szt.)': 'volume',
                'Liczba transakcji': 'transaction_count',
                'Wartość obrotu (w tys.)': 'turnover_thousands'
            }

            historical_df.rename(columns=column_mapping, inplace=True)

            # Konwersja daty do formatu YYYY-MM-DD
            if 'date' in historical_df.columns:
                historical_df['date'] = pd.to_datetime(historical_df['date'], format='%d-%m-%Y').dt.strftime('%Y-%m-%d')

            # Upewnij się, że kluczowe kolumny numeryczne istnieją przed konwersją
            numeric_cols = ['open_rate', 'max_rate', 'min_rate', 'close_rate', 'volume']
            for col in numeric_cols:
                if col in historical_df.columns:
                    historical_df[col] = pd.to_numeric(historical_df[col], errors='coerce')

            return historical_df

        except requests.exceptions.RequestException as e:
            logging.warning(f"Błąd żądania HTTP dla {company_name}: {e}")
            if attempt < max_retries - 1:
                time.sleep(base_delay * (2 ** attempt))
            else:
                logging.error(f"Nie udało się pobrać danych dla {company_name} po {max_retries} próbach.")
                return pd.DataFrame()
        except Exception as e:
            logging.error(f"Nieoczekiwany błąd podczas przetwarzania {company_name}: {e}")
            return pd.DataFrame()

    logging.warning(f"Nie udało się pobrać danych historycznych dla: {company_name}.")
    logging.warning("Pamiętaj, że URL GPW wymaga PEŁNEJ NAZWY SPÓŁKI. Sprawdź jej dokładne brzmienie dla GPW.")
    logging.warning("--------------------------------------------------")
    return pd.DataFrame()

def save_df_to_db(df: pd.DataFrame, table_name: str, db_url: str):
    """
    Zapisuje DataFrame do bazy danych PostgreSQL.
    Jeśli tabela nie istnieje, zostanie utworzona.
    Dane zostaną dodane do istniejącej tabeli.
    """
    if df.empty:
        logging.info(f"DataFrame dla tabeli '{table_name}' jest pusty, pomijam zapis.")
        return

    try:
        engine = create_engine(db_url)
        # Użyj 'append', aby dodać nowe wiersze do istniejącej tabeli
        # lub utworzyć nową, jeśli nie istnieje.
        # `index=False` zapobiega zapisywaniu indeksu DataFrame jako kolumny.
        df.to_sql(table_name, engine, if_exists='append', index=False)
        logging.info(f"Pomyślnie zapisano {len(df)} wierszy do tabeli '{table_name}'.")
    except Exception as e:
        logging.error(f"Błąd podczas zapisu do bazy danych dla tabeli '{table_name}': {e}")

if __name__ == '__main__':
    # Pobierz URL bazy danych ze zmiennych środowiskowych Render
    DATABASE_URL = os.environ.get("DATABASE_URL")
    if not DATABASE_URL:
        logging.error("Zmienna środowiskowa 'DATABASE_URL' nie jest ustawiona. Nie można połączyć się z bazą danych.")
        # Możesz tutaj rzucić wyjątek lub zakończyć skrypt, jeśli DB jest wymagana
        exit(1) # Zakończ skrypt, jeśli nie ma bazy danych

    # 1. Pobieranie listy spółek z WIG
    logging.info("Rozpoczynam pobieranie listy spółek z indeksu WIG.")
    wig_companies_list = get_wig_companies()

    if not wig_companies_list:
        logging.error("Nie udało się pobrać listy spółek WIG. Zakończono.")
        exit(1)

    logging.info(f"Znaleziono {len(wig_companies_list)} spółek w indeksie WIG. Rozpoczynam pobieranie danych historycznych.")

    # 2. Iteracja przez spółki i pobieranie danych historycznych
    # i zapisywanie ich do bazy danych
    for company in wig_companies_list:
        logging.info(f"\nPrzetwarzanie spółki: {company}")
        try:
            df = get_historical_data(company)
            if not df.empty:
                # Dodaj kolumnę z nazwą spółki do DataFrame, aby wiedzieć,
                # której spółki dotyczą dane w bazie.
                df['company_name'] = company 
                save_df_to_db(df, 'historical_stock_data', DATABASE_URL) # Nazwa tabeli: historical_stock_data
            else:
                logging.warning(f"Brak danych do zapisu dla spółki: {company}.")
        except Exception as e:
            logging.error(f"Błąd podczas przetwarzania danych dla spółki {company}: {e}")

        # Wskazówka: Możesz dodać krótkie opóźnienie między żądaniami dla każdej spółki,
        # aby nie przeciążać serwerów GPW.
        # time.sleep(0.5) 

    logging.info("Zakończono działanie skryptu scraper.py i zapis danych do bazy.")
