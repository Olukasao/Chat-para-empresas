CREATE TABLE IF NOT EXISTS purchase_permission_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  permissions_json LONGTEXT NOT NULL,
  is_builtin TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_profile_empresa_slug (empresa_id, slug),
  INDEX idx_purchase_profiles_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  subject_type ENUM('user', 'role', 'department') NOT NULL,
  subject_id INT NOT NULL DEFAULT 0,
  subject_key VARCHAR(100) NOT NULL DEFAULT '',
  profile_id INT DEFAULT NULL,
  permissions_json LONGTEXT DEFAULT NULL,
  access_blocked TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES purchase_permission_profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_permission_subject (empresa_id, subject_type, subject_id, subject_key),
  INDEX idx_purchase_permissions_empresa_subject (empresa_id, subject_type),
  INDEX idx_purchase_permissions_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE purchase_permissions
SET subject_id = 0
WHERE subject_id IS NULL;

UPDATE purchase_permissions
SET subject_key = ''
WHERE subject_key IS NULL;

ALTER TABLE purchase_permissions
MODIFY COLUMN subject_id INT NOT NULL DEFAULT 0,
MODIFY COLUMN subject_key VARCHAR(100) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS purchase_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_category_empresa_name (empresa_id, name),
  INDEX idx_purchase_categories_empresa_active (empresa_id, is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  name VARCHAR(180) NOT NULL,
  cnpj VARCHAR(32) DEFAULT NULL,
  contact_name VARCHAR(160) DEFAULT NULL,
  phone VARCHAR(80) DEFAULT NULL,
  email VARCHAR(160) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_supplier_empresa_name (empresa_id, name),
  INDEX idx_purchase_suppliers_empresa_active (empresa_id, is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_sequences (
  empresa_id INT NOT NULL,
  sequence_year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, sequence_year),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  code VARCHAR(30) DEFAULT NULL,
  requester_id INT NOT NULL,
  department_id INT DEFAULT NULL,
  assigned_user_id INT DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'rascunho',
  request_type VARCHAR(20) NOT NULL DEFAULT 'normal',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  is_monthly TINYINT(1) NOT NULL DEFAULT 0,
  needed_at DATE DEFAULT NULL,
  cost_center VARCHAR(120) DEFAULT NULL,
  company_unit VARCHAR(160) DEFAULT NULL,
  justification TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  estimated_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  actual_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  cancellation_reason TEXT DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES usuarios(id),
  FOREIGN KEY (department_id) REFERENCES setores(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_request_code (code),
  INDEX idx_purchase_requests_empresa_status (empresa_id, status, updated_at),
  INDEX idx_purchase_requests_requester (requester_id, created_at),
  INDEX idx_purchase_requests_department (department_id, created_at),
  INDEX idx_purchase_requests_assigned (assigned_user_id, status),
  INDEX idx_purchase_requests_needed (needed_at),
  INDEX idx_purchase_requests_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  category_id INT DEFAULT NULL,
  description VARCHAR(500) NOT NULL,
  brand VARCHAR(160) DEFAULT NULL,
  model VARCHAR(160) DEFAULT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'unidade',
  stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  requested_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  approved_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  purchased_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  received_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  reference_url VARCHAR(1000) DEFAULT NULL,
  estimated_unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  requester_notes TEXT DEFAULT NULL,
  purchase_reason TEXT DEFAULT NULL,
  item_status VARCHAR(40) NOT NULL DEFAULT 'pendente',
  supplier_id INT DEFAULT NULL,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  supplier_order_number VARCHAR(120) DEFAULT NULL,
  purchased_at DATE DEFAULT NULL,
  expected_delivery_at DATE DEFAULT NULL,
  received_at DATE DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES purchase_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
  INDEX idx_purchase_items_request (request_id, item_status),
  INDEX idx_purchase_items_category (category_id),
  INDEX idx_purchase_items_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_item_id INT NOT NULL,
  supplier_id INT DEFAULT NULL,
  supplier_name VARCHAR(180) DEFAULT NULL,
  cnpj VARCHAR(32) DEFAULT NULL,
  seller_name VARCHAR(160) DEFAULT NULL,
  phone VARCHAR(80) DEFAULT NULL,
  email VARCHAR(160) DEFAULT NULL,
  link VARCHAR(1000) DEFAULT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  delivery_days INT DEFAULT NULL,
  valid_until DATE DEFAULT NULL,
  payment_method VARCHAR(160) DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'aguardando_retorno',
  discard_reason TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_purchase_quotes_item (request_item_id, status),
  INDEX idx_purchase_quotes_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  supplier_id INT DEFAULT NULL,
  supplier_name VARCHAR(180) DEFAULT NULL,
  quote_id INT DEFAULT NULL,
  order_number VARCHAR(120) DEFAULT NULL,
  purchase_date DATE DEFAULT NULL,
  expected_delivery_at DATE DEFAULT NULL,
  payment_method VARCHAR(160) DEFAULT NULL,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES purchase_suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_id) REFERENCES purchase_quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_purchase_orders_request (request_id, created_at),
  INDEX idx_purchase_orders_supplier (supplier_id),
  INDEX idx_purchase_orders_date (purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  request_item_id INT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
  INDEX idx_purchase_order_items_order (purchase_order_id),
  INDEX idx_purchase_order_items_item (request_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_item_id INT NOT NULL,
  purchase_order_id INT DEFAULT NULL,
  quantity_received DECIMAL(14,3) NOT NULL DEFAULT 0,
  condition_status VARCHAR(40) NOT NULL DEFAULT 'correto',
  storage_location VARCHAR(180) DEFAULT NULL,
  received_by INT DEFAULT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (received_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_purchase_receipts_item (request_item_id, received_at),
  INDEX idx_purchase_receipts_order (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  approver_id INT NOT NULL,
  decision ENUM('aprovado', 'rejeitado', 'ajustes') NOT NULL,
  justification TEXT DEFAULT NULL,
  approved_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES usuarios(id),
  INDEX idx_purchase_approvals_request (request_id, decided_at),
  INDEX idx_purchase_approvals_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  parent_id INT DEFAULT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_important TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES purchase_comments(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES usuarios(id),
  INDEX idx_purchase_comments_request (request_id, created_at),
  INDEX idx_purchase_comments_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  request_item_id INT DEFAULT NULL,
  comment_id INT DEFAULT NULL,
  quote_id INT DEFAULT NULL,
  order_id INT DEFAULT NULL,
  receipt_id INT DEFAULT NULL,
  file_url VARCHAR(1000) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_mime VARCHAR(180) DEFAULT NULL,
  file_size BIGINT DEFAULT NULL,
  attachment_type VARCHAR(60) NOT NULL DEFAULT 'geral',
  uploaded_by INT DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (request_item_id) REFERENCES purchase_request_items(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES purchase_comments(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_id) REFERENCES purchase_quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_purchase_attachments_request (request_id, deleted_at),
  INDEX idx_purchase_attachments_item (request_item_id),
  INDEX idx_purchase_attachments_comment (comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  request_id INT DEFAULT NULL,
  entity_type VARCHAR(80) NOT NULL DEFAULT 'request',
  entity_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  action VARCHAR(120) NOT NULL,
  old_value LONGTEXT DEFAULT NULL,
  new_value LONGTEXT DEFAULT NULL,
  ip_address VARCHAR(80) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_purchase_history_request (request_id, created_at),
  INDEX idx_purchase_history_empresa (empresa_id, created_at),
  INDEX idx_purchase_history_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  user_id INT NOT NULL,
  request_id INT DEFAULT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(500) DEFAULT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  INDEX idx_purchase_notifications_user_read (user_id, read_at, created_at),
  INDEX idx_purchase_notifications_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_recurring_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  recreate_next_month TINYINT(1) NOT NULL DEFAULT 0,
  day_of_month INT DEFAULT NULL,
  reviewer_user_id INT DEFAULT NULL,
  repeat_items TINYINT(1) NOT NULL DEFAULT 1,
  keep_quantities TINYINT(1) NOT NULL DEFAULT 1,
  keep_links_values TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_purchase_recurring_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
