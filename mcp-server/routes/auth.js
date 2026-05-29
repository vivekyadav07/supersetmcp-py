const express = require('express');
const auth = require('../services/auth');
const { ApiError } = require('../services/tenants');

const router = express.Router();

// In-memory storage for the multi-step signup flow to be compatible with the frontend.
// In a production environment with multiple server instances, this should be
// replaced with a shared cache like Redis.
const pendingSignups = new Map();

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

// A direct, single-step signup route. The frontend should ideally be updated to use this.
router.post('/signup', async (req, res, next) => {
  try {
    const user = await auth.signUp(req.body);
    res.status(201).json(envelope({ user }));
  } catch (err) {
    next(err);
  }
});


// --- Stubs for the multi-step signup flow ---

router.post('/signup/start', async (req, res, next) => {
  try {
    // Generate a session ID and temporarily store the user's data.
    const sessionId = `signup_session_${Date.now()}`;
    pendingSignups.set(sessionId, req.body);

    // Clean up the stored data after a while (e.g., 10 minutes) to prevent memory leaks.
    setTimeout(() => {
      if (pendingSignups.has(sessionId)) {
        pendingSignups.delete(sessionId);
      }
    }, 10 * 60 * 1000);

    res.status(201).json(envelope({
      sessionId,
      message: 'Verification session started.',
      demoCodes: { email: '123456', mobile: '123456' } // Fake codes for UI
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/verify', async (req, res, next) => {
  try {
    // This step is stubbed out. We just pretend verification was successful.
    res.json(envelope({
      sessionId: req.body.sessionId,
      emailVerified: true,
      mobileVerified: true,
      ready: true
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/resend', async (req, res, next) => {
  try {
    res.json(envelope({
      message: `Code sent`,
      demoCode: '123456'
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/signup/complete', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required.');
    }

    // Retrieve the user data that was stored at the 'start' step.
    const signupData = pendingSignups.get(sessionId);
    if (!signupData) {
      throw new ApiError(400, 'Your signup session has expired. Please start over.');
    }

    // Now, call the actual signUp function with the retrieved data.
    const user = await auth.signUp(signupData);

    // Clean up the completed signup from memory.
    pendingSignups.delete(sessionId);

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