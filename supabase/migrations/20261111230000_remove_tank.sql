-- NoIdea: eliminación de estanques por un admin (proceso inverso a «ubicar»: escanea la etiqueta NFC
-- junto al estanque y confirma). Es un borrado lógico: el historial de retiros, lecturas y alertas
-- sigue apuntando al estanque. La etiqueta queda libre para registrar otro estanque.

alter table public.tanks
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id);

-- La etiqueta solo es única entre estanques activos.
alter table public.tanks drop constraint tanks_nfc_tag_uid_key;
create unique index tanks_nfc_tag_uid_active_idx on public.tanks (nfc_tag_uid) where deleted_at is null;

-- RLS sigue mostrando las filas eliminadas: así Realtime entrega el UPDATE con deleted_at y la app
-- quita el estanque del mapa. La app filtra deleted_at is null al cargar.

create function public.remove_tank(p_tank_id bigint, p_user_id uuid) returns public.tanks
language plpgsql security definer set search_path = '' as $$
declare
  t public.tanks;
begin
  select * into t from public.tanks where id = p_tank_id and deleted_at is null for update;
  if not found then raise exception 'TANK_NOT_FOUND'; end if;
  if exists (select 1 from public.withdrawals
              where tank_id = p_tank_id and status in ('authorized', 'dispensing')) then
    raise exception 'TANK_BUSY';
  end if;

  -- Revoca el dispensador: sin fila en devices el ESP32 ya no puede firmar telemetría ni recibir órdenes.
  delete from public.devices where tank_id = p_tank_id;

  update public.alerts set status = 'resolved', resolved_at = now()
   where tank_id = p_tank_id and status <> 'resolved';
  update public.refill_requests set status = 'cancelled', updated_at = now()
   where tank_id = p_tank_id and status in ('requested', 'scheduled', 'in_transit');

  -- status 'offline' hace que authorize_withdrawal rechace cualquier retiro (TANK_UNAVAILABLE).
  update public.tanks
     set deleted_at = now(), deleted_by = p_user_id, status = 'offline'
   where id = p_tank_id
   returning * into t;
  return t;
end;
$$;

revoke execute on function public.remove_tank(bigint, uuid) from public, anon, authenticated;
grant execute on function public.remove_tank(bigint, uuid) to service_role;
