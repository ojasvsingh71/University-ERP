-- Enables gen_random_uuid(), used as the default for every table's `id` column.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
