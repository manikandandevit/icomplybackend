import psycopg
from psycopg.types.json import Jsonb
import json
import datetime
from decimal import Decimal
import uuid

DB_URL = "postgresql://postgres.ykxeqpnaggawupoiikyn:vUK8%40w%24D3%5E%5EYJxs@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
OUTPUT_FILE = r"c:\Users\manik\StudioProjects\Icomply\icomply_database_dump.sql"

def format_sql_value(val):
    if val is None:
        return "NULL"
    elif isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    elif isinstance(val, (int, float, Decimal)):
        return str(val)
    elif isinstance(val, (dict, list)):
        # Convert python dict/list to JSON string
        json_str = json.dumps(val, default=str)
        # Escape single quotes
        escaped = json_str.replace("'", "''")
        return f"'{escaped}'"
    elif isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return f"'{val.isoformat()}'"
    elif isinstance(val, uuid.UUID):
        return f"'{str(val)}'"
    elif isinstance(val, (bytes, bytearray)):
        return f"'\\x{val.hex()}'::bytea"
    else:
        s = str(val).replace("'", "''")
        return f"'{s}'"

def dump_database():
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            out = []
            out.append("-- =============================================================================")
            out.append(f"-- iComply Database Dump (Schema + Data)")
            out.append(f"-- Generated: {datetime.datetime.now().isoformat()}")
            out.append("-- Target: PostgreSQL compatible (Supabase, Neon, AWS RDS, Local Postgres)")
            out.append("-- =============================================================================\n")

            out.append("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
            out.append("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n")
            out.append("SET statement_timeout = 0;")
            out.append("SET lock_timeout = 0;")
            out.append("SET client_encoding = 'UTF8';")
            out.append("SET standard_conforming_strings = on;")
            out.append("SET check_function_bodies = false;")
            out.append("SET client_min_messages = warning;")
            out.append("SET row_security = off;\n")
            out.append("-- Disable foreign key checks and triggers during restore")
            out.append("SET session_replication_role = 'replica';\n")

            # 1. Fetch all sequences
            cur.execute("""
                SELECT sequence_name 
                FROM information_schema.sequences 
                WHERE sequence_schema = 'public'
                ORDER BY sequence_name;
            """)
            sequences = [r[0] for r in cur.fetchall()]
            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- SEQUENCES")
            out.append("-- -----------------------------------------------------------------------------")
            for seq in sequences:
                out.append(f'CREATE SEQUENCE IF NOT EXISTS public."{seq}";')
            out.append("")

            # 2. Fetch all tables
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            tables = [r[0] for r in cur.fetchall()]

            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- TABLES SCHEMA")
            out.append("-- -----------------------------------------------------------------------------")

            for table in tables:
                # Get columns
                cur.execute("""
                    SELECT 
                        a.attname AS column_name,
                        format_type(a.atttypid, a.atttypmod) AS data_type,
                        a.attnotnull AS not_null,
                        pg_get_expr(d.adbin, d.adrelid) AS default_value
                    FROM pg_attribute a
                    LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                    JOIN pg_class c ON a.attrelid = c.oid
                    JOIN pg_namespace n ON c.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND c.relname = %s AND a.attnum > 0 AND NOT a.attisdropped
                    ORDER BY a.attnum;
                """, (table,))
                cols = cur.fetchall()

                col_defs = []
                for col_name, data_type, not_null, default_val in cols:
                    line = f'    "{col_name}" {data_type}'
                    if default_val:
                        line += f' DEFAULT {default_val}'
                    if not_null:
                        line += ' NOT NULL'
                    col_defs.append(line)

                # Get primary key
                cur.execute("""
                    SELECT c.conname, pg_get_constraintdef(c.oid)
                    FROM pg_constraint c
                    JOIN pg_class t ON c.conrelid = t.oid
                    JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND t.relname = %s AND c.contype = 'p';
                """, (table,))
                pk = cur.fetchone()
                if pk:
                    col_defs.append(f'    CONSTRAINT "{pk[0]}" {pk[1]}')

                # Get unique constraints
                cur.execute("""
                    SELECT c.conname, pg_get_constraintdef(c.oid)
                    FROM pg_constraint c
                    JOIN pg_class t ON c.conrelid = t.oid
                    JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND t.relname = %s AND c.contype = 'u';
                """, (table,))
                uniques = cur.fetchall()
                for uname, udef in uniques:
                    col_defs.append(f'    CONSTRAINT "{uname}" {udef}')

                # Get check constraints
                cur.execute("""
                    SELECT c.conname, pg_get_constraintdef(c.oid)
                    FROM pg_constraint c
                    JOIN pg_class t ON c.conrelid = t.oid
                    JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND t.relname = %s AND c.contype = 'c';
                """, (table,))
                checks = cur.fetchall()
                for cname, cdef in checks:
                    col_defs.append(f'    CONSTRAINT "{cname}" {cdef}')

                out.append(f'DROP TABLE IF EXISTS public."{table}" CASCADE;')
                out.append(f'CREATE TABLE public."{table}" (')
                out.append(',\n'.join(col_defs))
                out.append(');\n')

            # 3. Indexes (excluding primary and unique constraints already defined)
            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- INDEXES")
            out.append("-- -----------------------------------------------------------------------------")
            cur.execute("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE schemaname = 'public'
                AND indexname NOT IN (
                    SELECT conname FROM pg_constraint WHERE contype IN ('p', 'u')
                )
                ORDER BY tablename, indexname;
            """)
            indexes = cur.fetchall()
            for iname, idef in indexes:
                out.append(f"{idef};")
            out.append("")

            # 4. Data Insertion
            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- DATA INSERTION")
            out.append("-- -----------------------------------------------------------------------------")
            for table in tables:
                cur.execute(f'SELECT * FROM public."{table}"')
                rows = cur.fetchall()
                if not rows:
                    continue

                col_names = [desc[0] for desc in cur.description]
                cols_str = ', '.join([f'"{c}"' for c in col_names])

                out.append(f'-- Data for public."{table}" ({len(rows)} rows)')
                # Write in chunks of 50
                chunk_size = 50
                for i in range(0, len(rows), chunk_size):
                    chunk = rows[i:i+chunk_size]
                    values_list = []
                    for row in chunk:
                        vals_formatted = [format_sql_value(v) for v in row]
                        values_list.append(f"  ({', '.join(vals_formatted)})")
                    out.append(f'INSERT INTO public."{table}" ({cols_str}) VALUES\n' + ',\n'.join(values_list) + ';')
                out.append("")

            # 5. Foreign Key Constraints (added after data to avoid any ordering conflict)
            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- FOREIGN KEYS")
            out.append("-- -----------------------------------------------------------------------------")
            for table in tables:
                cur.execute("""
                    SELECT c.conname, pg_get_constraintdef(c.oid)
                    FROM pg_constraint c
                    JOIN pg_class t ON c.conrelid = t.oid
                    JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND t.relname = %s AND c.contype = 'f';
                """, (table,))
                fks = cur.fetchall()
                for fkname, fkdef in fks:
                    out.append(f'ALTER TABLE ONLY public."{table}" ADD CONSTRAINT "{fkname}" {fkdef};')
            out.append("")

            # 6. Sequence Updates
            out.append("-- -----------------------------------------------------------------------------")
            out.append("-- SEQUENCE SETVAL UPDATES")
            out.append("-- -----------------------------------------------------------------------------")
            for seq in sequences:
                try:
                    cur.execute(f'SELECT last_value, is_called FROM public."{seq}"')
                    last_val, is_called = cur.fetchone()
                    out.append(f"SELECT setval('public.\"{seq}\"', {last_val}, {str(is_called).lower()});")
                except Exception as e:
                    pass

            out.append("\n-- -----------------------------------------------------------------------------")
            out.append("-- RESTORE SETTINGS")
            out.append("-- -----------------------------------------------------------------------------")
            out.append("SET session_replication_role = 'origin';\n")

            content = '\n'.join(out)
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"Dump completed successfully: {OUTPUT_FILE}")
            print(f"Total lines: {len(out)}")

if __name__ == "__main__":
    dump_database()
