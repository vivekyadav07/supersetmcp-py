const express = require('express');
const tenants = require('../services/tenants');
const users = require('../services/users');
const slaTargets = require('../services/slaTargets');
const slaPerformance = require('../services/slaPerformance');
const { ApiError } = require('../services/tenants');

const router = express.Router();

function envelope(data, meta = {}) {
  return { ok: true, data, meta };
}

// This middleware must be async to correctly handle the database query
async function requireUser(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Missing user ID' });
    }

    const user = await users.getUserById(userId);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid user' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

router.use(requireUser);

router.get('/me', async (req, res, next) => {
  try {
    // The user object from requireUser already has tenantIds, but we can fetch full tenant objects if needed
    const tenantList = await tenants.listTenants(req.user);
    res.json(
      envelope({
        user: req.user,
        tenants: tenantList,
      })
    );
  } catch (err) {
    next(err);
  }
});

// Tenants
router.get('/tenants', async (req, res, next) => {
  try {
    const data = await tenants.listTenants(req.user);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.get('/tenants/by-code/:code', async (req, res, next) => {
  try {
    const data = await tenants.getTenantByCode(req.user, req.params.code);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    const data = await tenants.getTenant(req.user, req.params.id);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.post('/tenants', async (req, res, next) => {
  try {
    const data = await tenants.createTenant(req.user, req.body);
    res.status(201).json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const data = await tenants.updateTenant(req.user, req.params.id, req.body);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const data = await tenants.deleteTenant(req.user, req.params.id);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

// Users per tenant
router.get('/tenants/:tenantId/users', async (req, res, next) => {
  try {
    const data = await users.listUsers(req.user, req.params.tenantId);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.post('/tenants/:tenantId/users/invite', async (req, res, next) => {
  try {
    const data = await users.inviteUser(req.user, req.params.tenantId, req.body);
    res.status(201).json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.patch('/tenants/:tenantId/users/:id', async (req, res, next) => {
  try {
    const data = await users.updateUser(
      req.user,
      req.params.tenantId,
      req.params.id,
      req.body
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.delete('/tenants/:tenantId/users/:id', async (req, res, next) => {
  try {
    const data = await users.deleteUser(req.user, req.params.tenantId, req.params.id);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

// SLA targets
router.get('/tenants/:tenantId/sla-categories', async (req, res, next) => {
  try {
    const data = await slaTargets.listSlaCategories(req.user, req.params.tenantId);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.get('/tenants/:tenantId/sla-targets', async (req, res, next) => {
  try {
    const data = await slaTargets.listSlaTargets(req.user, req.params.tenantId);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.post('/tenants/:tenantId/sla-targets', async (req, res, next) => {
  try {
    const data = await slaTargets.createSlaTarget(req.user, req.params.tenantId, req.body);
    res.status(201).json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.patch('/tenants/:tenantId/sla-targets/:id', async (req, res, next) => {
  try {
    const data = await slaTargets.updateSlaTarget(
      req.user,
      req.params.tenantId,
      req.params.id,
      req.body
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.delete('/tenants/:tenantId/sla-targets/:id', async (req, res, next) => {
  try {
    const data = await slaTargets.deleteSlaTarget(
      req.user,
      req.params.tenantId,
      req.params.id
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

// SLA performance
router.get('/tenants/:tenantId/sla-performance', async (req, res, next) => {
  try {
    const data = await slaPerformance.listPerformance(req.user, req.params.tenantId);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.get('/tenants/:tenantId/sla-performance/pending', async (req, res, next) => {
  try {
    const data = await slaPerformance.getPendingPerformance(req.user, req.params.tenantId);
    res.json(envelope(data, { total: data.length }));
  } catch (err) {
    next(err);
  }
});

router.post('/tenants/:tenantId/sla-performance', async (req, res, next) => {
  try {
    const data = await slaPerformance.createPerformance(
      req.user,
      req.params.tenantId,
      req.body.targetId, // Assuming targetId is in the body
      req.body
    );
    res.status(201).json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.patch('/tenants/:tenantId/sla-performance/:id', async (req, res, next) => {
  try {
    const data = await slaPerformance.updatePerformance(
      req.user,
      req.params.tenantId,
      req.params.id,
      req.body
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.delete('/tenants/:tenantId/sla-performance/:id', async (req, res, next) => {
  try {
    const data = await slaPerformance.deletePerformance(
      req.user,
      req.params.tenantId,
      req.params.id
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.post('/tenants/:tenantId/sla-performance/:id/confirm', async (req, res, next) => {
  try {
    const data = await slaPerformance.confirmPerformance(
      req.user,
      req.params.tenantId,
      req.params.id
    );
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Server error' });
});

module.exports = router;