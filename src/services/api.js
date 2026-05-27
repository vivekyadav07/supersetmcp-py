const API_BASE = 'http://localhost:3000';

function authHeaders(userId) {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
}

export async function authSignIn({ userId, password }) {
  const res = await fetch(`${API_BASE}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Sign in failed');
  return body.data;
}

export async function authSignupStart(payload) {
  const res = await fetch(`${API_BASE}/api/auth/signup/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Signup failed');
  return body.data;
}

export async function authSignupVerify({ sessionId, type, code }) {
  const res = await fetch(`${API_BASE}/api/auth/signup/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, type, code }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Verification failed');
  return body.data;
}

export async function authSignupResend({ sessionId, type }) {
  const res = await fetch(`${API_BASE}/api/auth/signup/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, type }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Resend failed');
  return body.data;
}

export async function authSignupComplete({ sessionId }) {
  const res = await fetch(`${API_BASE}/api/auth/signup/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Could not complete signup');
  return body.data;
}

export async function fetchMe(userId) {
  const res = await fetch(`${API_BASE}/api/me?userId=${encodeURIComponent(userId)}`, {
    headers: authHeaders(userId),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load user context');
  }
  const body = await res.json();
  return body.data;
}

export async function askAI(query) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || 'Something went wrong');
  }

  return await res.json();
}

export async function chatPortal(payload) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || body.content || 'Portal chat failed');
  }
  return body;
}

export async function confirmPortalAction({ token, userId }) {
  const res = await fetch(`${API_BASE}/chat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, userId }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || 'Confirmation failed');
  }
  return body;
}
