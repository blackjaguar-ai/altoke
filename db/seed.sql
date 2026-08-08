INSERT INTO rooms (id, product_name, product_desc, photo_url, list_price, floor_price, agent_tone)
VALUES
 ('bici-monark','Bicicleta Monark aro 26','Usada 2 años, llantas nuevas, frenos revisados. Entrego en Lima.',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1200', 800, 450,
  'criollo, firme, con humor seco. No suplica.'),
 ('play-4','PlayStation 4 Slim 1TB','Con 2 mandos y 3 juegos. Todo funciona.',
  'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200', 950, 620,
  'directo, técnico, poco charlatán.')
ON CONFLICT (id) DO NOTHING;
