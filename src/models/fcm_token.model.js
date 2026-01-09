const db = require("../config/db");

const FcmToken = {
  // Add or update FCM token for a user
  upsert: async (accountId, token) => {
    // First deactivate all existing tokens for this user
    await db.query(
      "UPDATE fcm_token SET is_active = 0 WHERE account_id = ?",
      [accountId]
    );

    // Insert new token or update if exists
    const [result] = await db.query(
      `INSERT INTO fcm_token (account_id, token, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP`,
      [accountId, token]
    );

    return result.insertId;
  },

  // Get active FCM token for a user
  getActiveToken: async (accountId) => {
    const [rows] = await db.query(
      "SELECT token FROM fcm_token WHERE account_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1",
      [accountId]
    );
    return rows[0]?.token || null;
  },

  // Deactivate a specific token
  deactivateToken: async (token) => {
    await db.query(
      "UPDATE fcm_token SET is_active = 0 WHERE token = ?",
      [token]
    );
  },

  // Deactivate all tokens for a user
  deactivateAllTokens: async (accountId) => {
    await db.query(
      "UPDATE fcm_token SET is_active = 0 WHERE account_id = ?",
      [accountId]
    );
  },

  // Get all active tokens (for broadcasting notifications)
  getAllActiveTokens: async () => {
    const [rows] = await db.query(
      "SELECT DISTINCT token FROM fcm_token WHERE is_active = 1"
    );
    return rows.map(row => row.token);
  }
};

module.exports = FcmToken;
