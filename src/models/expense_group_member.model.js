const db = require("../config/db");

const ExpenseGroupMember = {
  // Add member to group
  addMember: async ({ group_id, account_id, amount, payment_deadline }) => {
    const [result] = await db.query(
      `INSERT INTO expense_group_member (group_id, account_id, amount, payment_deadline)
       VALUES (?, ?, ?, ?)`,
      [group_id, account_id, amount || 0, payment_deadline || null]
    );
    return result.insertId;
  },

  // Get member by group and account
  getMember: async (groupId, accountId) => {
    const [rows] = await db.query(
      `SELECT egm.*,
        a.username, a.email,
        eg.group_name
      FROM expense_group_member egm
      JOIN account a ON egm.account_id = a.id
      JOIN expense_group eg ON egm.group_id = eg.id
      WHERE egm.group_id = ? AND egm.account_id = ?`,
      [groupId, accountId]
    );
    return rows[0] || null;
  },

  // Update member status
  updateMemberStatus: async (groupId, accountId, { join_status, payment_status, owner_confirm_status }) => {
    let updateFields = [];
    let updateValues = [];

    if (join_status !== undefined) {
      updateFields.push("join_status = ?");
      updateValues.push(join_status);
    }

    if (payment_status !== undefined) {
      updateFields.push("payment_status = ?");
      updateValues.push(payment_status);
    }

    if (owner_confirm_status !== undefined) {
      updateFields.push("owner_confirm_status = ?");
      updateValues.push(owner_confirm_status);
    }

    if (updateFields.length === 0) return;

    updateValues.push(groupId, accountId);

    await db.query(
      `UPDATE expense_group_member SET ${updateFields.join(", ")} WHERE group_id = ? AND account_id = ?`,
      updateValues
    );
  },

  // Update member amount and deadline
  updateMemberDetails: async (groupId, accountId, { amount, payment_deadline, proof_image_url }) => {
    await db.query(
      `UPDATE expense_group_member
       SET amount = ?, payment_deadline = ?, proof_image_url = ?
       WHERE group_id = ? AND account_id = ?`,
      [amount, payment_deadline || null, proof_image_url || null, groupId, accountId]
    );
  },

  // Remove member from group
  removeMember: async (groupId, accountId) => {
    await db.query(
      "DELETE FROM expense_group_member WHERE group_id = ? AND account_id = ?",
      [groupId, accountId]
    );
  },

  // Get pending join requests for a group owner
  getPendingRequests: async (groupId) => {
    const [rows] = await db.query(
      `SELECT egm.*,
        a.username, a.email
      FROM expense_group_member egm
      JOIN account a ON egm.account_id = a.id
      WHERE egm.group_id = ? AND egm.join_status = 'pending'`,
      [groupId]
    );
    return rows;
  },

  // Get unpaid members in a group
  getUnpaidMembers: async (groupId) => {
    const [rows] = await db.query(
      `SELECT egm.*,
        a.username, a.email
      FROM expense_group_member egm
      JOIN account a ON egm.account_id = a.id
      WHERE egm.group_id = ? AND egm.payment_status = 'unpaid' AND egm.join_status = 'accepted'`,
      [groupId]
    );
    return rows;
  },

  // Bulk update members (for group creation)
  bulkAddMembers: async (members) => {
    if (members.length === 0) return;

    const values = members.map(member =>
      `(${member.group_id}, ${member.account_id}, ${member.amount || 0}, ${member.payment_deadline ? `'${member.payment_deadline}'` : 'NULL'})`
    ).join(", ");

    await db.query(
      `INSERT INTO expense_group_member (group_id, account_id, amount, payment_deadline) VALUES ${values}`
    );
  }
};

module.exports = ExpenseGroupMember;
