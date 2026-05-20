require('dotenv').config();

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(
    axios.create({
        jar,
        withCredentials: true,
        timeout: 60000,
    })
);

const SUPERSET_URL = process.env.SUPERSET_URL;
const USERNAME = process.env.SUPERSET_USERNAME;
const PASSWORD = process.env.SUPERSET_PASSWORD;
const DATABASE_ID = parseInt(process.env.SUPERSET_DATABASE_ID, 10);
const DATASET_ID = parseInt(process.env.DATASET_ID, 10);

function getMetric() {
    return {
        expressionType: 'SQL',
        sqlExpression: 'SUM(num)',
        label: 'total',
    };
}

function normalizeChartType(input = '') {
    const value = String(input).toLowerCase().trim();

    if (
        value === 'pie' ||
        value === 'donut' ||
        value === 'doughnut' ||
        value === 'echarts_pie' ||
        value === 'echarts-pie'
    ) {
        return 'pie';
    }

    if (
        value === 'line' ||
        value === 'echarts_timeseries_line' ||
        value === 'timeseries_line'
    ) {
        return 'line';
    }

    return 'bar';
}

function extractRequestedChartType(query = '', fallback = 'bar') {
    const q = String(query).toLowerCase();

    if (/\b(pie|donut|doughnut)\b/.test(q)) return 'pie';
    if (/\bline\b/.test(q)) return 'line';
    if (/\bbar\b/.test(q)) return 'bar';

    return normalizeChartType(fallback);
}

function extractLimit(query = '', fallback = 5) {
    const match = String(query).match(/\b(?:top|limit)\s+(\d+)\b/i);
    return match ? parseInt(match[1], 10) : fallback;
}

function applyLimit(sql = '', limit = 5) {
    const cleanSql = String(sql).trim().replace(/;$/, '');

    if (/limit\s+\d+/i.test(cleanSql)) {
        return cleanSql.replace(/limit\s+\d+/i, `LIMIT ${limit}`);
    }

    return `${cleanSql} LIMIT ${limit}`;
}

function buildFormData({ chartType, groupby, limit }) {
    const safeGroupby = Array.isArray(groupby) && groupby.length ? groupby : ['name'];

    if (chartType === 'pie') {
        return {
            datasource: `${DATASET_ID}__table`,
            viz_type: 'pie',
            groupby: safeGroupby,
            metric: getMetric(), // 'metric' for pie chart, not 'metrics'
            row_limit: limit,
            sort_by_metric: true,
            color_scheme: 'supersetColors',
            donut: false,
            labels_outside: true,
            show_legend: true,
        };
    }

    if (chartType === 'line') {
        return {
            datasource: `${DATASET_ID}__table`,
            viz_type: 'echarts_timeseries_line',
            x_axis: safeGroupby[0],
            groupby: [],
            metrics: [getMetric()],
            row_limit: limit,
            series_limit: limit,
            order_desc: true,
            color_scheme: 'supersetColors',
        };
    }

    return {
        datasource: `${DATASET_ID}__table`,
        viz_type: 'echarts_timeseries_bar',
        x_axis: safeGroupby[0],
        groupby: [],
        metrics: [getMetric()],
        row_limit: limit,
        series_limit: limit,
        order_desc: true,
        color_scheme: 'supersetColors',
    };
}

async function login() {
    const res = await client.post(`${SUPERSET_URL}/api/v1/security/login`, {
        username: USERNAME,
        password: PASSWORD,
        provider: 'db',
        refresh: true,
    });

    return res.data.access_token;
}

async function getCSRFToken(token) {
    const res = await client.get(`${SUPERSET_URL}/api/v1/security/csrf_token/`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return res.data.result;
}

async function runSQL(sql) {
    const token = await login();
    const csrfToken = await getCSRFToken(token);

    const payload = {
        client_id: `ai-${Date.now()}`,
        database_id: DATABASE_ID,
        sql,
        schema: 'public',
        json: true,
        runAsync: false,
        expand_data: true,
        select_as_cta: false,
        queryLimit: 0,
    };

    const res = await client.post(
        `${SUPERSET_URL}/api/v1/sqllab/execute/`,
        payload,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-CSRFToken': csrfToken,
            },
        }
    );

    return { data: res.data, token, csrfToken };
}

async function createChart(token, csrfToken, config = {}) {
    const chartType = normalizeChartType(config.chartType);
    const groupby = Array.isArray(config.groupby) && config.groupby.length ? config.groupby : ['name'];

    const limitMatch = String(config.sql || '').match(/limit\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : 5;

    const form_data = buildFormData({
        chartType,
        groupby,
        limit,
    });

    const res = await client.post(
        `${SUPERSET_URL}/api/v1/chart/`,
        {
            slice_name: `AI ${chartType} Chart`,
            viz_type: form_data.viz_type,
            datasource_id: DATASET_ID,
            datasource_type: 'table',
            params: JSON.stringify(form_data),
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-CSRFToken': csrfToken,
            },
        }
    );

    return res.data.id;
}

async function createDashboard(token, csrfToken) {
    const res = await client.post(
        `${SUPERSET_URL}/api/v1/dashboard/`,
        {
            dashboard_title: `AI Generated Dashboard ${Date.now()}`,
            published: true,
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-CSRFToken': csrfToken,
            },
        }
    );

    return res.data.id;
}

async function addChartToDashboard(dashboardId, chartId, token, csrfToken) {
    const position_json = {
        ROOT_ID: {
            id: 'ROOT_ID',
            type: 'ROOT',
            children: ['GRID_ID'],
        },
        GRID_ID: {
            id: 'GRID_ID',
            type: 'GRID',
            children: ['ROW_ID'],
            meta: {
                width: 12,
            },
        },
        ROW_ID: {
            id: 'ROW_ID',
            type: 'ROW',
            children: ['COLUMN_ID'],
            meta: {
                width: 12,
                background: 'BACKGROUND_TRANSPARENT',
            },
        },
        COLUMN_ID: {
            id: 'COLUMN_ID',
            type: 'COLUMN',
            children: [`CHART-${chartId}`],
            meta: {
                width: 12,
                background: 'BACKGROUND_TRANSPARENT',
            },
        },
        [`CHART-${chartId}`]: {
            id: `CHART-${chartId}`,
            type: 'CHART',
            children: [],
            meta: {
                chartId,
                sliceName: 'AI Chart',
                width: 12,
                height: 50,
                background: 'BACKGROUND_TRANSPARENT',
            },
        },
        DASHBOARD_VERSION_KEY: 'v2',
    };

    const dashboard_payload = {
        position_json: JSON.stringify(position_json),
        published: true,
        json_metadata: JSON.stringify({
            chart_configuration: {
                [chartId]: {
                    id: chartId,
                    crossFilters: {
                        scope: 'global',
                        chartsInScope: [],
                    },
                },
            },
        }),
    };

    await client.put(
        `${SUPERSET_URL}/api/v1/dashboard/${dashboardId}`,
        dashboard_payload,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-CSRFToken': csrfToken,
            },
        }
    );
}

module.exports = {
    runSQL,
    createChart,
    createDashboard,
    addChartToDashboard,
    normalizeChartType,
    extractRequestedChartType,
    extractLimit,
    applyLimit,
};