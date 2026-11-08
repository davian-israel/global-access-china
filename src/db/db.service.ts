import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResultRow } from 'pg';

/** Schema is versioned: add a new entry to MIGRATIONS, never edit an old one. */
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      create table if not exists products (
        id text primary key,
        source text not null,
        data jsonb not null,
        fetched_at timestamptz not null default now()
      );
      create table if not exists orders (
        id serial primary key,
        ref text unique not null,
        status text not null,
        email text not null,
        name text not null,
        phone text not null,
        country text not null default 'GH',
        ship_method text not null,
        drop_type text not null,
        address text,
        items jsonb not null,
        quote jsonb not null,
        total_usd numeric(12,2) not null,
        charge_minor integer,
        charge_currency text,
        payment_ref text unique,
        paid_at timestamptz,
        weighed_kg numeric(8,3),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists orders_status_idx on orders(status);
      create index if not exists orders_email_idx on orders(lower(email));
      create table if not exists order_events (
        id serial primary key,
        order_id integer not null references orders(id) on delete cascade,
        status text not null,
        note text,
        created_at timestamptz not null default now()
      );
    `,
  },
];

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DbService.name);
  private pool: Pool;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const internal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(url);
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      ssl: internal ? false : { rejectUnauthorized: false },
    });
  }

  async onModuleInit() {
    await this.query(`create table if not exists schema_migrations (id integer primary key, applied_at timestamptz default now())`);
    const done = new Set((await this.query<{ id: number }>('select id from schema_migrations')).map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await client.query(m.sql);
        await client.query('insert into schema_migrations(id) values ($1)', [m.id]);
        await client.query('commit');
        this.log.log(`Applied migration ${m.id}`);
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  async one<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
