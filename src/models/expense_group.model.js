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
  },

  // Lấy các nhóm mà user là owner có thành viên chưa hoàn thành trả nợ
  // - Các nhóm có thành viên chưa trả (payment_status = 'unpaid')
  // - Các nhóm có thành viên quá hạn (payment_status = 'unpaid' AND payment_deadline < NOW())
  getOwnerGroupsWithUnpaidMembers: async (ownerId) => {
    // Nhóm có thành viên chưa trả
    const [unpaidGroups] = await db.query(
      `SELECT DISTINCT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        eg.payment_deadline AS group_payment_deadline,
        eg.created_at,
        COUNT(DISTINCT egm.account_id) AS unpaid_member_count,
        SUM(egm.amount) AS total_unpaid_amount,
        GROUP_CONCAT(DISTINCT a.email SEPARATOR ', ') AS unpaid_emails
      FROM expense_group eg
      JOIN expense_group_member egm ON eg.id = egm.group_id
      JOIN account a ON egm.account_id = a.id
      WHERE eg.owner_id = ?
        AND egm.payment_status = 'unpaid'
        AND egm.join_status = 'accepted'
      GROUP BY eg.id, eg.group_name, eg.owner_id, eg.payment_deadline, eg.created_at
      ORDER BY eg.created_at DESC`,
      [ownerId]
    );

    // Nhóm có thành viên quá hạn
    const [overdueGroups] = await db.query(
      `SELECT DISTINCT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        eg.payment_deadline AS group_payment_deadline,
        eg.created_at,
        COUNT(DISTINCT egm.account_id) AS overdue_member_count,
        SUM(egm.amount) AS total_overdue_amount,
        GROUP_CONCAT(DISTINCT a.email SEPARATOR ', ') AS overdue_emails
      FROM expense_group eg
      JOIN expense_group_member egm ON eg.id = egm.group_id
      JOIN account a ON egm.account_id = a.id
      WHERE eg.owner_id = ?
        AND egm.payment_status = 'unpaid'
        AND egm.join_status = 'accepted'
        AND (egm.payment_deadline IS NOT NULL AND egm.payment_deadline < NOW())
      GROUP BY eg.id, eg.group_name, eg.owner_id, eg.payment_deadline, eg.created_at
      ORDER BY eg.created_at DESC`,
      [ownerId]
    );

    // Tính tổng
    const totalUnpaid = unpaidGroups.reduce((sum, g) => sum + parseFloat(g.total_unpaid_amount || 0), 0);
    const totalOverdue = overdueGroups.reduce((sum, g) => sum + parseFloat(g.total_overdue_amount || 0), 0);

    // Lấy tất cả email chưa trả (unique)
    const allUnpaidEmails = [...new Set(
      unpaidGroups
        .map(g => g.unpaid_emails ? g.unpaid_emails.split(', ') : [])
        .flat()
    )];

    return {
      unpaid_groups: unpaidGroups,
      overdue_groups: overdueGroups,
      total_unpaid_amount: totalUnpaid,
      total_overdue_amount: totalOverdue,
      unpaid_emails: allUnpaidEmails
    };
  },

  // Lấy trạng thái thanh toán của các nhóm mà user là thành viên
  // - Các nhóm chưa trả (payment_status = 'unpaid')
  // - Các nhóm đã trả (payment_status = 'paid' AND owner_confirm_status = 'confirmed')
  // - Các nhóm quá hạn (payment_status = 'unpaid' AND payment_deadline < NOW())
  getMemberPaymentStatus: async (memberId) => {
    // Nhóm chưa trả
    const [unpaidGroups] = await db.query(
      `SELECT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        a.username AS owner_username,
        a.email AS owner_email,
        egm.amount,
        egm.payment_status,
        egm.payment_deadline,
        eg.created_at
      FROM expense_group_member egm
      JOIN expense_group eg ON egm.group_id = eg.id
      JOIN account a ON eg.owner_id = a.id
      WHERE egm.account_id = ?
        AND egm.payment_status = 'unpaid'
        AND egm.join_status = 'accepted'
      ORDER BY eg.created_at DESC`,
      [memberId]
    );

    // Nhóm đã trả (đã được owner xác nhận)
    const [paidGroups] = await db.query(
      `SELECT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        a.username AS owner_username,
        a.email AS owner_email,
        egm.amount,
        egm.payment_status,
        egm.owner_confirm_status,
        egm.payment_deadline,
        eg.created_at
      FROM expense_group_member egm
      JOIN expense_group eg ON egm.group_id = eg.id
      JOIN account a ON eg.owner_id = a.id
      WHERE egm.account_id = ?
        AND egm.payment_status = 'paid'
        AND egm.owner_confirm_status = 'confirmed'
        AND egm.join_status = 'accepted'
      ORDER BY eg.created_at DESC`,
      [memberId]
    );

    // Nhóm quá hạn
    const [overdueGroups] = await db.query(
      `SELECT
        eg.id AS group_id,
        eg.group_name,
        eg.owner_id,
        a.username AS owner_username,
        a.email AS owner_email,
        egm.amount,
        egm.payment_status,
        egm.payment_deadline,
        eg.created_at
      FROM expense_group_member egm
      JOIN expense_group eg ON egm.group_id = eg.id
      JOIN account a ON eg.owner_id = a.id
      WHERE egm.account_id = ?
        AND egm.payment_status = 'unpaid'
        AND egm.join_status = 'accepted'
        AND (egm.payment_deadline IS NOT NULL AND egm.payment_deadline < NOW())
      ORDER BY eg.created_at DESC`,
      [memberId]
    );

    // Tính tổng số tiền chưa trả
    const totalUnpaid = unpaidGroups.reduce((sum, g) => sum + parseFloat(g.amount || 0), 0);

    return {
      unpaid_groups: unpaidGroups,
      paid_groups: paidGroups,
      overdue_groups: overdueGroups,
      total_unpaid_amount: totalUnpaid
    };
  }
};

module.exports = ExpenseGroup;
