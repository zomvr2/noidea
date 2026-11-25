-- NoIdea: recargas por camión aljibe al estilo despacho (ver docs/recargas.md).
-- requested ──claim──> scheduled ──start──> in_transit ──arrive (NFC)──> in_transit + arrived_at
--   ──deliver──> delivered. cancel en cualquier estado abierto; release devuelve a requested.
-- El volumen entregado se estima por la diferencia de nivel (HC-SR04): measurement_method = 'estimated_level'.

alter table public.tanks
  add column refill_threshold_percent numeric(5, 2) not null default 25
    check (refill_threshold_percent between 0 and 100);

alter table public.refill_requests
  add column source                text not null default 'manual' check (source in ('auto', 'manual')),
  add column assigned_to           uuid references auth.users (id),
  -- Nombre corto del municipal ("Juan P.") para mostrar a las familias (no pueden leer profiles ajenos).
  add column assigned_name         text,
  add column accepted_at           timestamptz,
  add column departed_at           timestamptz,
  add column arrived_at            timestamptz,
  add column delivered_at          timestamptz,
  add column cancelled_at          timestamptz,
  add column level_before_l        numeric(10, 1),
  add column level_after_l         numeric(10, 1),
  add column delivered_estimated_l numeric(10, 1),
  add column measurement_method    text check (measurement_method in ('estimated_level')),
  -- Última posición del municipal. Solo existe mientras va en camino (se borra al llegar o soltar).
  add column last_latitude         double precision check (last_latitude between -90 and 90),
  add column last_longitude        double precision check (last_longitude between -180 and 180),
  add column last_position_at      timestamptz,
  add column eta_s                 integer check (eta_s >= 0),
  add check ((last_latitude is null) = (last_longitude is null)),
  -- Tomada => tiene responsable.
  add check (status not in ('scheduled', 'in_transit') or assigned_to is not null);

-- Una sola solicitud abierta por estanque y una sola recarga activa por municipal.
create unique index refill_requests_one_open_per_tank
  on public.refill_requests (tank_id) where status in ('requested', 'scheduled', 'in_transit');
create unique index refill_requests_one_active_per_user
  on public.refill_requests (assigned_to) where status in ('scheduled', 'in_transit');

-- Las familias también ven las recargas (chip «Municipal en camino»): abiertas o entregadas hace < 2 h.
-- `notes` es visible para todos los usuarios: no escribir datos personales ahí.
drop policy "recargas para gestores" on public.refill_requests;
create policy "recargas visibles" on public.refill_requests for select to authenticated
  using (
    (select private.my_role()) in ('admin', 'municipal')
    or status in ('requested', 'scheduled', 'in_transit')
    or (status = 'delivered' and delivered_at > now() - interval '2 hours')
  );

-- ---------------------------------------------------------------------------
-- Funciones de negocio (solo service_role)
-- ---------------------------------------------------------------------------

-- Solicitud manual (admin/municipal). La automática la crea record_level.
create function public.request_refill(
  p_tank_id bigint, p_user_id uuid, p_volume_l numeric, p_notes text
) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  perform 1 from public.tanks where id = p_tank_id and deleted_at is null for update;
  if not found then raise exception 'TANK_NOT_FOUND'; end if;
  if exists (select 1 from public.refill_requests
              where tank_id = p_tank_id and status in ('requested', 'scheduled', 'in_transit')) then
    raise exception 'REFILL_ALREADY_OPEN';
  end if;
  insert into public.refill_requests (tank_id, source, requested_volume_l, notes, created_by)
  values (p_tank_id, 'manual', p_volume_l, p_notes, p_user_id)
  returning * into r;
  return r;
end;
$$;

-- Bloquea la recarga y valida que exista.
create function public.refill_for_update(p_id bigint) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  select * into r from public.refill_requests where id = p_id for update;
  if not found then raise exception 'REFILL_NOT_FOUND'; end if;
  return r;
end;
$$;

