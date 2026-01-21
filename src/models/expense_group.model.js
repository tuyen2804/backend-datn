const db = require("../config/db");

const ExpenseGroup = {
  // Create new expense group
  create: async ({ group_name, owner_id, payment_deadline }) => {
    const [result] = await db.query(
      "INSERT INTO expense_group (group_name, owner_id, payment_deadline) VALUES (?, ?, ?)",
      [group_name, owner_id, payment_deadline || null]
    );
    return result.insertId;
  },

  // Get group by ID with owner info
  getById: async (groupId) => {
    const [rows] = await db.query(
      `SELECT eg.*,
        a.username AS owner_username, a.email AS owner_email
      FROM expense_group eg
      JOIN account a ON eg.owner_id = a.id
      WHERE eg.id = ?`,
      [groupId]
    );
    return rows[0] || null;
  },

  // Get all groups for a user (as owner or member)
  getByUserId: async (userId) => {
    const [rows] = await db.query(
      `SELECT DISTINCT eg.*,
        a.username AS owner_username, a.email AS owner_email,
        CASE WHEN eg.owner_id = ? THEN 'owner' ELSE 'member' END AS user_role
      FROM expense_group eg
      JOIN account a ON eg.owner_id = a.id
      LEFT JOIN expense_group_member egm ON eg.id = egm.group_id
      WHERE eg.owner_id = ? OR egm.account_id = ?
      ORDER BY eg.created_at DESC`,
      [userId, userId, userId]
    );
    return rows;
  },

  // Update group details
  update: async (groupId, { group_name, payment_deadline }) => {
    await db.query(
      "UPDATE expense_group SET group_name = ?, payment_deadline = ? WHERE id = ?",
      [group_name, payment_deadline || null, groupId]
    );
  },

  // Delete group
  delete: async (groupId) => {
    await db.query("DELETE FROM expense_group WHERE id = ?", [groupId]);
  },

  // Get group members with payment status
  getGroupMembers: async (groupId) => {
    const [rows] = await db.query(
      `SELECT egm.*,
        a.username, a.email
      FROM expense_group_member egm
      JOIN account a ON egm.account_id = a.id
      WHERE egm.group_id = ?
      ORDER BY egm.created_at`,
      [groupId]
    );
    return rows;
  },

  // Get group statistics
  getGroupStats: async (groupId) => {
    const [rows] = await db.query(
      `SELECT
        COUNT(DISTINCT egm.account_id) AS total_members,
        SUM(CASE WHEN egm.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_members,
        SUM(CASE WHEN egm.payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_members,
        SUM(egm.amount) AS total_amount,
        SUM(CASE WHEN egm.payment_status = 'paid' THEN egm.amount ELSE 0 END) AS paid_amount,
        SUM(CASE WHEN egm.payment_status = 'unpaid' THEN egm.amount ELSE 0 END) AS unpaid_amount
      FROM expense_group_member egm
      WHERE egm.group_id = ?`,
      [groupId]
    );
    return rows[0] || null;
  },

  // Báo cáo chỉ tiêu nhóm theo tháng cho 1 user (dựa trên expense_group_member.amount + payment_status)
  // - lọc theo tháng/năm của expense_group.created_at
  // - kèm thống kê tổng số tiền nhóm chưa trả (sum unpaid của TẤT CẢ thành viên trong nhóm)
  getUserMonthlyTargetReport: async (userId, year, month) => {
    const [rows] = await db.query(
      `SELECT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        eg.payment_deadline,
        eg.created_at AS group_created_at,
        egm.amount AS target_amount,
        egm.payment_status,
        egm.join_status,
        totals.group_total_amount,
        totals.group_unpaid_amount
      FROM expense_group_member egm
      JOIN expense_group eg ON egm.group_id = eg.id
      LEFT JOIN (
        SELECT
          egm2.group_id,
          SUM(egm2.amount) AS group_total_amount,
          SUM(CASE WHEN egm2.payment_status = 'unpaid' THEN egm2.amount ELSE 0 END) AS group_unpaid_amount
        FROM expense_group_member egm2
        GROUP BY egm2.group_id
      ) totals ON totals.group_id = eg.id
      WHERE egm.account_id = ?
        AND egm.join_status = 'accepted'
        AND YEAR(eg.created_at) = ?
        AND MONTH(eg.created_at) = ?
      ORDER BY eg.created_at DESC`,
      [userId, year, month]
    );

    const totals = rows.reduce(
      (acc, r) => {
        const amt = parseFloat(r.target_amount || 0);
        acc.total_target += amt;
        if (r.payment_status === "paid") acc.total_paid += amt;
        else acc.total_unpaid += amt;

        const groupUnpaid = parseFloat(r.group_unpaid_amount || 0);
        acc.total_group_unpaid += groupUnpaid;
        return acc;
      },
      { total_target: 0, total_paid: 0, total_unpaid: 0, total_group_unpaid: 0 }
    );

    return { rows, totals };
  }
};

module.exports = ExpenseGroup;
