-- Color identificativo del empleado en el calendario (Bloque 6).
-- Mismo formato que `services.color_hex`: '#RRGGBB' opcional.

alter table employees
  add column color_hex text
    check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');

-- Backfill: paleta fija de 6 tonos rotando por display_order para que los
-- empleados ya existentes lleguen al calendario con colores distinguibles.
-- Empleados creados después de esta migración entran con NULL y la UI les
-- asigna un color por defecto al editar.
with palette as (
  select * from (values
    (0, '#4F46E5'),
    (1, '#0EA5E9'),
    (2, '#DB2777'),
    (3, '#F59E0B'),
    (4, '#10B981'),
    (5, '#8B5CF6')
  ) as p(idx, hex)
)
update employees e
   set color_hex = p.hex
  from palette p
 where e.color_hex is null
   and p.idx = (e.display_order % 6);
