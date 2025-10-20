-- 1. Zmiana delimitera, aby cała definicja procedury została odczytana jako jedno polecenie
DELIMITER $$

-- 2. Stworzenie lub zastąpienie procedury
CREATE PROCEDURE Calculate_Wig_Annual_Summary()
BEGIN

    -- 1. Tworzenie lub zastąpienie tabeli docelowej
    DROP TABLE IF EXISTS wig_annual_summary;

    CREATE TABLE wig_annual_summary (
        Spółka VARCHAR(255),
        Ticker VARCHAR(50),
        Rok INT,
        EPS DOUBLE,
        `C/Z` DOUBLE,
        `Procentowa zmiana EPS r/r` DOUBLE,
        `Zysk netto` BIGINT,
        `Liczba akcji` BIGINT,
        Kurs DOUBLE,
        PRIMARY KEY (Ticker, Rok)
    );

    -- 2. Użycie pierwszej tabeli tymczasowej do weryfikacji i grupowania danych
    CREATE TEMPORARY TABLE temp_annual_summary AS
    SELECT
        Spółka,
        Ticker,
        RIGHT(Kwartał, 4) AS Rok,
        SUM(CASE WHEN `Liczba akcji` IS NOT NULL AND REPLACE(`Liczba akcji`, ' ', '') IS NOT NULL AND `Zysk netto` IS NOT NULL AND REPLACE(`Zysk netto`, ' ', '') IS NOT NULL AND Kurs IS NOT NULL AND REPLACE(Kurs, ' ', '') IS NOT NULL THEN 1 ELSE 0 END) AS valid_quarters_count,
        
        -- Jawny CAST WEWNĄTRZ agregacji SUM dla bezpieczeństwa typów
        SUM(CASE WHEN `Zysk netto` IS NOT NULL THEN CAST(REPLACE(`Zysk netto`, ' ', '') AS SIGNED) * 1000 ELSE 0 END) AS `Zysk netto sum`,
        
        -- Jawny CAST WEWNĄTRZ agregacji MAX (jako liczba całkowita bez znaku)
        MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN CAST(REPLACE(`Liczba akcji`, ' ', '') AS UNSIGNED) END) AS `Liczba Akcji Q4`,
        
        -- Jawny CAST WEWNĄTRZ agregacji MAX (jako liczba zmiennoprzecinkowa)
        MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN CAST(REPLACE(Kurs, ' ', '') AS DOUBLE) END) AS `Kurs Q4`,
        
        -- Obliczenie EPS z jawnymi CASTami
        (
            SUM(CASE WHEN `Zysk netto` IS NOT NULL THEN CAST(REPLACE(`Zysk netto`, ' ', '') AS SIGNED) * 1000 ELSE 0 END) /
            MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN CAST(REPLACE(`Liczba akcji`, ' ', '') AS UNSIGNED) END)
        ) AS current_year_eps
    FROM
        wig_indicators_summary
    WHERE Kwartał REGEXP '^Q[1-4][0-9]{4}$'
    GROUP BY
        Spółka, Ticker, Rok
    HAVING
        valid_quarters_count = 4;


    -- 3. Użycie drugiej tabeli tymczasowej do obliczenia EPS z poprzedniego roku
    CREATE TEMPORARY TABLE temp_prev_year_eps AS
    SELECT 
        Ticker, 
        Rok + 1 AS next_year, 
        current_year_eps AS prev_year_eps
    FROM 
        temp_annual_summary;


    -- 4. Wstawianie danych do tabeli docelowej i obliczenia
    INSERT INTO wig_annual_summary (
        Spółka,
        Ticker,
        Rok,
        EPS,
        `C/Z`,
        `Procentowa zmiana EPS r/r`,
        `Zysk netto`,
        `Liczba akcji`,
        Kurs
    )
    SELECT
        t1.Spółka,
        t1.Ticker,
        t1.Rok,
        ROUND(t1.current_year_eps, 2) AS EPS,
        ROUND(t1.`Kurs Q4` / t1.current_year_eps, 2) AS `C/Z`,
        -- Zachowana oryginalna, naprawiona logika obliczania procentowej zmiany EPS
        ROUND(
            COALESCE(
                CASE
                    WHEN t2.prev_year_eps = 0 THEN 0
                    WHEN t2.prev_year_eps < 0 AND t1.current_year_eps >= 0 THEN ((t1.current_year_eps / ABS(t2.prev_year_eps)) + 1) * 100
                    WHEN t2.prev_year_eps < 0 AND t1.current_year_eps < 0 THEN (t1.current_year_eps - t2.prev_year_eps) / ABS(t2.prev_year_eps) * 100
                    ELSE (t1.current_year_eps - t2.prev_year_eps) / t2.prev_year_eps * 100
                END,
                0
            ), 2) AS `Procentowa zmiana EPS r/r`,
        t1.`Zysk netto sum` AS `Zysk netto`,
        t1.`Liczba Akcji Q4`,
        t1.`Kurs Q4`
    FROM
        temp_annual_summary AS t1
    LEFT JOIN temp_prev_year_eps AS t2 ON t1.Ticker = t2.Ticker AND t1.Rok = t2.next_year;
    

    -- 5. Usunięcie tabel tymczasowych
    DROP TEMPORARY TABLE IF EXISTS temp_annual_summary;
    DROP TEMPORARY TABLE IF EXISTS temp_prev_year_eps;

END$$

-- 3. Przywrócenie standardowego delimitera
DELIMITER ;
