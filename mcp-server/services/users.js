const { pool } = require('../db');
const { can } = require('../rbac');
const { ApiError } = require('./tenants');
const { customAlphabet } = require('nanoid');

const generateUserId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
const generateToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

function assertCan(user, action, tenantId) {
  if (!can(user, action, { tenantId })) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function listUsers(user, tenantId) {
  assertCan(user, 'list_users', tenantId);

  const sql = `
    SELECT u.id, u.email, u.name, u.role, u.status 
    FROM users u
    JOIN user_tenants ut ON u.id = ut.userId
    WHERE ut.tenantId = ?
  `;
  const [users] = await pool.query(sql, [tenantId]);
  return users;
}

async function inviteUser(user, tenantId, body) {
  assertCan(user, 'invite_user', tenantId);

  const { email, name, role = 'user' } = body;
  const lowerEmail = (email || '').toLowerCase();

  // Check if user already exists
  const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [lowerEmail]);
  if (existing.length > 0) {
    // If user exists, just add them to the new tenant if they aren't already in it
    const existingUser = existing[0];
    const [userLinks] = await pool.query('SELECT * FROM user_tenants WHERE userId = ? AND tenantId = ?', [existingUser.id, tenantId]);
    if (userLinks.length === 0) {
      await pool.query('INSERT INTO user_tenants (userId, tenantId) VALUES (?, ?)', [existingUser.id, tenantId]);
    }
    return { user: existingUser, inviteToken: null, message: 'Existing user added to tenant.' };
  }

  // If user does not exist, create them
  const inviteToken = generateToken();
  const newUser = {
    id: generateUserId(),
    email: lowerEmail,
    name: name || lowerEmail.split('@')[0],
    role,
    status: 'invited',
    inviteToken,
  };

  // Use a transaction to ensure both inserts succeed or neither do
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO users SET ?', newUser);
    await connection.query('INSERT INTO user_tenants (userId, tenantId) VALUES (?, ?)', [newUser.id, tenantId]);
    await connection.commit();
    return { user: newUser, inviteToken };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUser(user, tenantId, userId, body) {
  assertCan(user, 'update_user', tenantId);

  // Verify user is in the specified tenant
  const [userLinks] = await pool.query('SELECT * FROM user_tenants WHERE userId = ? AND tenantId = ?', [userId, tenantId]);
  if (userLinks.length === 0) {
    throw new ApiError(404, 'User not found in this tenant');
  }

  const fieldsToUpdate = {};
  if (body.name) fieldsToUpdate.name = body.name;
  if (body.role) fieldsToUpdate.role = body.role; // Be careful with role updates! Add extra RBAC checks if needed.
  if (body.status) fieldsToUpdate.status = body.status;

  if (Object.keys(fieldsToUpdate).length === 0) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows[0];
  }

  await pool.query('UPDATE users SET ? WHERE id = ?', [fieldsToUpdate, userId]);

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  return rows[0];
}

async function deleteUser(user, tenantId, userId) {
  assertCan(user, 'delete_user', tenantId);

  // This will just remove the user's link to the tenant, not delete the user globally.
  // This is generally safer in a multi-tenant system.
  const [userLinks] = await pool.query('SELECT * FROM user_tenants WHERE userId = ? AND tenantId = ?', [userId, tenantId]);
  if (userLinks.length === 0) {
    throw new ApiError(404, 'User not found in this tenant');
  }

  await pool.query('DELETE FROM user_tenants WHERE userId = ? AND tenantId = ?', [userId, tenantId]);

  // Optional: If user belongs to no other tenants, you could delete them globally.
  // const [remainingLinks] = await pool.query('SELECT * FROM user_tenants WHERE userId = ?', [userId]);
  // if (remainingLinks.length === 0) {
  //   await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  // }

  return { message: `User ${userId} removed from tenant ${tenantId}.` };
}

async function getUserById(id) {
    const [rows] = await pool.query('SELECT id, email, name, role, status FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return null;

    const user = rows[0];

    // Also fetch the list of tenant IDs the user belongs to
    const [tenantRows] = await pool.query('SELECT tenantId FROM user_tenants WHERE userId = ?', [id]);
    user.tenantIds = tenantRows.map(row => row.tenantId);

    return user;
}

module.exports = {
  listUsers,
  inviteUser,
  updateUser,
  deleteUser,
  getUserById,
};