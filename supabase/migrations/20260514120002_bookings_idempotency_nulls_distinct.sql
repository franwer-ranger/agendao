-- La constraint original usaba `nulls not distinct`, lo que trata varios NULL
-- como iguales y bloquea cualquier segundo insert sin idempotency_key. La
-- intención del campo es deduplicar reintentos cuando el cliente envía una
-- clave; cuando no la envía (NULL), cada reserva debe ser independiente.

alter table bookings drop constraint bookings_idempotency_unique;

alter table bookings
  add constraint bookings_idempotency_unique
  unique nulls distinct (idempotency_key);
