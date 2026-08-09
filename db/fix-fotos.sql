-- ============================================================================
-- FIX DE FOTOS — reemplaza picsum (random) por loremflickr (keyword real).
-- ----------------------------------------------------------------------------
-- Solo toca las 28 salas nuevas por id. bici-monark y play-4 no aparecen acá
-- a propósito: ya tenían foto correcta desde antes de este seed.
--
-- loremflickr.com/WIDTH/HEIGHT/keyword,keyword2 — pull real de Flickr por
-- tag, licencia Creative Commons. Sigue activo (Flickr levantó el límite de
-- API a fines de 2025). Es la misma categoría de solución que Unsplash
-- Source, pero sin que yo tenga que adivinar un ID de foto específico.
--
-- Nota honesta: sigue siendo "foto de stock por keyword", no la foto real
-- del producto que estás vendiendo. Para las 4 que aparecen en "hot"
-- (highest_bid > 0) igual te recomiendo subir la foto real cuando puedas —
-- esas las ve el jurado sin que navegues ahí.
-- ============================================================================

-- VEHÍCULOS
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/motorcycle,street' WHERE id = 'moto-pulsar-200';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/electric,scooter' WHERE id = 'scooter-xiaomi';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/bmx,bicycle' WHERE id = 'bici-bmx-freestyle';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/motocross,motorcycle' WHERE id = 'moto-cross-ktm';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/sedan,car' WHERE id = 'auto-yaris-2015';

-- TECNOLOGÍA
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/headphones' WHERE id = 'audifonos-sony-xm4';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/dslr,camera' WHERE id = 'camara-canon-t7';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/smartwatch' WHERE id = 'smartwatch-garmin-fenix';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/laptop,gaming' WHERE id = 'laptop-asus-tuf';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/handheld,gaming' WHERE id = 'nintendo-switch-oled';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/iphone,smartphone' WHERE id = 'iphone-13-128';

-- HOGAR
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/sofa,livingroom' WHERE id = 'sofa-3cuerpos-gris';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/refrigerator,kitchen' WHERE id = 'refrigeradora-lg-380';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/washingmachine' WHERE id = 'lavadora-samsung-18kg';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/powerdrill,tool' WHERE id = 'taladro-bosch-percutor';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/diningtable,chairs' WHERE id = 'comedor-6-sillas';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/blender,kitchen' WHERE id = 'licuadora-oster-industrial';

-- MODA
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/leatherjacket' WHERE id = 'casaca-cuero-genuino';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/wristwatch' WHERE id = 'reloj-seiko-5';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/backpack' WHERE id = 'mochila-north-face';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/leather,handbag' WHERE id = 'cartera-cuero-mujer';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/sneakers,shoes' WHERE id = 'jordan-1-talla-42';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/aviator,sunglasses' WHERE id = 'lentes-rayban-aviator';

-- OTROS
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/electricguitar' WHERE id = 'guitarra-fender-strato';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/keyboard,piano' WHERE id = 'teclado-yamaha-psr';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/sewingmachine' WHERE id = 'maquina-coser-singer';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/vinyl,records' WHERE id = 'vinilos-coleccion-40';
UPDATE rooms SET photo_url = 'https://loremflickr.com/1200/800/barbell,weights' WHERE id = 'set-pesas-100kg';
