const pending = new Map();

function create(action, userId, params) {
  const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  pending.set(token, { action, userId, params, createdAt: Date.now() });
  return token;
}

function consume(token, userId) {
  const entry = pending.get(token);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  pending.delete(token);
  return entry;
}

module.exports = { create, consume };
