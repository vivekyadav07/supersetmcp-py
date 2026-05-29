require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { checkConnection } = require('./db');
const { generateAIConfig } = require('./llm');
const {
  runSQL,
  createChart,
  createDashboard,
  addChartToDashboard,
  extractRequestedChartType,
  extractLimit,
  applyLimit,
} = require('./superset');

const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const {
  shouldUseSuperset,
  handlePortalChat,
  handleConfirm,
} = require('./router');
const { ApiError } = require('./services/tenants');

const app = express();

app.use(cors());
app.use(express.json());

async function handleAsk(req, res) {
  const query = req.body.query;

  const aiConfig = await generateAIConfig(query);
  console.log('🤖 RAW AI CONFIG:', aiConfig);

  const requestedChartType = extractRequestedChartType(query, aiConfig.chartType);
  const requestedLimit = extractLimit(query, 5);
  const finalSql = applyLimit(aiConfig.sql, requestedLimit);

  const finalConfig = {
    ...aiConfig,
    chartType: requestedChartType,
    sql: finalSql,
  };

  console.log('✅ FINAL CHART CONFIG:', finalConfig);

  const { data, token, csrfToken } = await runSQL(finalSql);

  const chartId = await createChart(token, csrfToken, finalConfig);
  const dashboardId = await createDashboard(token, csrfToken);

  await addChartToDashboard(dashboardId, chartId, token, csrfToken);

  return res.json({
    sql: finalSql,
    chartType: requestedChartType,
    requestedLimit,
    data,
    dashboardUrl: `${process.env.SUPERSET_URL}/superset/dashboard/${dashboardId}/?standalone=1`,
  });
}

app.post('/ask', async (req, res) => {
  try {
    await handleAsk(req, res);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error('❌ ERROR CAUSE:', err.cause || err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { query, activeTab, tenantId, userId, askedAs } = req.body;

    if (shouldUseSuperset(activeTab, query)) {
      return handleAsk({ body: { query } }, res);
    }

    const result = await handlePortalChat({
      query,
      activeTab,
      tenantId,
      userId,
      askedAs,
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ CHAT ERROR:', err.message);
    console.error('❌ CHAT ERROR CAUSE:', err.cause || err);

    const status = err.status || 500;
    return res.status(status).json({
      error: err.message,
      content: err.message,
      payload: null,
    });
  }
});

app.post('/chat/confirm', async (req, res) => {
  try {
    const result = await handleConfirm(req.body);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message,
      content: err.message,
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, req, res, _next) => {
  if (err instanceof ApiError || err.status) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message,
    });
  }

  return res.status(500).json({
    ok: false,
    error: err.message,
  });
});

async function start() {
  // Check the database connection before starting the server
  await checkConnection();

  app.listen(3000, () => {
    console.log('🚀 MCP Server running on port 3000');
    console.log('   POST /ask     — Superset charts');
    console.log('   POST /chat    — Portal router');
    console.log('   GET  /api/me  — Auth context');
    console.log('   POST /api/auth/signin | signup/*');
  });
}

start();