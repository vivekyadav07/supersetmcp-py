const { pool } = require('../db');
const { ApiError } = require('./tenants');
const { customAlphabet } = require('nanoid');
const bcrypt = require('bcryptjs');

const generateUserId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
const generateTenantId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

// --- Helper Functions ---

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function comparePassword(plain, hash) {
  // Handles the case where the hash might be null or undefined
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

// --- Main Authentication Logic ---

async function findByLoginId(loginId) {
  const key = (loginId || '').trim().toLowerCase();
  const sql = 'SELECT * FROM users WHERE LOWER(id) = ? OR LOWER(email) = ?';
  const [rows] = await pool.query(sql, [key, key]);
  return rows[0] || null;
}

async function signIn({ userId, password }) {
  const user = await findByLoginId(userId);

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    // --- TEMPORARY MIGRATION LOGIC ---
    // This block checks if the stored password is the old, un-encrypted one.
    // This is a temporary measure to upgrade passwords securely.
    if (user.password === password) {
      console.log(`Upgrading password for user: ${user.id}`);
      const newHashedPassword = await hashPassword(password);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, user.id]);
      // The login can now proceed.
    } else {
      // If it's not a match and not a legacy password, then it's truly invalid.
      throw new ApiError(401, 'Invalid credentials');
    }
  }

  if (user.status !== 'active') {
    throw new ApiError(403, `Account is not active. Current status: ${user.status}`);
  }

  // Attach the user's tenant IDs
  const [tenantRows] = await pool.query('SELECT tenantId FROM user_tenants WHERE userId = ?', [user.id]);
  user.tenantIds = tenantRows.map(row => row.tenantId);

  return sanitizeUser(user);
}

async function signUp(body) {
  const { email, name, password, tenantCode } = body;

  if (!email || !name || !password || !tenantCode) {
    throw new ApiError(400, 'Email, name, password, and tenantCode are required.');
  }

  const upperCode = tenantCode.toUpperCase().trim();
  let tenantId;
  let isNewTenant = false;

  // 1. Get or Create Tenant
  const [tenants] = await pool.query('SELECT id FROM tenants WHERE code = ?', [upperCode]);
  
  if (tenants.length === 0) {
      tenantId = generateTenantId();
      isNewTenant = true;
      console.log(`Auto-creating new tenant with code: ${upperCode}`);
  } else {
      tenantId = tenants[0].id;
  }

  // 2. Check for existing user
  const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (users.length > 0) {
    throw new ApiError(409, 'A user with this email already exists.');
  }

  // 3. Hash password and create user object
  const hashedPassword = await hashPassword(password);
  const assignedRole = isNewTenant ? 'system_admin' : 'user';

  const newUser = {
    id: generateUserId(),
    email: email.toLowerCase(),
    name,
    password: hashedPassword,
    role: assignedRole, 
    status: 'active',
  };

  // 4. Use a transaction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    if (isNewTenant) {
         const newTenant = {
            id: tenantId,
            name: `${upperCode} Tenant`,
            code: upperCode,
            status: 'active'
        };
        await connection.query('INSERT INTO tenants SET ?', newTenant);
    }

    await connection.query('INSERT INTO users SET ?', newUser);
    await connection.query('INSERT INTO user_tenants (userId, tenantId) VALUES (?, ?)', [newUser.id, tenantId]);
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('SIGNUP TRANSACTION FAILED:', error);
    throw new ApiError(500, 'Could not complete signup.');
  } finally {
    connection.release();
  }

  newUser.tenantIds = [tenantId];
  return sanitizeUser(newUser);
}


module.exports = {
  signIn,
  signUp,
  sanitizeUser,
  findByLoginId,
};