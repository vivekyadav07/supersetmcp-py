const { pool } = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');
const { customAlphabet } = require('nanoid');

const generatePerfId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function createPerformance(user, tenantId, targetId, body) {
  assertCan(user, 'create_sla_performance', tenantId);

  // Validate that the target exists
  const [target] = await pool.query('SELECT id FROM sla_targets WHERE id = ? AND tenantId = ?', [targetId, tenantId]);
  if (target.length === 0) {
    throw new ApiError(404, 'SLA Target not found');
  }

  const { actualValue, notes } = body;
  const newPerf = {
    id: generatePerfId(),
    tenantId,
    targetId,
    actualValue,
    notes,
    status: 'Pending',
    createdBy: user.id,
  };

  await pool.query('INSERT INTO sla_performance SET ?', newPerf);
  return newPerf;
}

async function updatePerformance(user, tenantId, perfId, body) {
    assertCan(user, 'update_sla_performance', tenantId);

    const [original] = await pool.query('SELECT * FROM sla_performance WHERE id = ? AND tenantId = ?', [perfId, tenantId]);
    if (original.length === 0) {
        throw new ApiError(404, 'Performance record not found');
    }

    const fieldsToUpdate = {};
    if (body.actualValue !== undefined) fieldsToUpdate.actualValue = body.actualValue;
    if (body.notes !== undefined) fieldsToUpdate.notes = body.notes;
    // Don't allow status update here, use confirmPerformance for that

    if (Object.keys(fieldsToUpdate).length === 0) return original[0];

    await pool.query('UPDATE sla_performance SET ? WHERE id = ?', [fieldsToUpdate, perfId]);
    return { ...original[0], ...fieldsToUpdate };
}

async function deletePerformance(user, tenantId, perfId) {
    assertCan(user, 'delete_sla_performance', tenantId);

    const [perf] = await pool.query('SELECT * FROM sla_performance WHERE id = ? AND tenantId = ?', [perfId, tenantId]);
    if (perf.length === 0) {
        throw new ApiError(404, 'Performance record not found');
    }

    await pool.query('DELETE FROM sla_performance WHERE id = ?', [perfId]);
    return perf[0];
}

async function listPerformance(user, tenantId, targetId = null) {
  assertCan(user, 'list_sla_performance', tenantId);

  let sql = 'SELECT * FROM sla_performance WHERE tenantId = ?';
  const params = [tenantId];

  if (targetId) {
    sql += ' AND targetId = ?';
    params.push(targetId);
  }

  sql += ' ORDER BY date DESC';

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getPendingPerformance(user, tenantId) {
  assertCan(user, 'list_pending_sla_performance', tenantId);
  const [rows] = await pool.query(
      'SELECT * FROM sla_performance WHERE tenantId = ? AND status = "Pending" ORDER BY date ASC',
      [tenantId]
  );
  return rows;
}

async function confirmPerformance(user, tenantId, perfId) {
  assertCan(user, 'confirm_sla_performance', tenantId);

  const [original] = await pool.query('SELECT * FROM sla_performance WHERE id = ? AND tenantId = ?', [perfId, tenantId]);
  if (original.length === 0) {
    throw new ApiError(404, 'Performance record not found');
  }

  if (original[0].status === 'Confirmed') {
      return original[0]; // Already confirmed
  }

  const updates = {
      status: 'Confirmed',
      confirmedBy: user.id
  };

  await pool.query('UPDATE sla_performance SET ? WHERE id = ?', [updates, perfId]);
  return { ...original[0], ...updates };
}

module.exports = {
  createPerformance,
  updatePerformance,
  deletePerformance,
  listPerformance,
  getPendingPerformance,
  confirmPerformance,
};