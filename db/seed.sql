-- ============================================================================
-- SEED AMPLIADO — 30 salas, 5 categorías, mezcla open/sold.
-- ----------------------------------------------------------------------------
-- Las 2 salas originales (bici-monark, play-4) quedan EXACTAS a como estaban,
-- solo les agrego category porque el schema la exige con default 'otros' y
-- ambas son mejores en su categoría real. ON CONFLICT (id) DO NOTHING en las
-- dos hace que si ya existen en tu Postgres (probable, están en prod), este
-- script no las toca ni les pisa el highest_bid actual.
--
-- FOTOS: uso picsum.photos/seed/<id> — placeholder determinístico que SIEMPRE
-- carga (no me arriesgo a un ícono roto en cámara con IDs de Unsplash que no
-- puedo verificar uno por uno desde acá). No son fotos del producto real.
-- Es un problema resuelto a medias a propósito: mejor 30 salas con imagen
-- gris consistente que 10 con foto bonita y 20 rotas. Swap real abajo.
--
-- SOLD: 5 salas ya cerradas (una por categoría) para que "últimas ventas" no
-- aparezca vacío en el home ni en la demo.
-- HOT: 4 salas open con highest_bid > 0 para que el termómetro y el sort por
-- "hot" tengan algo que mostrar sin depender de que el jurado oferte primero.
-- ============================================================================

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('bici-monark','Bicicleta Monark aro 26','Usada 2 años, llantas nuevas, frenos revisados. Entrego en Lima.',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200', 'vehiculos', 800, 450,
  'criollo, firme, con humor seco. No suplica.'),
 ('play-4','PlayStation 4 Slim 1TB','Con 2 mandos y 3 juegos. Todo funciona.',
  'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200', 'tecnologia', 950, 620,
  'directo, técnico, poco charlatán.')
ON CONFLICT (id) DO NOTHING;

-- ── VEHÍCULOS ────────────────────────────────────────────────────────────
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('moto-pulsar-200','Moto Bajaj Pulsar 200 NS','2019, papeles al día, SOAT vigente, cadena y kit de arrastre nuevo.',
  'https://picsum.photos/seed/moto-pulsar-200/1200/800', 'vehiculos', 6800, 4200,
  'mecánico de barrio, directo, sabe de motores, no regala nada.'),
 ('scooter-xiaomi','Scooter eléctrico Xiaomi M365','Batería original al 90%, con cargador. Ideal para movilidad urbana.',
  'https://picsum.photos/seed/scooter-xiaomi/1200/800', 'vehiculos', 1200, 750,
  'directo, práctico, habla en soles por km recorrido.'),
 ('bici-bmx-freestyle','Bicicleta BMX freestyle','Aro 20, cuadro cromoly, pegs incluidos. Lista para trucos.',
  'https://picsum.photos/seed/bici-bmx-freestyle/1200/800', 'vehiculos', 550, 320,
  'joven, casual, conoce la escena BMX de memoria.'),
 ('moto-cross-ktm','Moto cross KTM 250 SX','Uso deportivo, mantenimiento al día, llantas de tierra nuevas.',
  'https://picsum.photos/seed/moto-cross-ktm/1200/800', 'vehiculos', 9500, 6200,
  'mecánico de barrio, firme, cero paciencia con ofertas ridículas.')
ON CONFLICT (id) DO NOTHING;

