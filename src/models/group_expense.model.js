const db = require("../config/db");

const GroupExpense = {
  // Create new group expense
  create: async ({ group_id, payer_id, total_amount, description, expense_date }) => {
    const [result] = await db.query(
      `INSERT INTO group_expense (group_id, payer_id, total_amount, description, expense_date)
       VALUES (?, ?, ?, ?, ?)`,
      [group_id, payer_id, total_amount, description || null, expense_date]
    );
    return result.insertId;
  },

  // Get expense by ID with payer info
  getById: async (expenseId) => {
    const [rows] = await db.query(
      `SELECT ge.*,
        a.username AS payer_username, a.email AS payer_email,
        eg.group_name
      FROM group_expense ge
      JOIN account a ON ge.payer_id = a.id
      JOIN expense_group eg ON ge.group_id = eg.id
      WHERE ge.id = ?`,
      [expenseId]
    );
    return rows[0] || null;
  },

  // Get all expenses for a group
  getByGroupId: async (groupId) => {
    const [rows] = await db.query(
      `SELECT ge.*,
        a.username AS payer_username, a.email AS payer_email
      FROM group_expense ge
      JOIN account a ON ge.payer_id = a.id
      WHERE ge.group_id = ?
      ORDER BY ge.expense_date DESC, ge.created_at DESC`,
      [groupId]
    );
    return rows;
  },

  // Get expenses for a user (as payer or through shares)
  getByUserId: async (userId) => {
    const [rows] = await db.query(
      `SELECT DISTINCT ge.*,
        a.username AS payer_username, a.email AS payer_email,
        eg.group_name,
        ges.shared_amount,
        CASE WHEN ge.payer_id = ? THEN 'payer' ELSE 'participant' END AS user_role
      FROM group_expense ge
      JOIN account a ON ge.payer_id = a.id
      JOIN expense_group eg ON ge.group_id = eg.id
      LEFT JOIN group_expense_share ges ON ge.id = ges.group_expense_id AND ges.account_id = ?
      LEFT JOIN expense_group_member egm ON eg.id = egm.group_id AND egm.account_id = ?
      WHERE ge.payer_id = ? OR ges.account_id = ? OR (egm.account_id = ? AND egm.join_status = 'accepted')
      ORDER BY ge.expense_date DESC, ge.created_at DESC`,
      [userId, userId, userId, userId, userId, userId]
    );
    return rows;
  },

  // Update expense
  update: async (expenseId, { total_amount, description, expense_date }) => {
    await db.query(
      `UPDATE group_expense
       SET total_amount = ?, description = ?, expense_date = ?
       WHERE id = ?`,
      [total_amount, description || null, expense_date, expenseId]
    );
  },

  // Delete expense
  delete: async (expenseId) => {
    await db.query("DELETE FROM group_expense WHERE id = ?", [expenseId]);
  },

  // Get expense shares for an expense
  getExpenseShares: async (expenseId) => {
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

  // Get expense summary for a group
  getGroupExpenseSummary: async (groupId) => {
    const [rows] = await db.query(
      `SELECT
        COUNT(*) AS total_expenses,
        SUM(ge.total_amount) AS total_amount,
        AVG(ge.total_amount) AS avg_expense,
        MIN(ge.expense_date) AS earliest_date,
        MAX(ge.expense_date) AS latest_date
      FROM group_expense ge
      WHERE ge.group_id = ?`,
      [groupId]
    );
    return rows[0] || null;
  },

  // Get monthly expense summary for a group
  getMonthlySummary: async (groupId, year, month) => {
    const [rows] = await db.query(
      `SELECT
        COUNT(*) AS expense_count,
        SUM(ge.total_amount) AS total_amount,
        DATE_FORMAT(ge.expense_date, '%Y-%m') AS month_year
      FROM group_expense ge
      WHERE ge.group_id = ? AND YEAR(ge.expense_date) = ? AND MONTH(ge.expense_date) = ?
      GROUP BY DATE_FORMAT(ge.expense_date, '%Y-%m')`,
      [groupId, year, month]
    );
    return rows[0] || null;
  }
};

module.exports = GroupExpense;
