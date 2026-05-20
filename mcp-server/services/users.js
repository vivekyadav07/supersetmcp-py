const db = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

function usersForTenant(tenantId) {
  return db.get('users').filter((u) => (u.tenantIds || []).includes(tenantId));
}

async function listUsers(user, tenantId) {
  assertCan(user, 'list_users', tenantId);
  return usersForTenant(tenantId);
}

async function inviteUser(user, tenantId, body) {
  assertCan(user, 'invite_user', tenantId);
  const email = (body.email || '').toLowerCase();
  const existing = db.get('users').find((u) => u.email === email);
  if (existing) throw new ApiError(409, 'User with this email already exists');

  const inviteToken = `inv_${Math.random().toString(36).slice(2, 11)}`;
  const newUser = {
    id: db.generateId('u'),
    email,
    name: body.name || email.split('@')[0],
    role: body.role || 'user',
    tenantIds: [tenantId],
    status: 'invited',
    inviteToken,
  };

  await db.updateCollection('users', (items) => [...items, newUser]);
  return { user: newUser, inviteToken };
}

async function updateUser(user, tenantId, userId, body) {
  assertCan(user, 'update_user', tenantId);
  let updated = null;
  await db.updateCollection('users', (items) =>
    items.map((u) => {
      if (u.id !== userId) return u;
      if (!(u.tenantIds || []).includes(tenantId)) return u;
      updated = { ...u, ...body, id: u.id };
      return updated;
    })
  );
  if (!updated) throw new ApiError(404, 'User not found');
  return updated;
}

async function deleteUser(user, tenantId, userId) {
  assertCan(user, 'delete_user', tenantId);
  const target = db.findById('users', userId);
  if (!target || !(target.tenantIds || []).includes(tenantId)) {
    throw new ApiError(404, 'User not found');
  }
  await db.updateCollection('users', (items) => items.filter((u) => u.id !== userId));
  return target;
}

function getUserById(id) {
  return db.findById('users', id);
}

module.exports = {
  listUsers,
  inviteUser,
  updateUser,
  deleteUser,
  getUserById,
};
