ALTER TABLE purchase_request_items
  DROP INDEX IF EXISTS idx_purchase_items_marketplace;

ALTER TABLE purchase_request_items
  DROP COLUMN IF EXISTS marketplace_item_id,
  DROP COLUMN IF EXISTS marketplace_title,
  DROP COLUMN IF EXISTS marketplace_price,
  DROP COLUMN IF EXISTS marketplace_currency,
  DROP COLUMN IF EXISTS marketplace_thumbnail,
  DROP COLUMN IF EXISTS marketplace_permalink,
  DROP COLUMN IF EXISTS marketplace_seller_id,
  DROP COLUMN IF EXISTS marketplace_seller_name,
  DROP COLUMN IF EXISTS marketplace_snapshot_at,
  DROP COLUMN IF EXISTS marketplace_lookup_status,
  DROP COLUMN IF EXISTS marketplace_lookup_error;
