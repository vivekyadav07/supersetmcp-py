const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const INTENTS_BY_TAB = {
  users: ['invite_user', 'update_user', 'list_users', 'delete_user'],
  tenants: [
    'create_tenant',
    'update_tenant',
    'list_tenants',
    'delete_tenant',
    'get_tenant_by_id',
    'get_tenant_by_code',
  ],
  sla_targets: [
    'create_sla_target',
    'update_sla_target',
    'delete_sla_target',
    'list_sla_targets',
    'list_sla_categories',
    'check_sla_target_duplicate',
  ],
  sla_performance: [
    'create_sla_performance',
    'update_sla_performance',
    'delete_sla_performance',
    'list_sla_performance',
    'get_sla_performance',
    'list_pending_sla_performance',
    'confirm_sla_performance',
    'get_sla_performance_status',
  ],
};

const DELETE_INTENTS = ['delete_tenant', 'delete_user', 'delete_sla_target', 'delete_sla_performance'];

function cleanJSON(text) {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function tryRegex(query, activeTab, tenantId) {
  const q = query.toLowerCase().trim();

  if (activeTab === 'users' && /list\s+(all\s+)?users/.test(q)) {
    return { intent: 'list_users', params: { tenantId }, needsConfirmation: false, reply: null };
  }
  if (activeTab === 'tenants' && /list\s+(all\s+)?tenants/.test(q)) {
    return { intent: 'list_tenants', params: {}, needsConfirmation: false, reply: null };
  }
  if (activeTab === 'sla_targets' && /list\s+(all\s+)?(sla\s+)?targets/.test(q)) {
    return { intent: 'list_sla_targets', params: { tenantId }, needsConfirmation: false, reply: null };
  }
  if (activeTab === 'sla_targets' && /list\s+categor/.test(q)) {
    return { intent: 'list_sla_categories', params: { tenantId }, needsConfirmation: false, reply: null };
  }
  if (activeTab === 'sla_performance' && /pending/.test(q)) {
    return {
      intent: 'list_pending_sla_performance',
      params: { tenantId },
      needsConfirmation: false,
      reply: null,
    };
  }

  const deleteTenant = q.match(/delete\s+tenant\s+(\w+)/);
  if (activeTab === 'tenants' && deleteTenant) {
    const codeOrId = deleteTenant[1];
    return {
      intent: 'delete_tenant',
      params: { tenantId: codeOrId.startsWith('t') ? codeOrId : undefined, code: codeOrId },
      needsConfirmation: true,
      reply: null,
    };
  }

  const invite = q.match(/invite\s+([\w.@+-]+)/);
  if (activeTab === 'users' && invite) {
    return {
      intent: 'invite_user',
      params: { tenantId, email: invite[1], role: 'user' },
      needsConfirmation: false,
      reply: null,
    };
  }

  const confirmPerf = q.match(/confirm\s+(?:perf(?:ormance)?\s+)?(\w+)/);
  if (activeTab === 'sla_performance' && confirmPerf) {
    return {
      intent: 'confirm_sla_performance',
      params: { tenantId, perfId: confirmPerf[1].startsWith('sp') ? confirmPerf[1] : undefined },
      needsConfirmation: false,
      reply: null,
    };
  }

  return null;
}

async function parsePortalIntent({ query, activeTab, user, selectedTenantId, askedAs }) {
  const tenantId = selectedTenantId;
  const regexResult = tryRegex(query, activeTab, tenantId);
  if (regexResult) return regexResult;

  const allowed = INTENTS_BY_TAB[activeTab] || [];
  const prompt = `You are a multi-tenant operations assistant.
Active tab: ${activeTab}.
User role: ${user.role}.
Selected tenant: ${tenantId || 'none'}.
Asked as (UI label only): ${askedAs}.

Allowed intents for this tab: ${allowed.join(', ')}.

Return ONLY valid JSON:
{
  "intent": "<one of allowed intents>",
  "params": { "tenantId": "...", ... },
  "needsConfirmation": false,
  "confirmationToken": null,
  "reply": "short friendly message"
}

Rules:
- Never generate SQL.
- For delete_tenant, delete_user, delete_sla_target, delete_sla_performance set needsConfirmation true.
- Map tenant names/codes to tenantId when possible (${tenantId} is default).
- invite_user needs email and optional role.

User message:
${query}`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(cleanJSON(raw));
    if (DELETE_INTENTS.includes(parsed.intent)) {
      parsed.needsConfirmation = true;
    }
    if (!parsed.params) parsed.params = {};
    if (tenantId && !parsed.params.tenantId) parsed.params.tenantId = tenantId;
    return parsed;
  } catch (e) {
    console.error('Portal LLM error:', e.message);
    return {
      intent: allowed[0] || 'list_tenants',
      params: { tenantId },
      needsConfirmation: false,
      reply: 'I had trouble understanding; trying a list operation.',
    };
  }
}

module.exports = { parsePortalIntent, INTENTS_BY_TAB, DELETE_INTENTS };
