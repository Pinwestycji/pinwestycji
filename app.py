import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import create_engine, text
import os
import logging
from datetime import datetime

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logging.error("Zmienna środowiskowa 'DATABASE_URL' nie jest ustawiona.")
    DATABASE_URL = "sqlite:///:memory:"

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
            sql_query = text("SELECT DISTINCT company_name FROM historical_stock_data WHERE UPPER(company_name) LIKE :query ORDER BY company_name LIMIT 10;")
            params = {'query': f'{query}%'}
            
            companies_df = pd.read_sql(sql_query, conn, params=params)
            companies_list = companies_df['company_name'].tolist()
        
        logging.info(f"Znaleziono {len(companies_list)} propozycji dla zapytania: '{query}'")
        return jsonify(companies_list)
    except Exception as e:
        logging.error(f"Błąd podczas wyszukiwania spółek: {e}")
        return jsonify({"error": "Błąd serwera podczas wyszukiwania."}), 500

@app.route('/api/data/<ticker>', methods=['GET'])
def get_stock_data(ticker):
    """Endpoint do pobierania danych historycznych dla wykresu."""
    logging.info(f"Odebrano zapytanie do /api/data/{ticker}")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            sql_query = text("""
                SELECT date, open_rate AS open, max_rate AS high, min_rate AS low, close_rate AS close
                FROM historical_stock_data
                WHERE company_name = :ticker
                ORDER BY date;
            """)
            params = {'ticker': ticker.upper()}
            df = pd.read_sql(sql_query, conn, params=params)
        
        if df.empty:
            logging.warning(f"Brak danych w bazie dla symbolu: {ticker}")
            return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404
        
        # Konwersja daty na timestamp
        df['date'] = pd.to_datetime(df['date']).apply(lambda x: int(x.timestamp()))
        
        # Kluczowa zmiana: wypełnienie wartości NaN (powstałych z NULL) na None
        df = df.fillna(value=None)

        data_json = df.to_dict('records')
        logging.info(f"Pomyślnie pobrano {len(data_json)} rekordów dla {ticker}")
        return jsonify(data_json)
    except Exception as e:
        logging.error(f"Błąd podczas pobierania danych dla {ticker}: {e}")
        return jsonify({"error": f"Błąd serwera podczas pobierania danych: {e}"}), 500

if __name__ == '__main__':
    port = os.environ.get('PORT', 5000)
    app.run(debug=True, host='0.0.0.0', port=port)
