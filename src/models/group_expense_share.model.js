const db = require("../config/db");

const GroupExpenseShare = {
  // Add expense shares (bulk insert)
  addShares: async (shares) => {
    if (shares.length === 0) return;

    const values = shares.map(share =>
      `(${share.group_expense_id}, ${share.account_id}, ${share.shared_amount})`
    ).join(", ");

    await db.query(
      `INSERT INTO group_expense_share (group_expense_id, account_id, shared_amount) VALUES ${values}`
    );
  },

  // Add single expense share
  addShare: async ({ group_expense_id, account_id, shared_amount }) => {
    const [result] = await db.query(
      `INSERT INTO group_expense_share (group_expense_id, account_id, shared_amount)
       VALUES (?, ?, ?)`,
      [group_expense_id, account_id, shared_amount]
    );
    return result.insertId;
  },

  // Get shares for an expense
  getByExpenseId: async (expenseId) => {
    const [rows] = await db.query(
      `SELECT ges.*,
        a.username, a.email
      FROM group_expense_share ges
      JOIN account a ON ges.account_id = a.id
      WHERE ges.group_expense_id = ?
      ORDER BY ges.shared_amount DESC`,
      [expenseId]
    );
    return rows;
  },

  // Get shares for a user
  getByUserId: async (userId) => {
    const [rows] = await db.query(
      `SELECT ges.*,
        ge.description, ge.total_amount, ge.expense_date,
        eg.group_name,
        a.username AS payer_username
      FROM group_expense_share ges
      JOIN group_expense ge ON ges.group_expense_id = ge.id
      JOIN expense_group eg ON ge.group_id = eg.id
      JOIN account a ON ge.payer_id = a.id
      WHERE ges.account_id = ?
      ORDER BY ge.expense_date DESC`,
      [userId]
    );
    return rows;
  },

  // Update share amount
  updateShare: async (expenseId, accountId, sharedAmount) => {
    await db.query(
      `UPDATE group_expense_share
       SET shared_amount = ?
       WHERE group_expense_id = ? AND account_id = ?`,
      [sharedAmount, expenseId, accountId]
    );
  },

  // Remove share
  removeShare: async (expenseId, accountId) => {
    await db.query(
      "DELETE FROM group_expense_share WHERE group_expense_id = ? AND account_id = ?",
      [expenseId, accountId]
    );
  },

  // Remove all shares for an expense
  removeAllShares: async (expenseId) => {
    await db.query(
      "DELETE FROM group_expense_share WHERE group_expense_id = ?",
      [expenseId]
    );
  },

  // Calculate total owed by user across all groups
  getTotalOwed: async (userId) => {
    const [rows] = await db.query(
      `SELECT
        SUM(ges.shared_amount) AS total_owed,
        COUNT(DISTINCT ges.group_expense_id) AS expense_count,
        COUNT(DISTINCT ge.group_id) AS group_count
      FROM group_expense_share ges
      JOIN group_expense ge ON ges.group_expense_id = ge.id
      WHERE ges.account_id = ?`,
      [userId]
    );
    return rows[0] || { total_owed: 0, expense_count: 0, group_count: 0 };
  },

  // Calculate total paid by user across all groups
  getTotalPaid: async (userId) => {
    const [rows] = await db.query(
      `SELECT
        SUM(ge.total_amount) AS total_paid,
        COUNT(ge.id) AS expense_count
      FROM group_expense ge
      WHERE ge.payer_id = ?`,
      [userId]
    );
    return rows[0] || { total_paid: 0, expense_count: 0 };
  },

  // Get user's balance (paid - owed) across all groups
  getUserBalance: async (userId) => {
    const [paidResult] = await this.getTotalPaid(userId);
    const [owedResult] = await this.getTotalOwed(userId);

    return {
      total_paid: paidResult.total_paid || 0,
      total_owed: owedResult.total_owed || 0,
      balance: (paidResult.total_paid || 0) - (owedResult.total_owed || 0)
    };
  }
};

module.exports = GroupExpenseShare;
