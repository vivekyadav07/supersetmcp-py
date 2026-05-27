const express = require('express');
const auth = require('../services/auth');
const { ApiError } = require('../services/tenants');

const router = express.Router();

function envelope(data) {
  return { ok: true, data };
}

router.post('/signin', async (req, res, next) => {
  try {
    const user = await auth.signIn(req.body);
    res.json(envelope({ user }));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/start', async (req, res, next) => {
  try {
    const data = auth.startSignup(req.body);
    res.status(201).json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/verify', async (req, res, next) => {
  try {
    const { sessionId, type, code } = req.body;
    const data = auth.verifySignupStep(sessionId, type, code);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/resend', async (req, res, next) => {
  try {
    const { sessionId, type } = req.body;
    const data = auth.resendVerification(sessionId, type);
    res.json(envelope(data));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/complete', async (req, res, next) => {
  try {
    const user = await auth.completeSignup(req.body.sessionId);
    res.json(envelope({ user }));
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Server error' });
});

module.exports = router;
