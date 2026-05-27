const db = require('../db');
const { ApiError } = require('./tenants');

const pendingSignups = new Map();
const verificationCodes = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function findByLoginId(loginId) {
  const key = (loginId || '').trim().toLowerCase();
  return (
    db.get('users').find(
      (u) =>
        u.id.toLowerCase() === key ||
        (u.userId && u.userId.toLowerCase() === key) ||
        (u.email && u.email.toLowerCase() === key)
    ) || null
  );
}

async function signIn({ userId, password }) {
  const user = findByLoginId(userId);
  if (!user || user.password !== password) {
    throw new ApiError(401, 'Invalid user ID or password');
  }
  if (user.status === 'pending_verification') {
    throw new ApiError(403, 'Please complete email and mobile verification');
  }
  if (user.status !== 'active' && user.status !== 'invited') {
    throw new ApiError(403, 'Account is not active');
  }
  return sanitizeUser(user);
}

function startSignup(body) {
  const userId = (body.userId || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const mobile = (body.mobile || '').trim();
  const tenantCode = (body.tenantCode || '').trim().toUpperCase();
  const name = (body.name || '').trim();
  const password = body.password || '';

  if (!userId || !email || !mobile || !tenantCode || !name || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  const tenant = db.get('tenants').find((t) => t.code.toUpperCase() === tenantCode);
  if (!tenant) throw new ApiError(404, 'Tenant code not found');

  if (db.get('users').some((u) => u.userId && u.userId.toLowerCase() === userId.toLowerCase())) {
    throw new ApiError(409, 'User ID already exists');
  }
  if (db.get('users').some((u) => u.email === email)) {
    throw new ApiError(409, 'Email already registered');
  }

  const sessionId = `signup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const emailCode = generateCode();
  const mobileCode = generateCode();

  pendingSignups.set(sessionId, {
    sessionId,
    userId,
    name,
    email,
    mobile,
    tenantCode,
    tenantId: tenant.id,
    password,
    emailCode,
    mobileCode,
    emailVerified: false,
    mobileVerified: false,
    createdAt: Date.now(),
  });

  verificationCodes.set(`email:${email}`, emailCode);
  verificationCodes.set(`mobile:${mobile}`, mobileCode);

  return {
    sessionId,
    message: 'Verification codes sent (demo mode)',
    demoCodes: { email: emailCode, mobile: mobileCode },
  };
}

function verifySignupStep(sessionId, type, code) {
  const pending = pendingSignups.get(sessionId);
  if (!pending) throw new ApiError(400, 'Signup session expired. Please start again.');

  if (type === 'email') {
    if (pending.emailCode !== code) throw new ApiError(400, 'Invalid email verification code');
    pending.emailVerified = true;
  } else if (type === 'mobile') {
    if (pending.mobileCode !== code) throw new ApiError(400, 'Invalid mobile verification code');
    pending.mobileVerified = true;
  } else {
    throw new ApiError(400, 'Invalid verification type');
  }

  pendingSignups.set(sessionId, pending);
  return {
    sessionId,
    emailVerified: pending.emailVerified,
    mobileVerified: pending.mobileVerified,
    ready: pending.emailVerified && pending.mobileVerified,
  };
}

async function completeSignup(sessionId) {
  const pending = pendingSignups.get(sessionId);
  if (!pending) throw new ApiError(400, 'Signup session expired. Please start again.');
  if (!pending.emailVerified || !pending.mobileVerified) {
    throw new ApiError(400, 'Verify email and mobile before completing signup');
  }

  const newUser = {
    id: db.generateId('u'),
    userId: pending.userId,
    name: pending.name,
    email: pending.email,
    mobile: pending.mobile,
    password: pending.password,
    role: 'user',
    tenantIds: [pending.tenantId],
    status: 'active',
    emailVerified: true,
    mobileVerified: true,
    createdAt: new Date().toISOString(),
  };

  await db.updateCollection('users', (items) => [...items, newUser]);
  pendingSignups.delete(sessionId);

  return sanitizeUser(newUser);
}

function resendVerification(sessionId, type) {
  const pending = pendingSignups.get(sessionId);
  if (!pending) throw new ApiError(400, 'Signup session expired');

  const code = generateCode();
  if (type === 'email') {
    pending.emailCode = code;
    verificationCodes.set(`email:${pending.email}`, code);
  } else {
    pending.mobileCode = code;
    verificationCodes.set(`mobile:${pending.mobile}`, code);
  }
  pendingSignups.set(sessionId, pending);

  return {
    message: `New ${type} code sent (demo mode)`,
    demoCode: code,
  };
}

module.exports = {
  signIn,
  startSignup,
  verifySignupStep,
  completeSignup,
  resendVerification,
  sanitizeUser,
  findByLoginId,
};
