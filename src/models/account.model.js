const db = require("../config/db");

const Account = {
  async getById(userId) {
    const [rows] = await db.query(
      "SELECT id, uid, username, email, created_at, updated_at FROM account WHERE id = ?",
      [userId]
    );
    return rows[0] || null; // trả về object hoặc null
  },

  async getByUid(uid) {
    const [rows] = await db.query(
      "SELECT id, uid, username, email, created_at, updated_at FROM account WHERE uid = ?",
      [uid]
    );
    return rows[0] || null;
  },

  async getByEmail(email) {
    const [rows] = await db.query(
      "SELECT id, uid, username, email, password, created_at, updated_at FROM account WHERE email = ?",
      [email]
    );
    return rows[0] || null;
  },

  async create({ uid, username, email, password }) {
    const [result] = await db.query(
      "INSERT INTO account (uid, username, email, password) VALUES (?, ?, ?, ?)",
      [uid, username, email, password]
    );
    return result.insertId;
  },

  async updateProfile(userId, { username, email }) {
    await db.query(
      "UPDATE account SET username = ?, email = ? WHERE id = ?",
      [username, email, userId]
    );
  },

  async searchUsers(searchTerm, excludeUserId) {
    const [rows] = await db.query(
      "SELECT id, uid, username, email FROM account WHERE (username LIKE ? OR email LIKE ?) AND id != ? LIMIT 20",
      [`%${searchTerm}%`, `%${searchTerm}%`, excludeUserId]
    );
    return rows;
  }
};

module.exports = Account;