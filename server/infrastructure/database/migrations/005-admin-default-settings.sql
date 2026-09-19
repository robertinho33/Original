INSERT INTO admin_settings (key, value)
VALUES
    ('store_name', '"AUREA COSMETICS"'),
    ('currency', '"BRL"'),
    ('low_stock_limit', '5'),
    ('orders_page_size', '25'),
    ('admin_timezone', '"America/Sao_Paulo"')
ON CONFLICT (key) DO NOTHING;
