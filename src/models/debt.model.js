const db = require("../config/db");

const Debt = {
  create: ({ creditor_id, debtor_id, amount, note, due_date }) => {
    return db.query(
      `INSERT INTO debt (creditor_id, debtor_id, amount, note, due_date, debt_confirm_status, paid_status, payment_confirm_status)
       VALUES (?, ?, ?, ?, ?, 'pending', 'unpaid', 'unconfirmed')`,
      [creditor_id, debtor_id, amount, note || null, due_date || null]
    );
  },

  getByUser: (userId) => {
    return db.query(
      `SELECT d.*,
        c.username AS creditor_username, c.email AS creditor_email,
        b.username AS debtor_username, b.email AS debtor_email
      FROM debt d
      JOIN account c ON d.creditor_id = c.id
      JOIN account b ON d.debtor_id = b.id
      WHERE d.creditor_id = ? OR d.debtor_id = ?
      ORDER BY d.created_at DESC`,
      [userId, userId]
    );
  },

  getById: (id) => {
    return db.query(
      `SELECT d.*,
        c.username AS creditor_username, c.email AS creditor_email,
        b.username AS debtor_username, b.email AS debtor_email
      FROM debt d
      JOIN account c ON d.creditor_id = c.id
      JOIN account b ON d.debtor_id = b.id
      WHERE d.id = ?`,
      [id]
    );
  },

  // Debtor reports payment with proof
  reportPayment: (id, proofImageUrl) => {
    return db.query(
      `UPDATE debt
       SET paid_status = 'paid',
           payment_confirm_status = 'unconfirmed',
           proof_image_url = ?
       WHERE id = ?`,
      [proofImageUrl, id]
    );
  },

  // Creditor confirms the debt (accepts the debt request)
  confirmDebt: (id) => {
    return db.query(
      `UPDATE debt
       SET debt_confirm_status = 'accepted'
       WHERE id = ?`,
      [id]
    );
  },

  // Creditor confirms payment
  confirmPayment: (id) => {
    return db.query(
      `UPDATE debt
       SET payment_confirm_status = 'confirmed'
       WHERE id = ?`,
      [id]
    );
  },

  // Reject debt request
  rejectDebt: (id) => {
    return db.query(
      `UPDATE debt
       SET debt_confirm_status = 'rejected'
       WHERE id = ?`,
      [id]
    );
  },

  delete: (id) => {
    return db.query("DELETE FROM debt WHERE id = ?", [id]);
  },

  update: (id, { amount, note, due_date }) => {
    return db.query(
      `UPDATE debt
       SET amount = ?, note = ?, due_date = ?
       WHERE id = ?`,
      [amount, note || null, due_date || null, id]
    );
  },

  // Get pending debts that need confirmation
  getPendingDebts: (userId) => {
    return db.query(
      `SELECT d.*,
        c.username AS creditor_username, c.email AS creditor_email,
        b.username AS debtor_username, b.email AS debtor_email
      FROM debt d
      JOIN account c ON d.creditor_id = c.id
      JOIN account b ON d.debtor_id = b.id
      WHERE (d.creditor_id = ? OR d.debtor_id = ?) AND d.debt_confirm_status = 'pending'
      ORDER BY d.created_at DESC`,
      [userId, userId]
    );
  },

  // Get unpaid debts
  getUnpaidDebts: (userId) => {
    return db.query(
      `SELECT d.*,
        c.username AS creditor_username, c.email AS creditor_email,
        b.username AS debtor_username, b.email AS debtor_email
      FROM debt d
      JOIN account c ON d.creditor_id = c.id
      JOIN account b ON d.debtor_id = b.id
      WHERE (d.creditor_id = ? OR d.debtor_id = ?) AND d.paid_status = 'unpaid'
      ORDER BY d.created_at DESC`,
      [userId, userId]
    );
  },

  // Summary report for a user with optional filters
  getSummaryReport: ({ userId, from, to, debt_confirm_status, paid_status, payment_confirm_status }) => {
    const conditions = ["(d.creditor_id = ? OR d.debtor_id = ?)"];
    const params = [userId, userId];

    if (from) {
      conditions.push("d.created_at >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("d.created_at <= ?");
      params.push(to);
    }
    if (debt_confirm_status) {
      conditions.push("d.debt_confirm_status = ?");
      params.push(debt_confirm_status);
    }
    if (paid_status) {
      conditions.push("d.paid_status = ?");
      params.push(paid_status);
    }
    if (payment_confirm_status) {
      conditions.push("d.payment_confirm_status = ?");
      params.push(payment_confirm_status);
    }

    return db.query(
      `SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(d.amount), 0) AS total_amount,

        COALESCE(SUM(CASE WHEN d.creditor_id = ? THEN d.amount ELSE 0 END), 0) AS receivable_total,
        COALESCE(SUM(CASE WHEN d.debtor_id = ? THEN d.amount ELSE 0 END), 0) AS payable_total,

        COALESCE(SUM(CASE WHEN d.creditor_id = ? AND d.paid_status = 'unpaid' THEN d.amount ELSE 0 END), 0) AS receivable_unpaid,
        COALESCE(SUM(CASE WHEN d.debtor_id = ? AND d.paid_status = 'unpaid' THEN d.amount ELSE 0 END), 0) AS payable_unpaid,

        COALESCE(SUM(CASE WHEN d.creditor_id = ? AND d.paid_status = 'paid' THEN d.amount ELSE 0 END), 0) AS receivable_paid,
        COALESCE(SUM(CASE WHEN d.debtor_id = ? AND d.paid_status = 'paid' THEN d.amount ELSE 0 END), 0) AS payable_paid,

        COALESCE(SUM(CASE WHEN d.debt_confirm_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
        COALESCE(SUM(CASE WHEN d.debt_confirm_status = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted_count,
        COALESCE(SUM(CASE WHEN d.debt_confirm_status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,

        COALESCE(SUM(CASE WHEN d.payment_confirm_status = 'unconfirmed' THEN 1 ELSE 0 END), 0) AS payment_unconfirmed_count,
        COALESCE(SUM(CASE WHEN d.payment_confirm_status = 'confirmed' THEN 1 ELSE 0 END), 0) AS payment_confirmed_count
      FROM debt d
      WHERE ${conditions.join(" AND ")}`,
      [userId, userId, userId, userId, userId, userId, ...params]
    );
  },

  // Grouped by counterparty for a user
  getByCounterpartyReport: ({ userId, from, to, debt_confirm_status, paid_status, payment_confirm_status }) => {
    const conditions = ["(d.creditor_id = ? OR d.debtor_id = ?)"];
    const params = [userId, userId];

    if (from) {
      conditions.push("d.created_at >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("d.created_at <= ?");
      params.push(to);
    }
    if (debt_confirm_status) {
      conditions.push("d.debt_confirm_status = ?");
      params.push(debt_confirm_status);
    }
    if (paid_status) {
      conditions.push("d.paid_status = ?");
      params.push(paid_status);
    }
    if (payment_confirm_status) {
      conditions.push("d.payment_confirm_status = ?");
      params.push(payment_confirm_status);
    }

    return db.query(
      `SELECT
        CASE WHEN d.creditor_id = ? THEN d.debtor_id ELSE d.creditor_id END AS counterparty_id,
        a.username AS counterparty_username,
        a.email AS counterparty_email,
        CASE WHEN d.creditor_id = ? THEN 'receivable' ELSE 'payable' END AS relation,
        COUNT(*) AS debt_count,
        COALESCE(SUM(d.amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN d.paid_status = 'unpaid' THEN d.amount ELSE 0 END), 0) AS unpaid_amount,
        COALESCE(SUM(CASE WHEN d.paid_status = 'paid' THEN d.amount ELSE 0 END), 0) AS paid_amount
      FROM debt d
      JOIN account a
        ON a.id = (CASE WHEN d.creditor_id = ? THEN d.debtor_id ELSE d.creditor_id END)
      WHERE ${conditions.join(" AND ")}
      GROUP BY counterparty_id, relation, a.username, a.email
      ORDER BY unpaid_amount DESC, total_amount DESC`,
      [userId, userId, userId, ...params]
    );
  },

  // Monthly aggregation within a year for a user
  getMonthlyReport: ({ userId, year }) => {
    return db.query(
      `SELECT
         YEAR(d.created_at) AS year,
         MONTH(d.created_at) AS month,
         COUNT(*) AS debt_count,
         COALESCE(SUM(d.amount), 0) AS total_amount,
         COALESCE(SUM(CASE WHEN d.creditor_id = ? THEN d.amount ELSE 0 END), 0) AS receivable_amount,
         COALESCE(SUM(CASE WHEN d.debtor_id = ? THEN d.amount ELSE 0 END), 0) AS payable_amount
       FROM debt d
       WHERE (d.creditor_id = ? OR d.debtor_id = ?) AND YEAR(d.created_at) = ?
       GROUP BY YEAR(d.created_at), MONTH(d.created_at)
       ORDER BY month DESC`,
      [userId, userId, userId, userId, year]
    );
  },

  // Yearly aggregation for a user
  getYearlyReport: ({ userId }) => {
    return db.query(
      `SELECT
         YEAR(d.created_at) AS year,
         COUNT(*) AS debt_count,
         COALESCE(SUM(d.amount), 0) AS total_amount,
         COALESCE(SUM(CASE WHEN d.creditor_id = ? THEN d.amount ELSE 0 END), 0) AS receivable_amount,
         COALESCE(SUM(CASE WHEN d.debtor_id = ? THEN d.amount ELSE 0 END), 0) AS payable_amount
       FROM debt d
       WHERE d.creditor_id = ? OR d.debtor_id = ?
       GROUP BY YEAR(d.created_at)
       ORDER BY year DESC`,
      [userId, userId, userId, userId]
    );
  },

  // Báo cáo đầy đủ cho người cho vay (creditor)
  // - Liệt kê các email nợ chưa trả
  // - Các email nợ quá hạn
  // - Số tiền đã được trả
  // - Tổng số tiền chưa được trả
  getCreditorFullReport: ({ userId }) => {
    return db.query(
      `SELECT
        -- Tổng hợp
        COALESCE(SUM(CASE WHEN d.paid_status = 'paid' AND d.payment_confirm_status = 'confirmed' THEN d.amount ELSE 0 END), 0) AS total_paid_amount,
        COALESCE(SUM(CASE WHEN d.paid_status = 'unpaid' THEN d.amount ELSE 0 END), 0) AS total_unpaid_amount,
        -- Email chưa trả (unique)
        GROUP_CONCAT(DISTINCT CASE WHEN d.paid_status = 'unpaid' THEN a.email END SEPARATOR ', ') AS unpaid_emails,
        -- Email quá hạn (unique)
        GROUP_CONCAT(DISTINCT CASE 
          WHEN d.paid_status = 'unpaid' 
            AND d.due_date IS NOT NULL 
            AND d.due_date < NOW() 
          THEN a.email 
        END SEPARATOR ', ') AS overdue_emails
      FROM debt d
      JOIN account a ON d.debtor_id = a.id
      WHERE d.creditor_id = ?
        AND d.debt_confirm_status = 'accepted'`,
      [userId]
    );
  },

  // Báo cáo đầy đủ cho người vay (debtor)
  // - Liệt kê các email chưa trả (người cho vay)
  // - Các email quá hạn
  // - Tổng số tiền chưa trả
  getDebtorFullReport: ({ userId }) => {
    return db.query(
      `SELECT
        -- Tổng số tiền chưa trả
        COALESCE(SUM(CASE WHEN d.paid_status = 'unpaid' THEN d.amount ELSE 0 END), 0) AS total_unpaid_amount,
        -- Email chưa trả (unique) - người cho vay
        GROUP_CONCAT(DISTINCT CASE WHEN d.paid_status = 'unpaid' THEN a.email END SEPARATOR ', ') AS unpaid_emails,
        -- Email quá hạn (unique) - người cho vay
        GROUP_CONCAT(DISTINCT CASE 
          WHEN d.paid_status = 'unpaid' 
            AND d.due_date IS NOT NULL 
            AND d.due_date < NOW() 
          THEN a.email 
        END SEPARATOR ', ') AS overdue_emails
      FROM debt d
      JOIN account a ON d.creditor_id = a.id
      WHERE d.debtor_id = ?
        AND d.debt_confirm_status = 'accepted'`,
      [userId]
    );
  }
};

module.exports = Debt;
