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
  }
};

module.exports = Debt;
