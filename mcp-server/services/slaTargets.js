const { pool } = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');
const { customAlphabet } = require('nanoid');

const generateSlaId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function listSlaTargets(user, tenantId) {
  assertCan(user, 'list_sla_targets', tenantId);
  const [rows] = await pool.query('SELECT * FROM sla_targets WHERE tenantId = ? ORDER BY createdAt DESC', [tenantId]);
  return rows;
}

async function createSlaTarget(user, tenantId, body) {
  assertCan(user, 'create_sla_target', tenantId);

  const { name, category, metric, targetValue } = body;

  // Optional: Check for duplicates
  const [existing] = await pool.query(
    'SELECT id FROM sla_targets WHERE tenantId = ? AND name = ? AND category = ?',
    [tenantId, name, category]
  );
  if (existing.length > 0) {
    throw new ApiError(409, 'An SLA Target with the same name and category already exists.');
  }

  const newTarget = {
    id: generateSlaId(),
    tenantId,
    name,
    category,
    metric,
    targetValue,
  };

  await pool.query('INSERT INTO sla_targets SET ?', newTarget);
  return newTarget;
}

async function updateSlaTarget(user, tenantId, targetId, body) {
    assertCan(user, 'update_sla_target', tenantId);

    const [original] = await pool.query('SELECT * FROM sla_targets WHERE id = ? AND tenantId = ?', [targetId, tenantId]);
    if (original.length === 0) {
        throw new ApiError(404, 'SLA Target not found');
    }

    const fieldsToUpdate = {};
    if (body.name) fieldsToUpdate.name = body.name;
    if (body.category) fieldsToUpdate.category = body.category;
    if (body.metric) fieldsToUpdate.metric = body.metric;
    if (body.targetValue !== undefined) fieldsToUpdate.targetValue = body.targetValue;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return original[0];
    }

    await pool.query('UPDATE sla_targets SET ? WHERE id = ?', [fieldsToUpdate, targetId]);
    return { ...original[0], ...fieldsToUpdate };
}

async function deleteSlaTarget(user, tenantId, targetId) {
    assertCan(user, 'delete_sla_target', tenantId);

    const [target] = await pool.query('SELECT * FROM sla_targets WHERE id = ? AND tenantId = ?', [targetId, tenantId]);
    if (target.length === 0) {
        throw new ApiError(404, 'SLA Target not found');
    }

    // ON DELETE CASCADE will handle sla_performance records
    await pool.query('DELETE FROM sla_targets WHERE id = ?', [targetId]);
    return target[0];
}

async function listSlaCategories(user, tenantId) {
    assertCan(user, 'list_sla_categories', tenantId);
    const [rows] = await pool.query(
        'SELECT DISTINCT category FROM sla_targets WHERE tenantId = ? AND category IS NOT NULL ORDER BY category',
        [tenantId]
    );
    return rows.map(r => r.category);
}

module.exports = {
  listSlaTargets,
  createSlaTarget,
  updateSlaTarget,
  deleteSlaTarget,
  listSlaCategories,
};