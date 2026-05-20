const tenants = require('./services/tenants');
const users = require('./services/users');
const slaTargets = require('./services/slaTargets');
const slaPerformance = require('./services/slaPerformance');
const db = require('./db');
const pendingActions = require('./pendingActions');
const { ApiError } = require('./services/tenants');

function resolveTenantId(params) {
  if (params.tenantId && db.findById('tenants', params.tenantId)) return params.tenantId;
  if (params.code) {
    const t = db.get('tenants').find((x) => x.code.toUpperCase() === params.code.toUpperCase());
    if (t) return t.id;
  }
  return params.tenantId;
}

function formatListPayload(type, items, content) {
  return {
    content,
    payload: {
      type,
      items,
      scrollable: items.length > 5,
      actions: [],
    },
  };
}

function formatConfirmPayload(entity, item, token, label) {
  return {
    content: `Please confirm: ${label}`,
    payload: {
      type: 'confirm_delete',
      items: [item],
      scrollable: false,
      actions: [
        {
          type: 'confirm_delete',
          label,
          token,
          entity,
          id: item.id,
        },
      ],
    },
    needsConfirmation: true,
    confirmationToken: token,
  };
}

async function runIntent(user, intent, params, { needsConfirmation, userId }) {
  const tenantId = resolveTenantId(params);

  if (needsConfirmation && ['delete_tenant', 'delete_user', 'delete_sla_target', 'delete_sla_performance'].includes(intent)) {
    const token = pendingActions.create(intent, userId, { ...params, tenantId });
    let item;
    let entity;
    let label;

    if (intent === 'delete_tenant') {
      const id = tenantId || params.tenantId;
      item = await tenants.getTenant(user, id).catch(() => db.findById('tenants', id));
      entity = 'tenant';
      label = `Delete tenant ${item?.name || id}`;
    } else if (intent === 'delete_user') {
      item = db.findById('users', params.userId || params.id);
      entity = 'user';
      label = `Delete user ${item?.email || params.userId}`;
    } else if (intent === 'delete_sla_target') {
      item = db.findById('sla_targets', params.id || params.targetId);
      entity = 'sla_target';
      label = `Delete SLA target ${item?.name || params.id}`;
    } else {
      item = db.findById('sla_performance', params.id || params.perfId);
      entity = 'sla_performance';
      label = `Delete performance ${params.id || params.perfId}`;
    }

    return formatConfirmPayload(entity, item || { id: params.id }, token, label);
  }

  switch (intent) {
    case 'list_users': {
      const data = await users.listUsers(user, tenantId);
      const tenant = db.findById('tenants', tenantId);
      return formatListPayload(
        'user_list',
        data,
        `Found ${data.length} user(s) for ${tenant?.name || tenantId}.`
      );
    }
    case 'invite_user': {
      const result = await users.inviteUser(user, tenantId, params);
      const list = await users.listUsers(user, tenantId);
      return {
        content: `Invitation sent to ${result.user.email}. Token: ${result.inviteToken}`,
        payload: {
          type: 'user_list',
          items: list,
          scrollable: list.length > 5,
          actions: [],
        },
      };
    }
    case 'update_user': {
      const data = await users.updateUser(user, tenantId, params.userId || params.id, params);
      return { content: `Updated user ${data.email}.`, payload: null };
    }
    case 'delete_user': {
      const data = await users.deleteUser(user, tenantId, params.userId || params.id);
      return { content: `Deleted user ${data.email}.`, payload: null };
    }
    case 'list_tenants': {
      const data = await tenants.listTenants(user);
      return formatListPayload('tenant_list', data, `Found ${data.length} tenant(s).`);
    }
    case 'get_tenant_by_id':
    case 'get_tenant': {
      const data = await tenants.getTenant(user, params.id || params.tenantId);
      return formatListPayload('tenant_list', [data], `Tenant: ${data.name} (${data.code})`);
    }
    case 'get_tenant_by_code': {
      const data = await tenants.getTenantByCode(user, params.code);
      return formatListPayload('tenant_list', [data], `Tenant: ${data.name}`);
    }
    case 'create_tenant': {
      const data = await tenants.createTenant(user, params);
      return formatListPayload('tenant_list', [data], `Created tenant ${data.name}.`);
    }
    case 'update_tenant': {
      const data = await tenants.updateTenant(user, params.id || params.tenantId, params);
      return { content: `Updated tenant ${data.name}.`, payload: null };
    }
    case 'delete_tenant': {
      const data = await tenants.deleteTenant(user, params.id || tenantId);
      return { content: `Deleted tenant ${data.name}.`, payload: null };
    }
    case 'list_sla_targets': {
      const data = await slaTargets.listTargets(user, tenantId);
      return formatListPayload(
        'sla_target_list',
        data,
        `Found ${data.length} SLA target(s).`
      );
    }
    case 'list_sla_categories': {
      const data = await slaTargets.listCategories(user, tenantId);
      return formatListPayload(
        'sla_category_list',
        data,
        `Found ${data.length} SLA categor${data.length === 1 ? 'y' : 'ies'}.`
      );
    }
    case 'check_sla_target_duplicate': {
      const data = await slaTargets.checkDuplicate(user, tenantId, params);
      return {
        content: data.duplicate ? data.message : 'No duplicate found.',
        payload: null,
      };
    }
    case 'create_sla_target': {
      const data = await slaTargets.createTarget(user, tenantId, params);
      const list = await slaTargets.listTargets(user, tenantId);
      return formatListPayload('sla_target_list', list, `Created SLA target "${data.name}".`);
    }
    case 'update_sla_target': {
      const data = await slaTargets.updateTarget(user, tenantId, params.id, params);
      return { content: `Updated SLA target ${data.name}.`, payload: null };
    }
    case 'delete_sla_target': {
      const data = await slaTargets.deleteTarget(user, tenantId, params.id);
      return { content: `Deleted SLA target ${data.name}.`, payload: null };
    }
    case 'list_sla_performance': {
      const data = await slaPerformance.listPerformance(user, tenantId);
      return formatListPayload('sla_perf_list', data, `Found ${data.length} performance record(s).`);
    }
    case 'list_pending_sla_performance': {
      const data = await slaPerformance.listPending(user, tenantId);
      return formatListPayload(
        'sla_perf_list',
        data,
        data.length ? `${data.length} pending performance(s).` : 'No pending performances.'
      );
    }
    case 'get_sla_performance': {
      const data = await slaPerformance.getPerformance(user, tenantId, params.id || params.perfId);
      return formatListPayload('sla_perf_list', [data], `Performance ${data.id}: ${data.status}`);
    }
    case 'get_sla_performance_status': {
      const data = await slaPerformance.getStatusByTarget(user, tenantId, params.targetId);
      return {
        content: `Target ${data.targetId}: ${data.records.length} record(s), ${data.pending} pending.`,
        payload: {
          type: 'sla_perf_list',
          items: data.records,
          scrollable: data.records.length > 5,
          actions: [],
        },
      };
    }
    case 'create_sla_performance': {
      const data = await slaPerformance.createPerformance(user, tenantId, params);
      return formatListPayload('sla_perf_list', [data], `Created performance record ${data.id}.`);
    }
    case 'update_sla_performance': {
      const data = await slaPerformance.updatePerformance(
        user,
        tenantId,
        params.id || params.perfId,
        params
      );
      return { content: `Updated performance ${data.id}.`, payload: null };
    }
    case 'delete_sla_performance': {
      const data = await slaPerformance.deletePerformance(
        user,
        tenantId,
        params.id || params.perfId
      );
      return { content: `Deleted performance ${data.id}.`, payload: null };
    }
    case 'confirm_sla_performance': {
      let perfId = params.perfId || params.id;
      if (!perfId && params.targetId) {
        const pending = await slaPerformance.listPending(user, tenantId);
        const match = pending.find((p) => p.targetId === params.targetId);
        perfId = match?.id;
      }
      const data = await slaPerformance.confirmPerformance(user, tenantId, perfId, user.id);
      return {
        content: `Confirmed performance ${data.id} for period ${data.periodStart} – ${data.periodEnd}.`,
        payload: {
          type: 'sla_perf_list',
          items: [data],
          scrollable: false,
          actions: [],
        },
      };
    }
    default:
      return { content: `Unknown intent: ${intent}`, payload: null };
  }
}

async function runConfirmedAction(user, token, userId) {
  const entry = pendingActions.consume(token, userId);
  if (!entry) {
    throw new ApiError(400, 'Invalid or expired confirmation token');
  }
  return runIntent(user, entry.action, entry.params, {
    needsConfirmation: false,
    userId,
  });
}

module.exports = { runIntent, runConfirmedAction };