-- «Tomar recarga»: solo una persona puede tomarla (FOR UPDATE) y cada municipal lleva una a la vez.
create function public.claim_refill(p_id bigint, p_user_id uuid, p_name text) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  r := public.refill_for_update(p_id);
  if r.status in ('scheduled', 'in_transit') then
    if r.assigned_to = p_user_id then return r; end if;  -- idempotente
    raise exception 'REFILL_TAKEN';
  end if;
  if r.status <> 'requested' then raise exception 'INVALID_REFILL_STATE'; end if;
  if exists (select 1 from public.refill_requests
              where assigned_to = p_user_id and status in ('scheduled', 'in_transit')) then
    raise exception 'REFILL_ALREADY_ACTIVE';
  end if;

  update public.refill_requests
     set status = 'scheduled', assigned_to = p_user_id, assigned_name = p_name,
         accepted_at = now(), updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- Valida que la recarga esté asignada a quien actúa (admin puede actuar sobre cualquiera).
create function public.assert_refill_owner(r public.refill_requests, p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if r.status not in ('scheduled', 'in_transit') then raise exception 'INVALID_REFILL_STATE'; end if;
  if r.assigned_to is distinct from p_user_id and not p_is_admin then raise exception 'NOT_ASSIGNED'; end if;
end;
$$;

-- «Soltar»: vuelve a quedar disponible para otro municipal (p. ej. camión averiado).
create function public.release_refill(p_id bigint, p_user_id uuid, p_is_admin boolean)
returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  r := public.refill_for_update(p_id);
  perform public.assert_refill_owner(r, p_user_id, p_is_admin);
  update public.refill_requests
     set status = 'requested', assigned_to = null, assigned_name = null,
         accepted_at = null, departed_at = null, arrived_at = null, level_before_l = null,
         last_latitude = null, last_longitude = null, last_position_at = null, eta_s = null,
         updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- «Salir»: el municipal va en camino.
create function public.start_refill(p_id bigint, p_user_id uuid) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  r := public.refill_for_update(p_id);
  perform public.assert_refill_owner(r, p_user_id, false);
  if r.status = 'in_transit' then return r; end if;  -- idempotente
  update public.refill_requests
     set status = 'in_transit', departed_at = now(), updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- Posición en vivo del municipal (la API calcula la ETA). Solo en camino y antes de llegar.
create function public.update_refill_position(
  p_id bigint, p_user_id uuid, p_latitude double precision, p_longitude double precision, p_eta_s integer
) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  r := public.refill_for_update(p_id);
  perform public.assert_refill_owner(r, p_user_id, false);
  if r.status <> 'in_transit' or r.arrived_at is not null then raise exception 'INVALID_REFILL_STATE'; end if;
  update public.refill_requests
     set last_latitude = p_latitude, last_longitude = p_longitude, last_position_at = now(),
         eta_s = p_eta_s, updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- Llegada: la API ya validó la etiqueta NFC del estanque. Guarda el nivel antes de recargar.
create function public.arrive_refill(p_id bigint, p_user_id uuid) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
  lvl numeric;
begin
  r := public.refill_for_update(p_id);
  perform public.assert_refill_owner(r, p_user_id, false);
  if r.status <> 'in_transit' then raise exception 'INVALID_REFILL_STATE'; end if;
  if r.arrived_at is not null then return r; end if;  -- idempotente
  select level_volume_l into lvl from public.tanks where id = r.tank_id;
  update public.refill_requests
     set arrived_at = now(), level_before_l = lvl, eta_s = 0,
         last_latitude = null, last_longitude = null, last_position_at = null, updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- «Terminé»: entregado ≈ nivel después − nivel antes (estimado). record_level lo refina con las
-- lecturas del minuto siguiente (el agua tarda en asentarse).
create function public.confirm_refill_delivery(p_id bigint, p_user_id uuid) returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
  lvl numeric;
begin
  r := public.refill_for_update(p_id);
  perform public.assert_refill_owner(r, p_user_id, false);
  if r.status <> 'in_transit' or r.arrived_at is null then raise exception 'INVALID_REFILL_STATE'; end if;
  select level_volume_l into lvl from public.tanks where id = r.tank_id;
  update public.refill_requests
     set status = 'delivered', delivered_at = now(), level_after_l = lvl,
         delivered_estimated_l = case when lvl is null or level_before_l is null then null
                                      else round(greatest(0, lvl - level_before_l), 1) end,
         measurement_method = 'estimated_level', eta_s = null, updated_at = now()
   where id = p_id
   returning * into r;

  update public.alerts set status = 'resolved', resolved_at = now()
   where tank_id = r.tank_id and type = 'critical_level' and status <> 'resolved';
  return r;
end;
$$;

-- Cancelación (admin, o el municipal asignado / cualquier municipal si nadie la tomó).
create function public.cancel_refill(p_id bigint, p_user_id uuid, p_is_admin boolean)
returns public.refill_requests
language plpgsql security definer set search_path = '' as $$
declare
  r public.refill_requests;
begin
  r := public.refill_for_update(p_id);
  if r.status not in ('requested', 'scheduled', 'in_transit') then raise exception 'INVALID_REFILL_STATE'; end if;
  if r.status <> 'requested' and r.assigned_to is distinct from p_user_id and not p_is_admin then
    raise exception 'NOT_ASSIGNED';
  end if;
  update public.refill_requests
     set status = 'cancelled', cancelled_at = now(),
         last_latitude = null, last_longitude = null, last_position_at = null, eta_s = null,
         updated_at = now()
   where id = p_id
   returning * into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_level: igual que antes + solicitud automática de recarga + verificación de la entrega.
-- ---------------------------------------------------------------------------

create or replace function public.record_level(
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

    -- Recarga entregada hace < 60 s: se queda con el nivel más alto visto (el agua se asienta).
    update public.refill_requests
       set level_after_l = p_volume_l,
           delivered_estimated_l = round(greatest(0, p_volume_l - level_before_l), 1),
           updated_at = now()
     where tank_id = p_tank_id and status = 'delivered' and level_before_l is not null
       and delivered_at > now() - interval '60 seconds'
       and (level_after_l is null or p_volume_l > level_after_l);
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

  -- Solicitud automática de recarga bajo el umbral (una abierta por estanque).
  if t.deleted_at is null
     and (coalesce(p_backup_low, false) or (p_error is null and p_percent < t.refill_threshold_percent))
     and not exists (select 1 from public.refill_requests
                      where tank_id = p_tank_id and status in ('requested', 'scheduled', 'in_transit')) then
    insert into public.refill_requests (tank_id, source, requested_volume_l, notes)
    values (p_tank_id, 'auto',
            case when t.level_volume_l is null then null
                 else round(greatest(0, t.capacity_l - t.level_volume_l), 1) end,
            format('Automática: nivel ≈ %s%% (estimado).', coalesce(p_percent::text, '?')));
  end if;
end;
$$;

revoke execute on function
  public.request_refill(bigint, uuid, numeric, text),
  public.refill_for_update(bigint),
  public.claim_refill(bigint, uuid, text),
  public.assert_refill_owner(public.refill_requests, uuid, boolean),
  public.release_refill(bigint, uuid, boolean),
  public.start_refill(bigint, uuid),
  public.update_refill_position(bigint, uuid, double precision, double precision, integer),
  public.arrive_refill(bigint, uuid),
  public.confirm_refill_delivery(bigint, uuid),
  public.cancel_refill(bigint, uuid, boolean),
  public.record_level(bigint, integer, numeric, numeric, integer, boolean, text, boolean)
from public, anon, authenticated;

grant execute on function
  public.request_refill(bigint, uuid, numeric, text),
  public.refill_for_update(bigint),
  public.claim_refill(bigint, uuid, text),
  public.assert_refill_owner(public.refill_requests, uuid, boolean),
  public.release_refill(bigint, uuid, boolean),
  public.start_refill(bigint, uuid),
  public.update_refill_position(bigint, uuid, double precision, double precision, integer),
  public.arrive_refill(bigint, uuid),
  public.confirm_refill_delivery(bigint, uuid),
  public.cancel_refill(bigint, uuid, boolean),
  public.record_level(bigint, integer, numeric, numeric, integer, boolean, text, boolean)
to service_role;
