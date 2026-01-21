const db = require("../config/db");

const MonthlyBudget = {
  // Create or update budget for a month
  setBudget: async ({ account_id, category_id, month, year, limit_amount }) => {
    const [result] = await db.query(
      `INSERT INTO monthly_budget (account_id, category_id, month, year, limit_amount)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE limit_amount = VALUES(limit_amount)`,
      [account_id, category_id, month, year, limit_amount]
    );
    return result.insertId;
  },

  // Get budget for specific month/year
  getBudget: async (accountId, categoryId, month, year) => {
    const [rows] = await db.query(
      "SELECT * FROM monthly_budget WHERE account_id = ? AND category_id = ? AND month = ? AND year = ?",
      [accountId, categoryId, month, year]
    );
    return rows[0] || null;
  },

  // Get all budgets for a user
  getByUserId: async (accountId) => {
    const [rows] = await db.query(
      `SELECT mb.*, pc.name AS category_name, pc.type AS category_type
       FROM monthly_budget mb
       JOIN personal_category pc ON mb.category_id = pc.id
       WHERE mb.account_id = ?
       ORDER BY mb.year DESC, mb.month DESC, pc.type ASC, pc.name ASC`,
      [accountId]
    );
    return rows;
  },

  // Update budget limit
  updateBudget: async (accountId, categoryId, month, year, limitAmount) => {
    await db.query(
      `UPDATE monthly_budget
       SET limit_amount = ?
       WHERE account_id = ? AND category_id = ? AND month = ? AND year = ?`,
      [limitAmount, accountId, categoryId, month, year]
    );
  },

  // Delete budget
  deleteBudget: async (accountId, categoryId, month, year) => {
    await db.query(
      "DELETE FROM monthly_budget WHERE account_id = ? AND category_id = ? AND month = ? AND year = ?",
      [accountId, categoryId, month, year]
    );
  },

  // Get current month's budgets (all categories)
  getCurrentBudgets: async (accountId) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = now.getFullYear();

    const [rows] = await db.query(
      `SELECT mb.*, pc.name AS category_name, pc.type AS category_type
       FROM monthly_budget mb
       JOIN personal_category pc ON mb.category_id = pc.id
       WHERE mb.account_id = ? AND mb.month = ? AND mb.year = ?
       ORDER BY pc.type ASC, pc.name ASC`,
      [accountId, currentMonth, currentYear]
    );

    return rows;
  },

  // Calculate spending vs budget for a category in a month
  // Spending is based on personal transactions of category type EXPENSE
  getBudgetVsSpending: async (accountId, categoryId, month, year) => {
    const budget = await MonthlyBudget.getBudget(accountId, categoryId, month, year);

    const [spendingRows] = await db.query(
      `SELECT
        COALESCE(SUM(pt.amount), 0) AS total_spent,
        COUNT(pt.id) AS tx_count
      FROM personal_transaction pt
      JOIN personal_category pc ON pt.category_id = pc.id
      WHERE pt.account_id = ?
        AND pt.category_id = ?
        AND pc.type = 'EXPENSE'
        AND MONTH(pt.transaction_date) = ?
        AND YEAR(pt.transaction_date) = ?`,
      [accountId, categoryId, month, year]
    );

    const spending = spendingRows[0] || { total_spent: 0, tx_count: 0 };
    const limit = budget ? budget.limit_amount : 0;

    return {
      category_id: categoryId,
      month,
      year,
      budget_limit: limit,
      total_spent: spending.total_spent,
      remaining: limit - spending.total_spent,
      tx_count: spending.tx_count,
      budget_set: !!budget
    };
  },

  // Summary for a month across all categories
  getMonthSummaryAllCategories: async (accountId, month, year) => {
    const budgets = await MonthlyBudget.getByUserId(accountId);
    const monthBudgets = budgets.filter((b) => b.month === month && b.year === year);

    // total spent (all EXPENSE personal transactions)
    const [spentRows] = await db.query(
      `SELECT
        COALESCE(SUM(pt.amount), 0) AS total_spent,
        COUNT(pt.id) AS tx_count
      FROM personal_transaction pt
      JOIN personal_category pc ON pt.category_id = pc.id
      WHERE pt.account_id = ?
        AND pc.type = 'EXPENSE'
        AND MONTH(pt.transaction_date) = ?
        AND YEAR(pt.transaction_date) = ?`,
      [accountId, month, year]
    );

    const spent = spentRows[0] || { total_spent: 0, tx_count: 0 };
    const totalLimit = monthBudgets.reduce((s, b) => s + parseFloat(b.limit_amount || 0), 0);

    return {
      month,
      year,
      budget_limit_total: totalLimit,
      total_spent: spent.total_spent,
      remaining: totalLimit - spent.total_spent,
      tx_count: spent.tx_count,
      budgets: monthBudgets
    };
  },

  // Get budget summary for current month
  getCurrentMonthSummary: async (accountId) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return await MonthlyBudget.getMonthSummaryAllCategories(accountId, currentMonth, currentYear);
  },

  // Check if spending exceeds budget
  checkBudgetExceeded: async (accountId, categoryId, month, year) => {
    const summary = await MonthlyBudget.getBudgetVsSpending(accountId, categoryId, month, year);
    return {
      exceeded: summary.remaining < 0,
      over_by: Math.abs(Math.min(summary.remaining, 0)),
      ...summary
    };
  },

  // Get budget alerts (months where spending is close to or over budget)
  getBudgetAlerts: async (accountId) => {
    const budgets = await MonthlyBudget.getByUserId(accountId);
    const alerts = [];

    for (const budget of budgets) {
      if (budget.category_type !== "EXPENSE") continue;
      const summary = await MonthlyBudget.getBudgetVsSpending(accountId, budget.category_id, budget.month, budget.year);
      const percentage = summary.budget_limit > 0 ? (summary.total_spent / summary.budget_limit) * 100 : 0;

      if (percentage >= 90) {
        alerts.push({
          category_id: budget.category_id,
          category_name: budget.category_name,
          month: budget.month,
          year: budget.year,
          budget_limit: summary.budget_limit,
          total_spent: summary.total_spent,
          percentage: Math.round(percentage),
          status: percentage > 100 ? 'exceeded' : 'warning'
        });
      }
    }

    return alerts.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }
};

module.exports = MonthlyBudget;
