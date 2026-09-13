-- Google authentication now stores only the stable OIDC subject. Existing
-- OAuth-derived names and email claims are removed because their origin cannot
-- be distinguished reliably from later profile edits in the legacy schema.
ALTER TABLE users ADD COLUMN account_kind TEXT NOT NULL DEFAULT 'google'
  CHECK (account_kind IN ('google', 'trial'));

UPDATE user_identities
SET email = NULL,
    email_verified = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE provider = 'google';

UPDATE users
SET display_name = 'GAIA参加者 ' || upper(substr(public_id, -4)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (
  SELECT user_id FROM user_identities WHERE provider = 'google'
);

CREATE INDEX IF NOT EXISTS idx_users_account_kind ON users(account_kind, created_at);
