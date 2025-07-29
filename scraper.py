import requests
import pandas as pd
from bs4 import BeautifulSoup
import logging

# Konfiguracja logowania (możesz dostosować)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_wig_companies(url="https://gpwbenchmark.pl/karta-indeksu?isin=PL9999999995"):
    """
    Pobiera listę pełnych nazw spółek wchodzących w skład indeksu WIG z GPW Benchmark.
    Zwraca listę stringów z nazwami spółek.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        logging.info(f"Pobieranie listy spółek WIG z: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status() # Sprawdza, czy zapytanie zakończyło się sukcesem (kody 2xx)

        # Spróbuj użyć pandas do odczytania tabel HTML
        # pd.read_html domyślnie zwraca listę DataFrame'ów dla wszystkich tabel na stronie
        tables = pd.read_html(response.text)
        
        wig_companies = []
        # Przeszukaj pobrane tabele w poszukiwaniu tej z listą spółek WIG
        for i, table in enumerate(tables):
            # GPW Benchmark często ma kolumny takie jak 'Nazwa Spółki' lub 'Nazwa'
            # Zidentyfikuj tabelę na podstawie jej zawartości (np. kolumn)
            if 'Nazwa Spółki' in table.columns:
                logging.info(f"Znaleziono tabelę z 'Nazwa Spółki' (indeks: {i}).")
                wig_companies = table['Nazwa Spółki'].tolist()
                break
            elif 'Nazwa' in table.columns and 'ISIN' in table.columns: # Heurystyka: tabela z ISIN i Nazwą to często lista instrumentów
                # Sprawdź, czy są to nazwy spółek, a nie inne ogólne nazwy
                # Możesz dodać więcej warunków, aby upewnić się, że to lista spółek
                if any(isinstance(x, str) and len(x) > 3 and 'SA' in x.upper() for x in table['Nazwa'].dropna().tolist()):
                    logging.info(f"Znaleziono potencjalną tabelę spółek z 'Nazwa' i 'ISIN' (indeks: {i}).")
                    wig_companies = table['Nazwa'].tolist()
                    break
            elif 'Symbol' in table.columns and 'Nazwa instrumentu' in table.columns:
                 logging.info(f"Znaleziono tabelę z 'Symbol' i 'Nazwa instrumentu' (indeks: {i}).")
                 wig_companies = table['Nazwa instrumentu'].tolist()
                 break

        if not wig_companies:
            logging.warning("Nie udało się zidentyfikować tabeli z listą spółek WIG za pomocą pandas.read_html.")
            logging.info("Próba użycia BeautifulSoup do ręcznego parsowania w celu debugowania...")
            # Fallback dla debugowania, jeśli pandas.read_html zawiedzie
            soup = BeautifulSoup(response.text, 'html.parser')
            # Spróbuj znaleźć specyficzne elementy, np. wszystkie divy z klasą, która zawiera nazwę spółki
            # To wymagałoby ręcznej inspekcji strony w przeglądarce (Ctrl+Shift+I)
            # Przykład: znajdź tabelę z klasą 'table-striped' lub podobną
            table_element = soup.find('table') # Znajdź pierwszą tabelę
            if table_element:
                logging.info("Znaleziono ogólną tabelę za pomocą BeautifulSoup.")
                rows = table_element.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th']) # Znajdź komórki danych/nagłówki
                    # Tutaj logika do wyodrębniania, np. jeśli pierwsza komórka zawiera nazwę spółki
                    if len(cells) > 0:
                        text_content = cells[0].get_text(strip=True)
                        # Prosta heurystyka do sprawdzenia, czy to może być nazwa spółki
                        if len(text_content) > 3 and not text_content.isdigit() and 'ISIN' not in text_content:
                            logging.debug(f"Potencjalna nazwa spółki: {text_content}")
                            # wig_companies.append(text_content) # Nie dodajemy, bo to tylko do debugowania
            else:
                logging.warning("Nie znaleziono żadnych tabel w HTML strony.")
            return []

        logging.info(f"Pobrano {len(wig_companies)} spółek z indeksu WIG.")
        return wig_companies

    except requests.exceptions.RequestException as e:
        logging.error(f"Błąd podczas pobierania listy spółek WIG z {url}: {e}")
        return []
    except ValueError as e: # Często rzucany przez pd.read_html, jeśli nie ma tabel HTML
        logging.error(f"Błąd podczas parsowania HTML (pandas.read_html) z {url}: {e}")
        logging.info("Możliwe, że strona nie zawiera tabel HTML lub ich struktura jest niestandardowa/generowana JavaScriptem.")
        return []
    except Exception as e:
        logging.error(f"Nieoczekiwany błąd w funkcji get_wig_companies: {e}")
        return []

# Przykładowe użycie (do umieszczenia w głównym skrypcie Cron Job):
# if __name__ == "__main__":
#     company_list = get_wig_companies()
#     if company_list:
#         logging.info("Pobrane spółki WIG:")
#         for company_name in company_list:
#             logging.info(f"- {company_name}")
#     else:
#         logging.error("Nie udało się pobrać listy spółek WIG.")
