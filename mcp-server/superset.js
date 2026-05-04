require('dotenv').config();

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const SUPERSET_URL = process.env.SUPERSET_URL;
const USERNAME = process.env.SUPERSET_USERNAME;
const PASSWORD = process.env.SUPERSET_PASSWORD;
const DATABASE_ID = process.env.SUPERSET_DATABASE_ID;
const DATASET_ID = parseInt(process.env.DATASET_ID);

// 🔐 Login
async function login() {
    const res = await client.post(`${SUPERSET_URL}/api/v1/security/login`, {
        username: USERNAME,
        password: PASSWORD,
        provider: "db",
        refresh: true
    });
    return res.data.access_token;
}

// 🛡️ CSRF
async function getCSRFToken(token) {
    const res = await client.get(
        `${SUPERSET_URL}/api/v1/security/csrf_token/`,
        {
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return res.data.result;
}

// 🧠 SQL
async function runSQL(sql) {
    const token = await login();
    const csrfToken = await getCSRFToken(token);

    const res = await client.post(
        `${SUPERSET_URL}/api/v1/sqllab/execute/`,
        {
            database_id: parseInt(DATABASE_ID),
            sql,
            schema: "public",
            runAsync: false,
            expand_data: true
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-CSRFToken": csrfToken
            }
        }
    );

    return { data: res.data, token, csrfToken };
}

// 📊 Create Chart
async function createChart(token, csrfToken, config = {}) {
    const chartType = config.chartType || "bar";
    const groupby = config.groupby || ["name"];

    const limitMatch = config.sql?.match(/limit\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 5;

    let form_data;

    if (chartType === "pie") {
        form_data = {
            datasource: `${DATASET_ID}__table`,
            viz_type: "pie",
            groupby,
            metric: {
                expressionType: "SQL",
                sqlExpression: "SUM(num)",
                label: "total"
            },
            row_limit: limit,
            sort_by_metric: true,
            color_scheme: "supersetColors"
        };
    } else {
        // Map bar/line to standard ECharts timeseries charts which superset supports
        const viz_type = chartType === "line" ? "echarts_timeseries_line" : "echarts_timeseries_bar";
        
        form_data = {
            datasource: `${DATASET_ID}__table`,
            viz_type: viz_type,
            x_axis: groupby[0],
            groupby: [],
            metrics: [{
                expressionType: "SQL",
                sqlExpression: "SUM(num)",
                label: "total"
            }],
            row_limit: limit,
            series_limit: limit,
            order_desc: true,
            color_scheme: "supersetColors"
        };
    }

    const res = await client.post(
        `${SUPERSET_URL}/api/v1/chart/`,
        {
            slice_name: `AI ${chartType} Chart`,
            viz_type: form_data.viz_type,
            datasource_id: DATASET_ID,
            datasource_type: "table",
            params: JSON.stringify(form_data)
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-CSRFToken": csrfToken
            }
        }
    );

    return res.data.id;
}

// 📊 Dashboard
async function createDashboard(token, csrfToken) {
    const res = await client.post(
        `${SUPERSET_URL}/api/v1/dashboard/`,
        {
            dashboard_title: "AI Generated Dashboard",
            published: true
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-CSRFToken": csrfToken
            }
        }
    );
    return res.data.id;
}

// 🔥 Attach chart
async function addChartToDashboard(dashboardId, chartId, token, csrfToken) {
    // Simplified robust grid layout layout ensuring compatibility
    const position_json = {
        ROOT_ID: {
            id: "ROOT_ID",
            type: "ROOT",
            children: ["GRID_ID"]
        },
        GRID_ID: {
            id: "GRID_ID",
            type: "GRID",
            children: ["ROW_ID"]
        },
        ROW_ID: {
            id: "ROW_ID",
            type: "ROW",
            children: [`CHART-${chartId}`]
        },
        [`CHART-${chartId}`]: {
            id: `CHART-${chartId}`,
            type: "CHART",
            children: [],
            meta: {
                chartId: chartId,
                sliceName: "AI Chart",
                width: 12,
                height: 50,
                background: "transparent"
            }
        }
    };

    const dashboard_payload = {
        position_json: JSON.stringify(position_json),
        published: true,
        json_metadata: JSON.stringify({
            chart_configuration: {
                [chartId]: {
                    id: chartId,
                    crossFilters: {
                        scope: "global",
                        chartsInScope: []
                    }
                }
            }
        })
    };

    await client.put(
        `${SUPERSET_URL}/api/v1/dashboard/${dashboardId}`,
        dashboard_payload,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-CSRFToken": csrfToken
            }
        }
    );
}

module.exports = {
    runSQL,
    createChart,
    createDashboard,
    addChartToDashboard
};