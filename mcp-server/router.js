const { parsePortalIntent } = require('./portal-llm');
const { runIntent, runConfirmedAction } = require('./actionRunner');
const users = require('./services/users');
const tenants = require('./services/tenants');
const slaTargets = require('./services/slaTargets');
const slaPerformance = require('./services/slaPerformance');
const { ApiError } = require('./services/tenants');

const SUPERSET_KEYWORDS = /\b(chart|dashboard|sql|visuali[sz]e|plot|graph|revenue|sales|top\s+\d+)\b/i;

function shouldUseSuperset(activeTab, query) {
  if (activeTab === 'dashboards') return true;
  return SUPERSET_KEYWORDS.test(query);
}

/**
 * Fetches the necessary data from the database based on the active UI tab.
 * This data is used to provide context to the LLM.
 * @param {object} user - The authenticated user object.
 * @param {string} activeTab - The name of the active tab in the frontend.
 * @param {string} tenantId - The currently selected tenant ID.
 * @returns {object} - An object containing data relevant to the tab.
 */
async function getTabData(user, activeTab, tenantId) {
  switch (activeTab) {
    case 'users':
      return {
        users: await users.listUsers(user, tenantId),
        tenant: tenantId ? await tenants.getTenant(user, tenantId) : null,
      };
    case 'tenants':
      return {
        tenants: await tenants.listTenants(user),
      };
    case 'sla_targets':
      return {
        sla_categories: await slaTargets.listSlaCategories(user, tenantId),
        sla_targets: await slaTargets.listSlaTargets(user, tenantId),
        tenant: tenantId ? await tenants.getTenant(user, tenantId) : null,
      };
    case 'sla_performance':
      return {
        sla_targets: await slaTargets.listSlaTargets(user, tenantId),
        sla_performance: await slaPerformance.listPerformance(user, tenantId),
        tenant: tenantId ? await tenants.getTenant(user, tenantId) : null,
      };
    default:
      return {};
  }
}

async function handlePortalChat(body) {
  const { query, activeTab, tenantId, userId, askedAs } = body;

  const user = await users.getUserById(userId);
  if (!user) {
    throw new ApiError(401, 'Invalid user');
  }

  // Fetch tab data from the new SQL-backed services
  const tabDataForLLM = await getTabData(user, activeTab, tenantId);

  const parsed = await parsePortalIntent({
    query,
    activeTab,
    user,
    selectedTenantId: tenantId,
    askedAs,
    tabData: tabDataForLLM,
  });

  // If the intent is a simple 'list' intent, the frontend can use the tabData directly.
  // We can also enrich the result here if needed.
  if (parsed.intent.startsWith('list_')) {
      const result = await runIntent(user, parsed.intent, parsed.params, {
          needsConfirmation: parsed.needsConfirmation,
          userId,
      });

      // The frontend expects the list data in the 'payload' field.
      // The `runIntent` function already returns this, so we just pass it through.
      return {
          content: parsed.reply || result.content,
          payload: result.payload,
          confirmationToken: result.confirmationToken,
          intent: parsed.intent,
      };
  }


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
  const user = await users.getUserById(userId);
  if (!user) throw new ApiError(401, 'Invalid user');
  const result = await runConfirmedAction(user, token, userId);
  return { content: result.content, payload: result.payload };
}

module.exports = { shouldUseSuperset, handlePortalChat, handleConfirm };