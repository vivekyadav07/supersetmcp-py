const { pool } = require('../db');
const { can } = require('../rbac');
const { customAlphabet } = require('nanoid');

// A more robust way to generate short, unique, URL-friendly IDs
const generateTenantId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

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

  if (user.role === 'system_admin') {
    const [rows] = await pool.query('SELECT * FROM tenants ORDER BY createdAt DESC');
    return rows;
  }

  // For non-admins, get tenants they are explicitly linked to
  const sql = `
    SELECT t.* 
    FROM tenants t
    JOIN user_tenants ut ON t.id = ut.tenantId
    WHERE ut.userId = ?
    ORDER BY t.createdAt DESC
  `;
  const [rows] = await pool.query(sql, [user.id]);
  return rows;
}

async function getTenant(user, id) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [id]);
  const tenant = rows[0];

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  assertCan(user, 'get_tenant', tenant.id);
  return tenant;
}

async function getTenantByCode(user, code) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE code = ?', [code.toUpperCase()]);
  const tenant = rows[0];

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  assertCan(user, 'get_tenant', tenant.id);
  return tenant;
}

async function createTenant(user, body) {
  assertCan(user, 'create_tenant');

  const { name, code, status = 'active' } = body;
  const upperCode = (code || name).toUpperCase().replace(/\s+/g, '_').slice(0, 20);

  // Check for duplicates
  const [existing] = await pool.query('SELECT id FROM tenants WHERE code = ?', [upperCode]);
  if (existing.length > 0) {
    throw new ApiError(409, 'Tenant code already exists');
  }

  const newTenant = {
    id: generateTenantId(),
    name,
    code: upperCode,
    status,
  };

  const sql = 'INSERT INTO tenants (id, name, code, status) VALUES (?, ?, ?, ?)';
  await pool.query(sql, [newTenant.id, newTenant.name, newTenant.code, newTenant.status]);

  return newTenant;
}

async function updateTenant(user, id, body) {
  assertCan(user, 'update_tenant', id);

  // First, ensure the tenant exists
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [id]);
  const originalTenant = rows[0];
  if (!originalTenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  // Build the update query dynamically to only change fields that are provided
  const fieldsToUpdate = {};
  if (body.name) fieldsToUpdate.name = body.name;
  if (body.code) fieldsToUpdate.code = body.code.toUpperCase();
  if (body.status) fieldsToUpdate.status = body.status;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return originalTenant; // Nothing to update
  }

  const sql = 'UPDATE tenants SET ? WHERE id = ?';
  await pool.query(sql, [fieldsToUpdate, id]);

  return { ...originalTenant, ...fieldsToUpdate };
}

async function deleteTenant(user, id) {
  assertCan(user, 'delete_tenant', id);

  // Ensure the tenant exists before trying to delete
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [id]);
  const tenant = rows[0];
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  // The database is set up with ON DELETE CASCADE,
  // so deleting a tenant will automatically delete related
  // user_tenants, sla_targets, and sla_performance records.
  await pool.query('DELETE FROM tenants WHERE id = ?', [id]);

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