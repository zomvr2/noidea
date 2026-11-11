-- NoIdea: esquema inicial en Supabase. Ver docs/modelo-datos.md
-- Volúmenes en litros (numeric), distancias en mm, fechas timestamptz.
-- Escrituras de negocio: solo la API (service_role) mediante las funciones de abajo.
-- Lecturas desde la app: con RLS según rol.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.families (
  id          bigint generated always as identity primary key,
  name        text    not null,
  sector      text    not null,
  members     integer not null check (members > 0),
  status      text    not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'family' check (role in ('family', 'admin', 'municipal')),
  family_id   bigint references public.families (id),
  created_at  timestamptz not null default now()
);
create index profiles_family_id_idx on public.profiles (family_id);

create table public.quotas (
  id            bigint generated always as identity primary key,
  family_id     bigint not null references public.families (id),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  allocated_l   numeric(10, 2) not null check (allocated_l >= 0),
  used_l        numeric(10, 2) not null default 0 check (used_l >= 0),
  reserved_l    numeric(10, 2) not null default 0 check (reserved_l >= 0),
  unique (family_id, period_start),
  check (period_end > period_start)
);

create table public.tanks (
  id                  bigint generated always as identity primary key,
  name                text    not null,
  nfc_tag_uid         text    not null unique check (nfc_tag_uid ~ '^[0-9A-F]+$'),
  capacity_l          numeric(10, 2) not null check (capacity_l > 0),
  empty_distance_mm   integer not null,
  full_distance_mm    integer not null,
  flow_lps            numeric(8, 4) not null check (flow_lps > 0),
  critical_percent    numeric(5, 2) not null default 20,
  status              text not null default 'available'
                      check (status in ('available', 'dispensing', 'maintenance', 'offline')),
  -- Ubicación marcada por un admin con el GPS del teléfono al escanear la etiqueta NFC.
  latitude            double precision check (latitude between -90 and 90),
  longitude           double precision check (longitude between -180 and 180),
  location_accuracy_m numeric(8, 1),
  location_marked_at  timestamptz,
  location_marked_by  uuid references auth.users (id),
  -- Último nivel conocido (lo actualiza record_level). Estimaciones, no mediciones exactas.
  level_volume_l      numeric(10, 1),
  level_percent       numeric(5, 1),
  level_distance_mm   integer,
  level_backup_low    boolean,
  level_error         text,
  level_measured_at   timestamptz,
  level_simulated     boolean not null default false,
  device_last_seen_at timestamptz,
  created_at          timestamptz not null default now(),
  check (empty_distance_mm > full_distance_mm),
  check ((latitude is null) = (longitude is null))
);

