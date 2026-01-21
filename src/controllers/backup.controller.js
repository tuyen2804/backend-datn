const MonthlyBudget = require("../models/monthly_budget.model");
const ExpenseGroup = require("../models/expense_group.model");
const GroupExpense = require("../models/group_expense.model");
const Debt = require("../models/debt.model");
const PersonalFinance = require("../models/personal_finance.model");

// Sao lưu dữ liệu chi tiêu cá nhân + nhóm + ngân sách theo tháng
// Query optional:
// - from (ISO date string)
// - to (ISO date string)
const getPersonalSpendingBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    let fromDate = null;
    let toDate = null;

    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid from date format" });
      }
      fromDate = d;
    }

    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid to date format" });
      }
      toDate = d;
    }

    // Ngân sách theo tháng của user
    const budgets = await MonthlyBudget.getByUserId(userId);

    // Nhóm chi tiêu (coi như danh mục nhóm) mà user tham gia
    const groups = await ExpenseGroup.getByUserId(userId);

    // Chi tiêu nhóm mà user là payer hoặc participant
    const expenses = await GroupExpense.getByUserId(userId);

    // Khoản vay/nợ liên quan tới user
    const [debtsRows] = await Debt.getByUser(userId);

    // Nếu có from/to thì filter theo ngày ở tầng ứng dụng
    const filterByRange = (items, getDate) => {
      if (!fromDate && !toDate) return items;
      return items.filter((item) => {
        const dt = getDate(item);
        if (!dt) return false;
        const t = new Date(dt);
        if (isNaN(t.getTime())) return false;
        if (fromDate && t < fromDate) return false;
        if (toDate && t > toDate) return false;
        return true;
      });
    };

    const filteredExpenses = filterByRange(expenses, (e) => e.expense_date);
    const filteredDebts = filterByRange(debtsRows, (d) => d.created_at);

    return res.json({
      success: true,
      data: {
        budgets,
        groups,
        expenses: filteredExpenses,
        debts: filteredDebts
      }
    });
  } catch (err) {
    console.error("Error getting personal spending backup:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Sao lưu dữ liệu chi tiêu cá nhân (personal_category, personal_transaction, personal_monthly_budget, budget_alert, sync_log)
const getPersonalFinanceBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await PersonalFinance.exportAll(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error getting personal finance backup:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Phục hồi dữ liệu chi tiêu cá nhân
// Body:
// {
//   "categories": [...],
//   "transactions": [...],
//   "monthly_budgets": [...],
//   "budget_alerts": [...],
//   "sync_log": { "last_sync_at": ... }
// }
const restorePersonalFinanceBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    // Quick validation to return a clear 400 instead of a DB 500
    const invalidTransactions =
      Array.isArray(payload.transactions)
        ? payload.transactions
            .filter((t) => t && (t.category_id === null || t.category_id === undefined))
            .map((t) => ({ id: t.id, transaction_date: t.transaction_date, amount: t.amount }))
        : [];

    if (invalidTransactions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some transactions are missing category_id",
        invalid_transactions: invalidTransactions
      });
    }

    await PersonalFinance.importAll(userId, payload);
    return res.json({ success: true, message: "Personal finance restored successfully" });
  } catch (err) {
    console.error("Error restoring personal finance backup:", err);
    // Prefer returning a 400 for data issues
    const msg = (err && err.message) ? err.message : "Server error";
    const isDataError =
      msg.includes("Invalid ") ||
      msg.includes("missing category_id") ||
      msg.includes("Some transactions are missing category_id");
    res.status(isDataError ? 400 : 500).json({ success: false, message: msg });
  }
};

module.exports = {
  getPersonalSpendingBackup,
  // personal finance backup/restore
  getPersonalFinanceBackup,
  restorePersonalFinanceBackup
};

