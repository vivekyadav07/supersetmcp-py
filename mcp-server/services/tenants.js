const db = require('../db');
const { can } = require('../rbac');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function listTenants(user) {
  assertCan(user, 'list_tenants');
  let tenants = db.get('tenants');
  if (user.role !== 'system_admin') {
    tenants = tenants.filter((t) => user.tenantIds.includes(t.id));
  }
  return tenants;
}

async function getTenant(user, id) {
  const tenant = db.findById('tenants', id);
  if (!tenant) throw new ApiError(404, 'Tenant not found');
  assertCan(user, 'get_tenant', id);
  return tenant;
}

async function getTenantByCode(user, code) {
  const tenant = db.get('tenants').find((t) => t.code.toUpperCase() === code.toUpperCase());
  if (!tenant) throw new ApiError(404, 'Tenant not found');
  assertCan(user, 'get_tenant', tenant.id);
  return tenant;
}

async function createTenant(user, body) {
  assertCan(user, 'create_tenant');
  const existing = db.get('tenants').find(
    (t) => t.code.toUpperCase() === (body.code || '').toUpperCase()
  );
  if (existing) throw new ApiError(409, 'Tenant code already exists');

  const tenant = {
    id: db.generateId('t'),
    name: body.name,
    code: (body.code || body.name).toUpperCase().replace(/\s+/g, '_').slice(0, 20),
    status: body.status || 'active',
    createdAt: new Date().toISOString(),
  };

  await db.updateCollection('tenants', (items) => [...items, tenant]);
  return tenant;
}

async function updateTenant(user, id, body) {
  assertCan(user, 'update_tenant', id);
  let updated = null;
  await db.updateCollection('tenants', (items) =>
    items.map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, ...body, id: t.id };
      return updated;
    })
  );
  if (!updated) throw new ApiError(404, 'Tenant not found');
  return updated;
}

async function deleteTenant(user, id) {
  assertCan(user, 'delete_tenant', id);
  const tenant = db.findById('tenants', id);
  if (!tenant) throw new ApiError(404, 'Tenant not found');
  await db.updateCollection('tenants', (items) => items.filter((t) => t.id !== id));
  return tenant;
}

module.exports = {
  listTenants,
  getTenant,
  getTenantByCode,
  createTenant,
  updateTenant,
  deleteTenant,
  ApiError,
};
