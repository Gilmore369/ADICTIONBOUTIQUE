-- Migration: Update seed clients to Trujillo coordinates
-- Purpose: Replace Lima test coordinates with Trujillo addresses for
--          realistic route optimization testing in the debtors map.
-- Trujillo center: lat -8.1120, lng -79.0270

UPDATE public.clients SET
  address = 'Av. España 234, Centro Histórico',
  lat = -8.1067, lng = -79.0266
WHERE id = 'cc000001-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Calle Los Laureles 12, Miraflores',
  lat = -8.1047, lng = -79.0232
WHERE id = 'cc000004-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. América Norte 456, Trujillo',
  lat = -8.0980, lng = -79.0261
WHERE id = 'cc000007-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Jr. Independencia 901, Centro Trujillo',
  lat = -8.1120, lng = -79.0270
WHERE id = 'cc000010-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Fátima 789, El Porvenir',
  lat = -8.0668, lng = -79.0006
WHERE id = 'cc000013-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Víctor Larco 567, Víctor Larco',
  lat = -8.1378, lng = -79.0428
WHERE id = 'cc000015-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Jr. Pizarro 456, Centro Trujillo',
  lat = -8.1105, lng = -79.0282
WHERE id = 'cc000002-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Húsares de Junín 567, La Esperanza',
  lat = -8.0778, lng = -79.0500
WHERE id = 'cc000005-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Mansiche 123, Urb. Los Granados',
  lat = -8.1100, lng = -79.0350
WHERE id = 'cc000011-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Jr. San Martín 234, Centro Trujillo',
  lat = -8.1089, lng = -79.0245
WHERE id = 'cc000014-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Calle Ayacucho 345, Florencia de Mora',
  lat = -8.0842, lng = -79.0094
WHERE id = 'cc000008-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Universitaria 678, La Esperanza',
  lat = -8.0800, lng = -79.0480
WHERE id = 'cc000009-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Av. Perú 789, La Esperanza',
  lat = -8.0730, lng = -79.0520
WHERE id = 'cc000003-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Jr. Orbegoso 890, Centro Trujillo',
  lat = -8.1130, lng = -79.0278
WHERE id = 'cc000006-0000-0000-0000-000000000000';

UPDATE public.clients SET
  address = 'Calle Bolívar 456, Miraflores Trujillo',
  lat = -8.1050, lng = -79.0218
WHERE id = 'cc000012-0000-0000-0000-000000000000';

-- Also update the fresh_seed INSERT to use Trujillo on future reseeds
-- (handled by updating ON CONFLICT clause in the seed migration)
