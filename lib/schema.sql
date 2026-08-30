CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  options TEXT NOT NULL,               -- JSON: CampaignOption[4]
  resolution_criteria TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reward_option_ids TEXT NOT NULL DEFAULT '[]',
  sponsor_name TEXT NOT NULL DEFAULT '',
  sponsor_logo_url TEXT,
  prize_type TEXT NOT NULL DEFAULT 'item',
  prize_label TEXT NOT NULL DEFAULT '',
  prize_amount INTEGER,
  winner_count INTEGER NOT NULL DEFAULT 1,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'image',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  selected_option TEXT NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(participant_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  inviter_participant_id TEXT NOT NULL REFERENCES participants(id),
  invitee_email TEXT,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  price INTEGER NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'KR',
  stock_status TEXT NOT NULL DEFAULT 'ON_SALE'
);

CREATE TABLE IF NOT EXISTS claim_orders (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL REFERENCES predictions(id),
  selected_product_id TEXT NOT NULL REFERENCES products(id),
  external_reference_id TEXT NOT NULL UNIQUE,
  soda_order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gift_orders (
  id TEXT PRIMARY KEY,
  sender_participant_id TEXT NOT NULL REFERENCES participants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT,
  external_reference_id TEXT NOT NULL UNIQUE,
  soda_order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  participant_id TEXT,
  campaign_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
