const db = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function listPerformance(user, tenantId) {
  assertCan(user, 'list_sla_performance', tenantId);
  return db.findByTenant('sla_performance', tenantId);
}

async function getPerformance(user, tenantId, id) {
  assertCan(user, 'get_sla_performance', tenantId);
  const perf = db.findById('sla_performance', id);
  if (!perf || perf.tenantId !== tenantId) throw new ApiError(404, 'Performance record not found');
  return perf;
}

async function listPending(user, tenantId) {
  assertCan(user, 'list_pending_sla_performance', tenantId);
  return db.findByTenant('sla_performance', tenantId).filter((p) => p.status === 'pending');
}

async function getStatusByTarget(user, tenantId, targetId) {
  assertCan(user, 'get_sla_performance_status', tenantId);
  const records = db
    .findByTenant('sla_performance', tenantId)
    .filter((p) => p.targetId === targetId);
  return { targetId, records, pending: records.filter((r) => r.status === 'pending').length };
}

async function createPerformance(user, tenantId, body) {
  assertCan(user, 'create_sla_performance', tenantId);
  const perf = {
    id: db.generateId('sp'),
    tenantId,
    targetId: body.targetId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    actualValue: body.actualValue,
    status: body.status || 'pending',
    confirmedAt: null,
    confirmedBy: null,
  };
  await db.updateCollection('sla_performance', (items) => [...items, perf]);
  return perf;
}

async function updatePerformance(user, tenantId, id, body) {
  assertCan(user, 'update_sla_performance', tenantId);
  let updated = null;
  await db.updateCollection('sla_performance', (items) =>
    items.map((p) => {
      if (p.id !== id || p.tenantId !== tenantId) return p;
      updated = { ...p, ...body, id: p.id, tenantId };
      return updated;
    })
  );
  if (!updated) throw new ApiError(404, 'Performance record not found');
  return updated;
}

async function deletePerformance(user, tenantId, id) {
  assertCan(user, 'delete_sla_performance', tenantId);
  const perf = db.findById('sla_performance', id);
  if (!perf || perf.tenantId !== tenantId) throw new ApiError(404, 'Performance record not found');
  await db.updateCollection('sla_performance', (items) => items.filter((p) => p.id !== id));
  return perf;
}

async function confirmPerformance(user, tenantId, id, confirmedBy) {
  assertCan(user, 'confirm_sla_performance', tenantId);
  let updated = null;
  await db.updateCollection('sla_performance', (items) =>
    items.map((p) => {
      if (p.id !== id || p.tenantId !== tenantId) return p;
      if (p.status !== 'pending') throw new ApiError(400, 'Performance is not pending');
      updated = {
        ...p,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmedBy,
      };
      return updated;
    })
  );
  if (!updated) throw new ApiError(404, 'Performance record not found');
  return updated;
}

module.exports = {
  listPerformance,
  getPerformance,
  listPending,
  getStatusByTarget,
  createPerformance,
  updatePerformance,
  deletePerformance,
  confirmPerformance,
};
