const ACTIONS = {
  list_tenants: ['system_admin', 'tenant_admin', 'user'],
  get_tenant: ['system_admin', 'tenant_admin', 'user'],
  create_tenant: ['system_admin'],
  update_tenant: ['system_admin', 'tenant_admin'],
  delete_tenant: ['system_admin'],

  list_users: ['system_admin', 'tenant_admin', 'user'],
  invite_user: ['system_admin', 'tenant_admin'],
  update_user: ['system_admin', 'tenant_admin'],
  delete_user: ['system_admin', 'tenant_admin'],

  list_sla_targets: ['system_admin', 'tenant_admin', 'user'],
  create_sla_target: ['system_admin', 'tenant_admin', 'user'],
  update_sla_target: ['system_admin', 'tenant_admin', 'user'],
  delete_sla_target: ['system_admin', 'tenant_admin', 'user'],
  list_sla_categories: ['system_admin', 'tenant_admin', 'user'],
  check_sla_target_duplicate: ['system_admin', 'tenant_admin', 'user'],

  list_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  get_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  create_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  update_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  delete_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  list_pending_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  confirm_sla_performance: ['system_admin', 'tenant_admin', 'user'],
  get_sla_performance_status: ['system_admin', 'tenant_admin', 'user'],

  superset: ['system_admin', 'tenant_admin', 'user'],
};

function hasTenantAccess(user, tenantId) {
  if (!tenantId) return user.role === 'system_admin';
  if (user.role === 'system_admin') return true;
  return (user.tenantIds || []).includes(tenantId);
}

function can(user, action, { tenantId } = {}) {
  if (!user) return false;
  const allowedRoles = ACTIONS[action];
  if (!allowedRoles) return false;
  if (!allowedRoles.includes(user.role)) return false;

  const tenantScoped = [
    'list_users', 'invite_user', 'update_user', 'delete_user',
    'list_sla_targets', 'create_sla_target', 'update_sla_target', 'delete_sla_target',
    'list_sla_categories', 'check_sla_target_duplicate',
    'list_sla_performance', 'get_sla_performance', 'create_sla_performance',
    'update_sla_performance', 'delete_sla_performance', 'list_pending_sla_performance',
    'confirm_sla_performance', 'get_sla_performance_status',
    'get_tenant', 'update_tenant',
  ];

  if (action === 'list_tenants') {
    return ['system_admin', 'tenant_admin', 'user'].includes(user.role);
  }

  if (action === 'get_tenant') {
    return user.role === 'system_admin' || (tenantId && hasTenantAccess(user, tenantId));
  }

  if (tenantScoped.includes(action)) {
    return hasTenantAccess(user, tenantId);
  }

  if (action === 'create_tenant' || action === 'delete_tenant') {
    return user.role === 'system_admin';
  }

  if (action === 'update_tenant') {
    return user.role === 'system_admin' ||
      (user.role === 'tenant_admin' && hasTenantAccess(user, tenantId));
  }

  return true;
}

module.exports = { can, hasTenantAccess, ACTIONS };
