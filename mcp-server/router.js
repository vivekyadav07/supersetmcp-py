const { parsePortalIntent } = require('./portal-llm');
const { runIntent, runConfirmedAction } = require('./actionRunner');
const users = require('./services/users');
const { ApiError } = require('./services/tenants');

const SUPERSET_KEYWORDS = /\b(chart|dashboard|sql|visuali[sz]e|plot|graph|revenue|sales|top\s+\d+)\b/i;

function shouldUseSuperset(activeTab, query) {
  if (activeTab === 'dashboards') return true;
  return SUPERSET_KEYWORDS.test(query);
}

async function handlePortalChat(body) {
  const { query, activeTab, tenantId, userId, askedAs } = body;

  const user = users.getUserById(userId);
  if (!user) {
    throw new ApiError(401, 'Invalid user');
  }

  const parsed = await parsePortalIntent({
    query,
    activeTab,
    user,
    selectedTenantId: tenantId,
    askedAs,
  });

  const result = await runIntent(user, parsed.intent, parsed.params, {
    needsConfirmation: parsed.needsConfirmation,
    userId,
  });

  return {
    content: parsed.reply || result.content,
    payload: result.payload,
    confirmationToken: result.confirmationToken || parsed.confirmationToken,
    intent: parsed.intent,
  };
}

async function handleConfirm(body) {
  const { token, userId } = body;
  const user = users.getUserById(userId);
  if (!user) throw new ApiError(401, 'Invalid user');
  const result = await runConfirmedAction(user, token, userId);
  return { content: result.content, payload: result.payload };
}

module.exports = { shouldUseSuperset, handlePortalChat, handleConfirm };
