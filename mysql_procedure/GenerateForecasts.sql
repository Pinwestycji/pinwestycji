DELIMITER //

DROP PROCEDURE IF EXISTS GenerateForecasts//

CREATE PROCEDURE GenerateForecasts(
    IN start_year INT,
    IN end_year INT
)
BEGIN
    -- 1. Tworzenie nowej tabeli na prognozy, jeśli jeszcze nie istnieje
    DROP TABLE IF EXISTS wig_company_forecasts;
    CREATE TABLE wig_company_forecasts (
        Spółka VARCHAR(255),
        Ticker VARCHAR(50),
        `Średnia stopa wzrostu EPS r/r` DOUBLE,
        `Średni wskaźnik C/Z` DOUBLE,
        `Prognoza EPS na kolejny rok` DOUBLE,
        `Prognoza ceny akcji na następny rok` VARCHAR(10),
        `EPS za poprzedni rok` DOUBLE,
        `Aktualny EPS` DOUBLE,
        `Obliczona Średnia z Ostatnich lat` INT,
        PRIMARY KEY (Ticker)
    );

    -- 2. Użycie tabeli tymczasowej do obliczenia średnich z wig_annual_summary
    -- oraz do znalezienia ostatniego EPS w zadanym okresie
    CREATE TEMPORARY TABLE temp_annual_stats AS
    SELECT
        Ticker,
        Spółka,
        AVG(`Procentowa zmiana EPS r/r`) AS avg_eps_growth,
        AVG(`C/Z`) AS avg_pe_ratio,
        MAX(CASE WHEN Rok = end_year THEN EPS ELSE NULL END) AS last_eps,
        (end_year - start_year + 1) AS years_count
    FROM
        wig_annual_summary
    WHERE
        Rok >= start_year AND Rok <= end_year
    GROUP BY
        Ticker, Spółka;

    -- 3. Użycie drugiej tabeli tymczasowej do obliczenia aktualnego EPS
    -- z czterech ostatnich kwartałów z bezpieczną konwersją typów
    CREATE TEMPORARY TABLE temp_latest_eps AS
    WITH RankedQuarters AS (
        SELECT
            Ticker,
            -- Bezpieczna konwersja 'Zysk netto' na typ liczbowy (DECIMAL dla precyzji)
            -- COALESCE zamienia ewentualne NULLe na 0
            COALESCE(CAST(REPLACE(`Zysk netto`, ' ', '') AS DECIMAL(20,0)), 0) AS ZyskNetto_Numeric,
            -- Bezpieczna konwersja 'Liczba akcji' na typ liczbowy (UNSIGNED dla liczb całkowitych bez znaku)
            COALESCE(CAST(REPLACE(`Liczba akcji`, ' ', '') AS UNSIGNED), 0) AS LiczbaAkcji_Numeric,
            -- Ustalenie kolejności kwartałów od najnowszego do najstarszego
            ROW_NUMBER() OVER (PARTITION BY Ticker ORDER BY id DESC) AS rn
        FROM
            wig_indicators_with_id
    )
    SELECT
        Ticker,
        -- Obliczenie sumy zysku netto z ostatnich 4 kwartałów
        SUM(ZyskNetto_Numeric) * 1000 AS TotalNetProfit,
        -- Wybranie liczby akcji z ostatniego dostępnego kwartału (rn=1)
        MAX(CASE WHEN rn = 1 THEN LiczbaAkcji_Numeric ELSE 0 END) AS LatestShareCount
    FROM
        RankedQuarters
    WHERE rn <= 4
    GROUP BY
        Ticker;

   -- 4. Wstawianie danych do tabeli prognoz z obliczeniami
    INSERT INTO wig_company_forecasts (
        Spółka,
        Ticker,
        `Średnia stopa wzrostu EPS r/r`,
        `Średni wskaźnik C/Z`,
        `Prognoza EPS na kolejny rok`,
        `Prognoza ceny akcji na następny rok`,
        `EPS za poprzedni rok`,
        `Aktualny EPS`,
        `Obliczona Średnia z Ostatnich lat`
    )
    SELECT
        t1.Spółka,
        t1.Ticker,
        ROUND(t1.avg_eps_growth, 2),
        ROUND(t1.avg_pe_ratio, 2),
        -- Obliczenie prognozy EPS na kolejny rok bazuje na 'last_eps'
        ROUND(t1.last_eps * (1 + t1.avg_eps_growth / 100), 2),
        CASE
            WHEN (t1.last_eps * (1 + t1.avg_eps_growth / 100)) <= 0 OR t1.avg_pe_ratio <= 0 THEN 'N/A'
            ELSE CAST(ROUND((t1.last_eps * (1 + t1.avg_eps_growth / 100)) * t1.avg_pe_ratio, 2) AS CHAR)
        END AS `Prognoza ceny akcji na następny rok`,
        t1.last_eps AS `EPS za poprzedni rok`,
        
        -- Obliczenie 'Aktualny EPS' z zabezpieczeniem przed dzieleniem przez zero
        CASE
            WHEN t2.LatestShareCount > 0 THEN ROUND(t2.TotalNetProfit / t2.LatestShareCount, 2)
            ELSE 0
        END AS `Aktualny EPS`,
        t1.years_count
    FROM
        temp_annual_stats AS t1
    LEFT JOIN
        temp_latest_eps AS t2 ON t1.Ticker = t2.Ticker;
        
    -- 5. Usunięcie tabel tymczasowych
    DROP TEMPORARY TABLE temp_annual_stats;
    DROP TEMPORARY TABLE temp_latest_eps;

END//

-- Przywrócenie domyślnego terminatora
DELIMITER ;
