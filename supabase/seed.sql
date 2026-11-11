-- Datos ficticios del prototipo. NO usar con datos reales.
-- Usuarios de prueba: se crean con `npm run users:create -w api` (requieren Supabase Auth).

insert into public.tanks (name, nfc_tag_uid, capacity_l, empty_distance_mm, full_distance_mm, flow_lps, critical_percent)
values ('Estanque prototipo', '00000000', 8, 250, 60, 0.05, 20);

-- ESP32 del estanque 1. Consultar id y secreto (solo con service_role / panel SQL):
--   select id, secret from public.devices;
insert into public.devices (tank_id)
select id from public.tanks where nfc_tag_uid = '00000000';

insert into public.families (name, sector, members, status) values
  ('Familia Rojas', 'Sector Norte', 4, 'approved'),
  ('Familia Araya', 'Sector Sur',   2, 'approved'),
  ('Familia Tapia', 'Sector Norte', 5, 'pending');

-- Cuotas pequeñas a escala del prototipo (litros), período = mes en curso.
insert into public.quotas (family_id, period_start, period_end, allocated_l)
select f.id, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
       case f.name when 'Familia Rojas' then 3 else 1.5 end
from public.families f where f.status = 'approved';
