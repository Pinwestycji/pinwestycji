import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import create_engine, text
import os
import logging
from datetime import datetime, timedelta

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logging.error("Zmienna środowiskowa 'DATABASE_URL' nie jest ustawiona.")
    # Warto ustawić domyślną wartość dla testów lokalnych, jeśli jest potrzebna
    # DATABASE_URL = "sqlite:///your_local_database.db" 

@app.route('/api/search', methods=['GET'])
def search_companies():
    """Endpoint do wyszukiwania nazw spółek."""
    query = request.args.get('query', '').upper()
    logging.info(f"Odebrano zapytanie do /api/search z query: '{query}'")
    
    if not query:
        return jsonify({"error": "Query parameter 'query' is required."}), 400
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Wyszukujemy po tickerze (company_name), co jest bardziej standardowe
            sql_query = text("""
                SELECT DISTINCT company_name FROM historical_stock_data 
                WHERE company_name LIKE :query 
                ORDER BY company_name LIMIT 10;
            """)
            params = {'query': f'{query}%'}
            
            companies_df = pd.read_sql(sql_query, conn, params=params)
            companies_list = companies_df['company_name'].tolist()
        
        logging.info(f"Znaleziono {len(companies_list)} propozycji dla zapytania: '{query}'")
        return jsonify(companies_list)
    except Exception as e:
        logging.error(f"Błąd podczas wyszukiwania spółek: {e}", exc_info=True)
        return jsonify({"error": "Błąd serwera podczas wyszukiwania."}), 500

@app.route('/api/data/<ticker>', methods=['GET'])
def get_stock_data(ticker):
    """Endpoint do pobierania danych historycznych dla wykresu."""
    logging.info(f"Odebrano zapytanie do /api/data/{ticker}")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            
            # Ograniczenie zakresu dat do ostatnich 2 lat, aby uniknąć problemów z pamięcią
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=2*365) # Dwa lata wstecz

            sql_query = text("""
                SELECT date, open_rate AS open, max_rate AS high, min_rate AS low, close_rate AS close
                FROM historical_stock_data
                WHERE company_name = :ticker AND date >= :start_date
                ORDER BY date;
            """)
            params = {'ticker': ticker.upper(), 'start_date': start_date}
            df = pd.read_sql(sql_query, conn, params=params)
        
        if df.empty:
            logging.warning(f"Brak danych w bazie dla symbolu: {ticker} w zadanym okresie.")
            return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404
        
        # Używamy 'forward fill' do wypełnienia braków ostatnią znaną wartością
        df.ffill(inplace=True)
        # Uzupełniamy ewentualne braki na początku danych
        df.bfill(inplace=True)

        # Zmiana nazwy kolumny na 'time' i konwersja na timestamp
        df.rename(columns={'date': 'time'}, inplace=True)
        df['time'] = pd.to_datetime(df['time']).apply(lambda x: int(x.timestamp()))
        
        # Ostateczne usunięcie wierszy, które mogłyby mieć NaN
        df.dropna(inplace=True)

        # Upewnienie się, że wszystkie kolumny numeryczne mają właściwy typ
        for col in ['open', 'high', 'low', 'close']:
            df[col] = pd.to_numeric(df[col])

        data_json = df.to_dict('records')
        logging.info(f"Pomyślnie pobrano {len(data_json)} rekordów dla {ticker}")
        return jsonify(data_json)
        
    except Exception as e:
        logging.error(f"Błąd podczas pobierania danych dla {ticker}: {e}", exc_info=True)
        return jsonify({"error": "Wystąpił wewnętrzny błąd serwera."}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
