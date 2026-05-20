const db = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

function isDuplicate(tenantId, name, categoryId, excludeId) {
  return db.get('sla_targets').some(
    (t) =>
      t.tenantId === tenantId &&
      t.id !== excludeId &&
      t.name.toLowerCase() === name.toLowerCase() &&
      (!categoryId || t.categoryId === categoryId)
  );
}

async function listCategories(user, tenantId) {
  assertCan(user, 'list_sla_categories', tenantId);
  return db.findByTenant('sla_categories', tenantId);
}

async function listTargets(user, tenantId) {
  assertCan(user, 'list_sla_targets', tenantId);
  return db.findByTenant('sla_targets', tenantId);
}

async function checkDuplicate(user, tenantId, { name, categoryId }) {
  assertCan(user, 'check_sla_target_duplicate', tenantId);
  const duplicate = isDuplicate(tenantId, name, categoryId);
  return { duplicate, message: duplicate ? 'SLA target with this name already exists' : null };
}

async function createTarget(user, tenantId, body) {
  assertCan(user, 'create_sla_target', tenantId);
  if (isDuplicate(tenantId, body.name, body.categoryId)) {
    throw new ApiError(409, 'SLA target with this name already exists for tenant');
  }
  const target = {
    id: db.generateId('st'),
    tenantId,
    categoryId: body.categoryId,
    name: body.name,
    objective: body.objective,
    unit: body.unit || 'percent',
    period: body.period || 'monthly',
    active: body.active !== false,
  };
  await db.updateCollection('sla_targets', (items) => [...items, target]);
  return target;
}

async function updateTarget(user, tenantId, id, body) {
  assertCan(user, 'update_sla_target', tenantId);
  if (body.name && isDuplicate(tenantId, body.name, body.categoryId, id)) {
    throw new ApiError(409, 'SLA target with this name already exists');
  }
  let updated = null;
  await db.updateCollection('sla_targets', (items) =>
    items.map((t) => {
      if (t.id !== id || t.tenantId !== tenantId) return t;
      updated = { ...t, ...body, id: t.id, tenantId };
      return updated;
    })
  );
  if (!updated) throw new ApiError(404, 'SLA target not found');
  return updated;
}

async function deleteTarget(user, tenantId, id) {
  assertCan(user, 'delete_sla_target', tenantId);
  const target = db.findById('sla_targets', id);
  if (!target || target.tenantId !== tenantId) throw new ApiError(404, 'SLA target not found');
  await db.updateCollection('sla_targets', (items) => items.filter((t) => t.id !== id));
  return target;
}

module.exports = {
  listCategories,
  listTargets,
  checkDuplicate,
  createTarget,
  updateTarget,
  deleteTarget,
};
