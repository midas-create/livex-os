-- v15 : Ajout de planned_delivery_date sur orders
-- Date de livraison planifiée calculée à la validation admin :
--   confirmé avant 12 h → J+1 ; confirmé à 12 h ou après → J+2

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS planned_delivery_date date;

COMMENT ON COLUMN orders.planned_delivery_date IS
  'Date de livraison estimée calculée à la validation de la commande (J+1 avant midi, J+2 après midi)';
