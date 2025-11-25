create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  password text not null,
  role text default 'user'
);

create table if not exists events (
  id bigserial primary key,
  date text not null,
  label text,
  icon text,
  start_time text,
  end_time text
);

-- 追加: 運用で利用している列を整備
alter table events add column if not exists event_date date;
alter table events add column if not exists capacity_driver integer;
alter table events add column if not exists capacity_attendant integer;

-- 応募テーブル
create table if not exists applications (
  id bigserial primary key,
  event_id bigint not null,
  username text not null,
  kind text not null check (kind in ('driver','attendant')),
  created_at timestamptz default now(),
  unique (event_id, username, kind)
);
create index if not exists idx_applications_event_id on applications(event_id);
create index if not exists idx_applications_username on applications(username);

-- 選出（確定）テーブル
create table if not exists selections (
  event_id bigint not null,
  username text not null,
  kind text not null check (kind in ('driver','attendant')),
  decided_at timestamptz default now(),
  primary key (event_id, username, kind)
);
create index if not exists idx_selections_event_id on selections(event_id);

-- 通知テーブル
create table if not exists notifications (
  id bigserial primary key,
  username text not null,
  event_id bigint not null,
  kind text not null,
  message text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- ボランティアの一言メモテーブル
create table if not exists interaction_notes (
  id bigserial primary key,
  username text not null,
  event_id bigint not null,
  template_key text,
  free_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (username, event_id)
);
create index if not exists idx_interaction_notes_username on interaction_notes(username);
create index if not exists idx_interaction_notes_event_id on interaction_notes(event_id);

insert into users (username, password, role)
values ('admin', 'admin123', 'admin')
on conflict (username) do nothing;
