const db = require("../config/db");

const PersonalFinance = {
  // Export personal finance data for a user
  // Chỉ gồm: personal_category, personal_transaction, monthly_budget
  exportAll: async (accountId) => {
    const [categories] = await db.query(
      "SELECT * FROM personal_category WHERE account_id = ? ORDER BY id ASC",
      [accountId]
    );

    const [transactions] = await db.query(
      "SELECT * FROM personal_transaction WHERE account_id = ? ORDER BY transaction_date DESC, id DESC",
      [accountId]
    );

    const [budgets] = await db.query(
      "SELECT * FROM monthly_budget WHERE account_id = ? ORDER BY year DESC, month DESC, id DESC",
      [accountId]
    );

    return {
      categories,
      transactions,
      monthly_budgets: budgets
    };
  },

  // Import personal finance data for a user (transactional)
  // Chỉ xử lý: personal_category, personal_transaction, monthly_budget
  importAll: async (accountId, payload) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Delete existing data for this user (order matters because of FKs)
      await conn.query("DELETE FROM monthly_budget WHERE account_id = ?", [accountId]);
      await conn.query("DELETE FROM personal_transaction WHERE account_id = ?", [accountId]);
      await conn.query("DELETE FROM personal_category WHERE account_id = ?", [accountId]);

      // Insert categories
      if (payload.categories && Array.isArray(payload.categories) && payload.categories.length > 0) {
        for (const c of payload.categories) {
          if (c.account_id && parseInt(c.account_id, 10) !== accountId) {
            throw new Error("Invalid category account_id");
          }
          const rawType = (c.type || "").toString().toUpperCase();
          const normalizedType = rawType === "INCOME" || rawType === "EXPENSE" ? rawType : null;
          if (!normalizedType) {
            throw new Error("Invalid category type");
          }
          await conn.query(
            `INSERT INTO personal_category (id, account_id, name, type)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               account_id = VALUES(account_id),
               name = VALUES(name),
               type = VALUES(type)`,
            [
              c.id || null,
              accountId,
              c.name,
              normalizedType
            ]
          );
        }
      }

      // Insert transactions
      if (payload.transactions && Array.isArray(payload.transactions) && payload.transactions.length > 0) {
        for (const t of payload.transactions) {
          if (t.account_id && parseInt(t.account_id, 10) !== accountId) {
            throw new Error("Invalid transaction account_id");
          }
          if (t.category_id === null || t.category_id === undefined) {
            throw new Error(`Invalid transaction: missing category_id (transaction id: ${t.id || "unknown"})`);
          }
          await conn.query(
            `INSERT INTO personal_transaction
              (id, account_id, category_id, amount, note, transaction_date)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               category_id = VALUES(category_id),
               amount = VALUES(amount),
               note = VALUES(note),
               transaction_date = VALUES(transaction_date)`,
            [
              t.id || null,
              accountId,
              t.category_id,
              t.amount,
              t.note || null,
              t.transaction_date
            ]
          );
        }
      }

      // Insert budgets
      if (payload.monthly_budgets && Array.isArray(payload.monthly_budgets) && payload.monthly_budgets.length > 0) {
        for (const b of payload.monthly_budgets) {
          if (b.account_id && parseInt(b.account_id, 10) !== accountId) {
            throw new Error("Invalid budget account_id");
          }
          await conn.query(
            `INSERT INTO monthly_budget
              (id, account_id, category_id, month, year, limit_amount)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               category_id = VALUES(category_id),
               month = VALUES(month),
               year = VALUES(year),
               limit_amount = VALUES(limit_amount)`,
            [
              b.id || null,
              accountId,
              b.category_id,
              b.month,
              b.year,
              b.limit_amount
            ]
          );
        }
      }

      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = PersonalFinance;