-- Una vendida y una con actividad, para que el grid no se vea plano
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle, winner_handle, final_price, closes_at)
VALUES
 ('auto-yaris-2015','Toyota Yaris 2015 Sedán','Único dueño, mantenimientos en concesionario, papeles saneados.',
  'https://picsum.photos/seed/auto-yaris-2015/1200/800', 'vehiculos', 32000, 21000,
  'mecánico de barrio, directo, sabe de motores, no regala nada.',
  'sold', 24500, 'jorge_m', 'jorge_m', 24500, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ── TECNOLOGÍA ───────────────────────────────────────────────────────────
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('audifonos-sony-xm4','Audífonos Sony WH-1000XM4','Cancelación de ruido, con case y cable. Poco uso, como nuevos.',
  'https://picsum.photos/seed/audifonos-sony-xm4/1200/800', 'tecnologia', 850, 520,
  'técnico, preciso, cero relleno, habla de specs.'),
 ('camara-canon-t7','Cámara Canon EOS Rebel T7','Con lente 18-55mm, memoria 32GB y bolso incluido.',
  'https://picsum.photos/seed/camara-canon-t7/1200/800', 'tecnologia', 1600, 980,
  'técnico, preciso, cero relleno, habla de specs.'),
 ('smartwatch-garmin-fenix','Smartwatch Garmin Fenix 6','GPS, resistente al agua, batería de 2 semanas. Caja original.',
  'https://picsum.photos/seed/smartwatch-garmin-fenix/1200/800', 'tecnologia', 1900, 1200,
  'técnico, preciso, cero relleno, habla de specs.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle)
VALUES
 ('laptop-asus-tuf','Laptop gamer ASUS TUF RTX 3060','16GB RAM, 512GB SSD, pantalla 144Hz. Corre todo en alto.',
  'https://picsum.photos/seed/laptop-asus-tuf/1200/800', 'tecnologia', 4200, 2900,
  'técnico, preciso, cero relleno, habla de specs.',
  'open', 3300, 'user_452'),
 ('nintendo-switch-oled','Nintendo Switch OLED','Con dock, 2 joycons y 3 juegos físicos. Pantalla sin rayones.',
  'https://picsum.photos/seed/nintendo-switch-oled/1200/800', 'tecnologia', 1350, 900,
  'técnico, preciso, cero relleno, habla de specs.',
  'open', 1050, 'gamer_lima')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle, winner_handle, final_price, closes_at)
VALUES
 ('iphone-13-128','iPhone 13 128GB','Batería al 89%, sin detalles en pantalla, con caja y cargador.',
  'https://picsum.photos/seed/iphone-13-128/1200/800', 'tecnologia', 2100, 1450,
  'técnico, preciso, cero relleno, habla de specs.',
  'sold', 1750, 'renzo_v', 'renzo_v', 1750, now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;

-- ── HOGAR ────────────────────────────────────────────────────────────────
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('sofa-3cuerpos-gris','Sofá 3 cuerpos gris','Tela antimanchas, estructura de madera, poco uso.',
  'https://picsum.photos/seed/sofa-3cuerpos-gris/1200/800', 'hogar', 1800, 1100,
  'ama de casa práctica, cálida pero firme, negocia como comadre.'),
 ('refrigeradora-lg-380','Refrigeradora LG No Frost 380L','Dispensador de agua, poco consumo eléctrico. Impecable por dentro.',
  'https://picsum.photos/seed/refrigeradora-lg-380/1200/800', 'hogar', 2400, 1600,
  'ama de casa práctica, cálida pero firme, negocia como comadre.'),
 ('lavadora-samsung-18kg','Lavadora Samsung 18kg','Carga superior, programas eco, motor sin ruido.',
  'https://picsum.photos/seed/lavadora-samsung-18kg/1200/800', 'hogar', 1700, 1050,
  'ama de casa práctica, cálida pero firme, negocia como comadre.'),
 ('taladro-bosch-percutor','Taladro percutor Bosch','Con maletín, brocas incluidas y batería de repuesto.',
  'https://picsum.photos/seed/taladro-bosch-percutor/1200/800', 'hogar', 480, 290,
  'práctico, sabe de ferretería, va al grano.'),
 ('comedor-6-sillas','Juego de comedor 6 sillas','Mesa de madera maciza, sillas tapizadas, sin manchas.',
  'https://picsum.photos/seed/comedor-6-sillas/1200/800', 'hogar', 2200, 1400,
  'ama de casa práctica, cálida pero firme, negocia como comadre.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle, winner_handle, final_price, closes_at)
VALUES
 ('licuadora-oster-industrial','Licuadora industrial Oster','Jarra de vidrio, motor de 3 velocidades, ideal para negocio.',
  'https://picsum.photos/seed/licuadora-oster-industrial/1200/800', 'hogar', 320, 190,
  'ama de casa práctica, cálida pero firme, negocia como comadre.',
  'sold', 260, 'lucia_r', 'lucia_r', 260, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ── MODA ─────────────────────────────────────────────────────────────────
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('casaca-cuero-genuino','Casaca de cuero genuino','Talla M, corte biker, cuero legítimo sin desgaste.',
  'https://picsum.photos/seed/casaca-cuero-genuino/1200/800', 'moda', 680, 400,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.'),
 ('reloj-seiko-5','Reloj automático Seiko 5','Correa de acero, resistente al agua, caja y garantía vigente.',
  'https://picsum.photos/seed/reloj-seiko-5/1200/800', 'moda', 1100, 700,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.'),
 ('mochila-north-face','Mochila urbana North Face','Impermeable, compartimento para laptop 15", poco uso.',
  'https://picsum.photos/seed/mochila-north-face/1200/800', 'moda', 380, 220,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.'),
 ('cartera-cuero-mujer','Cartera de cuero mujer','Cuero legítimo, forro interno, cierre reforzado.',
  'https://picsum.photos/seed/cartera-cuero-mujer/1200/800', 'moda', 320, 180,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle)
VALUES
 ('jordan-1-talla-42','Zapatillas Air Jordan 1 talla 42','Colorway original, caja incluida, suela sin desgaste.',
  'https://picsum.photos/seed/jordan-1-talla-42/1200/800', 'moda', 950, 600,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.',
  'open', 720, 'sneakerhead21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle, winner_handle, final_price, closes_at)
VALUES
 ('lentes-rayban-aviator','Lentes de sol Ray-Ban Aviator','Originales con estuche y paño, sin rayones en el cristal.',
  'https://picsum.photos/seed/lentes-rayban-aviator/1200/800', 'moda', 450, 260,
  'hypebeast, casual, sabe lo que vale el producto, no se deja bajonear.',
  'sold', 340, 'daniela_p', 'daniela_p', 340, now() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;

-- ── OTROS ────────────────────────────────────────────────────────────────
INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone)
VALUES
 ('guitarra-fender-strato','Guitarra eléctrica Fender Stratocaster','Mexicana, trastes en buen estado, con funda incluida.',
  'https://picsum.photos/seed/guitarra-fender-strato/1200/800', 'otros', 3200, 2100,
  'coleccionista apasionado, cuenta la historia del producto, firme en el precio.'),
 ('teclado-yamaha-psr','Teclado musical Yamaha PSR','61 teclas, ritmos y voces integradas, con atril y adaptador.',
  'https://picsum.photos/seed/teclado-yamaha-psr/1200/800', 'otros', 1400, 850,
  'coleccionista apasionado, cuenta la historia del producto, firme en el precio.'),
 ('maquina-coser-singer','Máquina de coser Singer','Mecánica, varias puntadas, mueble de madera incluido.',
  'https://picsum.photos/seed/maquina-coser-singer/1200/800', 'otros', 650, 380,
  'práctico, directo, conoce el oficio.'),
 ('vinilos-coleccion-40','Colección de 40 vinilos clásicos','Rock y salsa de los 70-80s, portadas en buen estado.',
  'https://picsum.photos/seed/vinilos-coleccion-40/1200/800', 'otros', 900, 550,
  'coleccionista apasionado, cuenta la historia del producto, firme en el precio.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, product_name, product_desc, photo_url, category, list_price, floor_price, agent_tone,
                    status, highest_bid, highest_handle)
VALUES
 ('set-pesas-100kg','Set de pesas y barra 100kg','Discos de fierro fundido, barra olímpica, poco uso.',
  'https://picsum.photos/seed/set-pesas-100kg/1200/800', 'otros', 1200, 750,
  'práctico, directo, sabe de gimnasio casero.',
  'open', 880, 'fit_carlos')
ON CONFLICT (id) DO NOTHING;
