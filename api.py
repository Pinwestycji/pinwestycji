from flask import Flask, jsonify, request
from sqlalchemy import create_engine
import pandas as pd
import os

app = Flask(__name__)

# Konfiguracja CORS, jeśli potrzebna
from flask_cors import CORS
CORS(app)

DATABASE_URL = os.environ.get("DATABASE_URL")

# Nowy endpoint do wyszukiwania spółek
@app.route('/api/search', methods=['GET'])
def search_companies():
    query = request.args.get('query', '').upper()
    if not query:
        return jsonify({"error": "Query parameter 'query' is required."}), 400
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Użycie LIKE do wyszukiwania po fragmencie nazwy
            sql_query = f"SELECT DISTINCT company_name FROM historical_stock_data WHERE UPPER(company_name) LIKE '{query}%' ORDER BY company_name LIMIT 10;"
            companies_df = pd.read_sql(sql_query, conn)
            companies_list = companies_df['company_name'].tolist()
        
        return jsonify(companies_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Istniejący endpoint do pobierania danych dla wykresu
@app.route('/api/data/<ticker>', methods=['GET'])
def get_stock_data(ticker):
    # ... (Twój istniejący kod dla tego endpointu) ...
    try:
        engine = create_engine(DATABASE_URL)
        sql_query = f"SELECT date, open_rate AS open, max_rate AS high, min_rate AS low, close_rate AS close FROM historical_stock_data WHERE company_name = '{ticker.upper()}' ORDER BY date"
        df = pd.read_sql(sql_query, engine)
        
        if df.empty:
            return jsonify({"error": f"Brak danych dla symbolu: {ticker}"}), 404
        
        # Konwersja DataFrame do formatu JSON, aby pasował do LightweightCharts
        data_json = df.to_dict('records')
        return jsonify(data_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
