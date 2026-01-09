const db = require("../config/db");

const MonthlyBudget = {
  // Create or update budget for a month
  setBudget: async ({ account_id, month, year, limit_amount }) => {
    const [result] = await db.query(
      `INSERT INTO monthly_budget (account_id, month, year, limit_amount)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE limit_amount = VALUES(limit_amount)`,
      [account_id, month, year, limit_amount]
    );
    return result.insertId;
  },

  // Get budget for specific month/year
  getBudget: async (accountId, month, year) => {
    const [rows] = await db.query(
      "SELECT * FROM monthly_budget WHERE account_id = ? AND month = ? AND year = ?",
      [accountId, month, year]
    );
    return rows[0] || null;
  },

  // Get all budgets for a user
  getByUserId: async (accountId) => {
    const [rows] = await db.query(
      "SELECT * FROM monthly_budget WHERE account_id = ? ORDER BY year DESC, month DESC",
      [accountId]
    );
    return rows;
  },

  // Update budget limit
  updateBudget: async (accountId, month, year, limitAmount) => {
    await db.query(
      `UPDATE monthly_budget
       SET limit_amount = ?
       WHERE account_id = ? AND month = ? AND year = ?`,
      [limitAmount, accountId, month, year]
    );
  },

  // Delete budget
  deleteBudget: async (accountId, month, year) => {
    await db.query(
      "DELETE FROM monthly_budget WHERE account_id = ? AND month = ? AND year = ?",
      [accountId, month, year]
    );
  },

  // Get current month's budget
  getCurrentBudget: async (accountId) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = now.getFullYear();

    return await this.getBudget(accountId, currentMonth, currentYear);
  },

  // Calculate spending vs budget for a month
  getBudgetVsSpending: async (accountId, month, year) => {
    // Get budget
    const budget = await this.getBudget(accountId, month, year);

    // Calculate total spending from group expenses
    const [spendingRows] = await db.query(
      `SELECT
        COALESCE(SUM(ge.total_amount), 0) AS total_spent,
        COUNT(ge.id) AS expense_count
      FROM group_expense ge
      JOIN expense_group eg ON ge.group_id = eg.id
      LEFT JOIN expense_group_member egm ON eg.id = egm.group_id
      WHERE (ge.payer_id = ? OR egm.account_id = ?)
        AND MONTH(ge.expense_date) = ?
        AND YEAR(ge.expense_date) = ?`,
      [accountId, accountId, month, year]
    );

    const spending = spendingRows[0] || { total_spent: 0, expense_count: 0 };

    return {
      budget_limit: budget ? budget.limit_amount : 0,
      total_spent: spending.total_spent,
      remaining: (budget ? budget.limit_amount : 0) - spending.total_spent,
      expense_count: spending.expense_count,
      budget_set: !!budget
    };
  },

  // Get budget summary for current month
  getCurrentMonthSummary: async (accountId) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return await this.getBudgetVsSpending(accountId, currentMonth, currentYear);
  },

  // Check if spending exceeds budget
  checkBudgetExceeded: async (accountId, month, year) => {
    const summary = await this.getBudgetVsSpending(accountId, month, year);
    return {
      exceeded: summary.remaining < 0,
      over_by: Math.abs(Math.min(summary.remaining, 0)),
      ...summary
    };
  },

  // Get budget alerts (months where spending is close to or over budget)
  getBudgetAlerts: async (accountId) => {
    const budgets = await this.getByUserId(accountId);
    const alerts = [];

    for (const budget of budgets) {
      const summary = await this.getBudgetVsSpending(accountId, budget.month, budget.year);
      const percentage = (summary.total_spent / summary.budget_limit) * 100;

      if (percentage >= 90) {
        alerts.push({
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