-- Un ESP32 por estanque. El secreto firma órdenes y peticiones (HMAC); solo lo lee service_role.
create table public.devices (
  id             uuid primary key default gen_random_uuid(),
  tank_id        bigint not null unique references public.tanks (id),
  secret         text   not null default encode(extensions.gen_random_bytes(32), 'hex'),
  fw_version     text,
  simulated      boolean not null default false,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table public.level_readings (
  id           bigint generated always as identity primary key,
  tank_id      bigint not null references public.tanks (id),
  distance_mm  integer,
  volume_l     numeric(10, 1),
  percent      numeric(5, 1),
  backup_raw   integer,
  backup_low   boolean,
  error        text,
  simulated    boolean not null default false,
  measured_at  timestamptz not null default now()
);
create index level_readings_tank_time_idx on public.level_readings (tank_id, measured_at desc);

create table public.withdrawals (
  id                  bigint generated always as identity primary key,
  family_id           bigint not null references public.families (id),
  tank_id             bigint not null references public.tanks (id),
  quota_id            bigint not null references public.quotas (id),
  requested_by        uuid references auth.users (id),
  requested_l         numeric(10, 2) not null check (requested_l > 0),
  target_ms           integer not null check (target_ms > 0),
  open_ms             integer,
  progress_ms         integer,
  delivered_l         numeric(10, 1),
  measurement_method  text not null default 'estimated_time'
                      check (measurement_method in ('estimated_time', 'flowmeter')),
  level_before_l      numeric(10, 1),
  level_after_l       numeric(10, 1),
  level_delta_l       numeric(10, 1),
  status              text not null default 'authorized'
                      check (status in ('authorized', 'dispensing', 'completed', 'failed', 'cancelled')),
  close_reason        text,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz
);
create index withdrawals_family_idx on public.withdrawals (family_id, created_at desc);
create index withdrawals_quota_idx on public.withdrawals (quota_id);
-- Un solo retiro activo por estanque (hay una sola válvula).
create unique index withdrawals_one_active_per_tank
  on public.withdrawals (tank_id) where status in ('authorized', 'dispensing');

create table public.alerts (
  id           bigint generated always as identity primary key,
  tank_id      bigint references public.tanks (id),
  type         text not null
               check (type in ('critical_level', 'sensor_error', 'device_offline', 'dispense_failed')),
  status       text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  message      text not null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index alerts_tank_idx on public.alerts (tank_id, status);

create table public.refill_requests (
  id                  bigint generated always as identity primary key,
  tank_id             bigint not null references public.tanks (id),
  status              text not null default 'requested'
                      check (status in ('requested', 'scheduled', 'in_transit', 'delivered', 'cancelled')),
  requested_volume_l  numeric(10, 1),
  notes               text,
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index refill_requests_tank_idx on public.refill_requests (tank_id);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id),
  action      text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS: la app solo lee; toda escritura pasa por la API con service_role.
-- ---------------------------------------------------------------------------

-- Helpers de RLS en un esquema no expuesto por la Data API (no invocables por RPC).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.my_family_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where id = (select auth.uid())
$$;

revoke execute on function private.my_role(), private.my_family_id() from public, anon;
grant execute on function private.my_role(), private.my_family_id() to authenticated, service_role;

alter table public.families        enable row level security;
alter table public.profiles        enable row level security;
alter table public.quotas          enable row level security;
alter table public.tanks           enable row level security;
alter table public.devices         enable row level security;
alter table public.level_readings  enable row level security;
alter table public.withdrawals     enable row level security;
alter table public.alerts          enable row level security;
alter table public.refill_requests enable row level security;
alter table public.audit_log       enable row level security;
-- devices y audit_log: sin políticas => inaccesibles salvo para service_role.

create policy "perfil propio o admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy "familia propia o gestores" on public.families for select to authenticated
  using (id = (select private.my_family_id()) or (select private.my_role()) in ('admin', 'municipal'));

create policy "cuota propia o admin" on public.quotas for select to authenticated
  using (family_id = (select private.my_family_id()) or (select private.my_role()) = 'admin');

create policy "estanques visibles para usuarios" on public.tanks for select to authenticated
  using (true);

create policy "lecturas visibles para usuarios" on public.level_readings for select to authenticated
  using (true);

create policy "retiros propios o admin" on public.withdrawals for select to authenticated
  using (family_id = (select private.my_family_id()) or (select private.my_role()) = 'admin');

create policy "alertas para gestores" on public.alerts for select to authenticated
  using ((select private.my_role()) in ('admin', 'municipal'));

create policy "recargas para gestores" on public.refill_requests for select to authenticated
  using ((select private.my_role()) in ('admin', 'municipal'));

-- ---------------------------------------------------------------------------
-- Funciones de negocio (solo service_role). Errores: RAISE con el código en el mensaje.
-- ---------------------------------------------------------------------------

-- Cuota vigente de una familia, bloqueada para actualizar.
create function public.current_quota_for_update(p_family_id bigint) returns public.quotas
language plpgsql security definer set search_path = '' as $$
declare
  q public.quotas;
begin
  select * into q from public.quotas
   where family_id = p_family_id and period_start <= now() and period_end > now()
   for update;
  if not found then
    raise exception 'NO_ACTIVE_QUOTA';
  end if;
  return q;
end;
$$;

create function public.authorize_withdrawal(
  p_family_id bigint, p_tank_id bigint, p_liters numeric, p_user_id uuid
) returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  fam public.families;
  t   public.tanks;
  q   public.quotas;
  w   public.withdrawals;
begin
  if p_liters <= 0 then raise exception 'BAD_LITERS'; end if;

  select * into fam from public.families where id = p_family_id;
  if not found or fam.status <> 'approved' then raise exception 'FAMILY_NOT_APPROVED'; end if;

  select * into t from public.tanks where id = p_tank_id for update;
  if not found then raise exception 'TANK_NOT_FOUND'; end if;
  if t.status <> 'available' then raise exception 'TANK_UNAVAILABLE'; end if;
  if t.device_last_seen_at is null or t.device_last_seen_at < now() - interval '35 seconds' then
    raise exception 'DEVICE_OFFLINE';
  end if;
  if t.level_backup_low then raise exception 'TANK_CRITICAL'; end if;
  if t.level_volume_l is not null and t.level_volume_l < p_liters then
    raise exception 'INSUFFICIENT_TANK_LEVEL';
  end if;
  if exists (select 1 from public.withdrawals
              where tank_id = p_tank_id and status in ('authorized', 'dispensing')) then
    raise exception 'TANK_BUSY';
  end if;

  q := public.current_quota_for_update(p_family_id);
  if q.allocated_l - q.used_l - q.reserved_l < p_liters then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.quotas set reserved_l = reserved_l + p_liters where id = q.id;

  insert into public.withdrawals (family_id, tank_id, quota_id, requested_by, requested_l, target_ms, level_before_l)
  values (p_family_id, p_tank_id, q.id, p_user_id, p_liters,
          least(60000, ceil(p_liters / t.flow_lps * 1000))::integer, t.level_volume_l)
  returning * into w;

  return w;
end;
$$;

create function public.start_withdrawal(p_id bigint) returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  w public.withdrawals;
begin
  update public.withdrawals set status = 'dispensing', started_at = now(), progress_ms = 0
   where id = p_id and status = 'authorized'
   returning * into w;
  if found then
    update public.tanks set status = 'dispensing' where id = w.tank_id;
  else
    select * into w from public.withdrawals where id = p_id;
  end if;
  return w;
end;
$$;

-- Cierra un retiro: descuenta lo entregado (estimado) y libera la reserva.
create function public.finish_withdrawal(
  p_id bigint, p_open_ms integer, p_close_reason text, p_delivered_l numeric
) returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  w public.withdrawals;
  delivered numeric;
begin
  select * into w from public.withdrawals where id = p_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if w.status not in ('authorized', 'dispensing') then return w; end if;  -- idempotente

  delivered := greatest(0, least(p_delivered_l, w.requested_l));

  update public.quotas
     set reserved_l = greatest(0, reserved_l - w.requested_l),
         used_l = used_l + delivered
   where id = w.quota_id;

  update public.withdrawals
     set status = case when p_close_reason in ('TARGET', 'STOP') then 'completed' else 'failed' end,
         open_ms = p_open_ms,
         progress_ms = p_open_ms,
         delivered_l = round(delivered, 1),
         close_reason = p_close_reason,
         finished_at = now()
   where id = p_id
   returning * into w;

  update public.tanks set status = 'available' where id = w.tank_id and status = 'dispensing';

  if w.status = 'failed' then
    insert into public.alerts (tank_id, type, message)
    values (w.tank_id, 'dispense_failed',
            format('Retiro %s interrumpido (%s). Entregado ≈ %s L (estimado).', w.id, p_close_reason, w.delivered_l));
  end if;
  return w;
end;
$$;

-- Rechazo antes de abrir la válvula: solo libera la reserva.
create function public.reject_withdrawal(p_id bigint, p_reason text) returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  w public.withdrawals;
begin
  select * into w from public.withdrawals where id = p_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if w.status <> 'authorized' then return w; end if;

  update public.quotas set reserved_l = greatest(0, reserved_l - w.requested_l) where id = w.quota_id;
  update public.withdrawals
     set status = 'failed', close_reason = p_reason, delivered_l = 0, finished_at = now()
   where id = p_id
   returning * into w;
  return w;
end;
$$;

-- Limpieza perezosa (Vercel Hobby no tiene cron frecuente): se llama desde la API.
-- authorized sin ACK en 30 s => rechazado. dispensing sin DONE pasado el tope => se cierra
-- descontando lo solicitado (conservador: no sabemos cuánto salió) y se alerta.
create function public.expire_stale_withdrawals() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from public.withdrawals
            where status = 'authorized' and created_at < now() - interval '30 seconds' loop
    perform public.reject_withdrawal(r.id, 'NO_ACK');
    n := n + 1;
  end loop;
  for r in select id, target_ms, requested_l from public.withdrawals
            where status = 'dispensing'
              and started_at < now() - make_interval(secs => target_ms / 1000.0 + 60) loop
    perform public.finish_withdrawal(r.id, r.target_ms, 'NO_DONE', r.requested_l);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Registra telemetría ya convertida a litros por la API.
create function public.record_level(
  p_tank_id bigint, p_distance_mm integer, p_volume_l numeric, p_percent numeric,
  p_backup_raw integer, p_backup_low boolean, p_error text, p_simulated boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tanks;
  critical boolean;
begin
  update public.tanks set
    level_volume_l    = case when p_error is null then p_volume_l else level_volume_l end,
    level_percent     = case when p_error is null then p_percent else level_percent end,
    level_distance_mm = case when p_error is null then p_distance_mm else level_distance_mm end,
    level_backup_low  = p_backup_low,
    level_error       = p_error,
    level_measured_at = now(),
    level_simulated   = p_simulated,
    device_last_seen_at = now()
  where id = p_tank_id
  returning * into t;
  if not found then raise exception 'TANK_NOT_FOUND'; end if;

  -- Historial muestreado cada 30 s.
  if not exists (select 1 from public.level_readings
                  where tank_id = p_tank_id and measured_at > now() - interval '30 seconds') then
    insert into public.level_readings (tank_id, distance_mm, volume_l, percent, backup_raw, backup_low, error, simulated)
    values (p_tank_id, p_distance_mm, p_volume_l, p_percent, p_backup_raw, p_backup_low, p_error, p_simulated);
  end if;

  -- Verificación cruzada: nivel después del último retiro terminado.
  if p_error is null then
    update public.withdrawals
       set level_after_l = p_volume_l,
           level_delta_l = level_before_l - p_volume_l
     where tank_id = p_tank_id and status in ('completed', 'failed') and level_after_l is null
       and level_before_l is not null
       and finished_at between now() - interval '60 seconds' and now() - interval '3 seconds';
  end if;

  -- Alerta de nivel crítico (una abierta por estanque) y resolución con histéresis de 5 puntos.
  critical := coalesce(p_backup_low, false) or (p_error is null and p_percent < t.critical_percent);
  if critical then
    if not exists (select 1 from public.alerts
                    where tank_id = p_tank_id and type = 'critical_level' and status <> 'resolved') then
      insert into public.alerts (tank_id, type, message)
      values (p_tank_id, 'critical_level',
              format('%s en nivel crítico: ≈ %s%% (estimado).', t.name, coalesce(p_percent::text, '?')));
    end if;
  elsif p_error is null and p_percent >= t.critical_percent + 5 then
    update public.alerts set status = 'resolved', resolved_at = now()
     where tank_id = p_tank_id and type = 'critical_level' and status <> 'resolved';
  end if;
end;
$$;

-- Solo la API (service_role) ejecuta funciones de negocio.
revoke execute on function
  public.current_quota_for_update(bigint),
  public.authorize_withdrawal(bigint, bigint, numeric, uuid),
  public.start_withdrawal(bigint),
  public.finish_withdrawal(bigint, integer, text, numeric),
  public.reject_withdrawal(bigint, text),
  public.expire_stale_withdrawals(),
  public.record_level(bigint, integer, numeric, numeric, integer, boolean, text, boolean),
  public.handle_new_user()
from public, anon, authenticated;

grant execute on function
  public.current_quota_for_update(bigint),
  public.authorize_withdrawal(bigint, bigint, numeric, uuid),
  public.start_withdrawal(bigint),
  public.finish_withdrawal(bigint, integer, text, numeric),
  public.reject_withdrawal(bigint, text),
  public.expire_stale_withdrawals(),
  public.record_level(bigint, integer, numeric, numeric, integer, boolean, text, boolean)
to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: la app escucha cambios (respetando RLS).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.tanks, public.withdrawals, public.alerts, public.refill_requests;
