DELIMITER //

CREATE PROCEDURE CalculateAnnualSummary()
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
    -- Tabela ta sumuje Zysk Netto oraz pobiera Kurs i Liczbę Akcji z Q4, 
    -- obliczając bieżący roczny EPS (current_year_eps).
    CREATE TEMPORARY TABLE temp_annual_summary AS
    SELECT
        Spółka,
        Ticker,
        CAST(RIGHT(Kwartał, 4) AS SIGNED) AS Rok, -- Konwersja Roku na typ liczbowy
        -- Licznik pełnych kwartałów z danymi
        SUM(CASE WHEN `Liczba akcji` IS NOT NULL AND REPLACE(`Liczba akcji`, ' ', '') IS NOT NULL 
                 AND `Zysk netto` IS NOT NULL AND REPLACE(`Zysk netto`, ' ', '') IS NOT NULL 
                 AND Kurs IS NOT NULL AND REPLACE(Kurs, ' ', '') IS NOT NULL THEN 1 ELSE 0 END) AS valid_quarters_count,
        -- Suma Zysku Netto (w przeliczeniu na pełne jednostki, jeśli pierwotna wartość jest w tysiącach)
        SUM(CASE WHEN `Zysk netto` IS NOT NULL THEN REPLACE(`Zysk netto`, ' ', '') * 1000 ELSE 0 END) AS `Zysk netto sum`,
        -- Liczba Akcji i Kurs z końca roku (Q4)
        MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN REPLACE(`Liczba akcji`, ' ', '') END) AS `Liczba Akcji Q4`,
        MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN REPLACE(Kurs, ' ', '') END) AS `Kurs Q4`,
        -- Bieżący EPS = Zysk Netto / Liczba Akcji Q4
        (SUM(CASE WHEN `Zysk netto` IS NOT NULL THEN REPLACE(`Zysk netto`, ' ', '') * 1000 ELSE 0 END) / MAX(CASE WHEN Kwartał LIKE 'Q4%' THEN REPLACE(`Liczba akcji`, ' ', '') END)) AS current_year_eps
    FROM
        wig_indicators_summary
    WHERE Kwartał REGEXP '^Q[1-4][0-9]{4}$' -- Upewnienie się, że format kwartału jest poprawny
    GROUP BY
        Spółka, Ticker, Rok
    HAVING
        valid_quarters_count = 4; -- Wymaganie pełnych 4 kwartałów

    -- 3. Użycie drugiej tabeli tymczasowej do obliczenia EPS z poprzedniego roku (lagowanie)
    CREATE TEMPORARY TABLE temp_prev_year_eps AS
    SELECT 
        Ticker, 
        Rok + 1 AS next_year, -- Przesunięcie roku o 1, aby można było połączyć z bieżącym rokiem
        current_year_eps AS prev_year_eps
    FROM 
        temp_annual_summary;

    -- 4. Wstawianie danych do tabeli docelowej i finalne obliczenia
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
        -- Obliczenie C/Z
        ROUND(t1.`Kurs Q4` / NULLIF(t1.current_year_eps, 0), 2) AS `C/Z`, -- Użycie NULLIF dla bezpiecznego dzielenia przez zero
        -- Obliczenie procentowej zmiany EPS r/r
        ROUND(
            COALESCE(
                CASE
                    -- Przypadek 1: Poprzedni EPS wynosi 0 (Zmiana jest nieskończona, ustalamy na 0 lub wg polityki)
                    WHEN t2.prev_year_eps = 0 THEN 0
                    -- Przypadek 2: Przejście ze straty (ujemny) do zysku (dodatni lub zero)
                    WHEN t2.prev_year_eps < 0 AND t1.current_year_eps >= 0 THEN (t1.current_year_eps - t2.prev_year_eps) / ABS(t2.prev_year_eps) * 100
                    -- Przypadek 3: Ze straty do straty (oba ujemne)
                    WHEN t2.prev_year_eps < 0 AND t1.current_year_eps < 0 THEN (t1.current_year_eps - t2.prev_year_eps) / ABS(t2.prev_year_eps) * 100
                    -- Przypadek 4: Standardowe obliczenie dla wartości dodatnich
                    ELSE (t1.current_year_eps - t2.prev_year_eps) / t2.prev_year_eps * 100
                END,
                0
            ), 2) AS `Procentowa zmiana EPS r/r`,
        t1.`Zysk netto sum` AS `Zysk netto`,
        t1.`Liczba Akcji Q4`,
        t1.`Kurs Q4`
    FROM
        temp_annual_summary AS t1
    LEFT JOIN temp_prev_year_eps AS t2 
        ON t1.Ticker = t2.Ticker AND t1.Rok = t2.next_year;

    -- 5. Usunięcie tabel tymczasowych
    DROP TEMPORARY TABLE temp_annual_summary;
    DROP TEMPORARY TABLE temp_prev_year_eps;

END//

-- Przywrócenie domyślnego terminatora
DELIMITER ;
