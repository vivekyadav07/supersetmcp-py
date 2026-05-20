import { reactive } from 'vue';

const TAB_KEYS = ['dashboards', 'users', 'sla_targets', 'sla_performance', 'tenants'];

function emptyTabMessages() {
  return Object.fromEntries(TAB_KEYS.map((k) => [k, []]));
}

export const store = reactive({
  activeTab: 'dashboards',
  selectedTenantId: 't1',
  askedAs: 'manager',
  currentUser: {
    id: 'u2',
    email: 'admin@acme.com',
    name: 'Jane Tenant Admin',
    role: 'tenant_admin',
    tenantIds: ['t1'],
  },
  tenants: [],
  tabMessages: emptyTabMessages(),
  charts: [],
  currentSql: '',
  isDarkMode: false,
  isQueryVisible: false,

  get messages() {
    return this.tabMessages[this.activeTab] || [];
  },

  setActiveTab(tab) {
    this.activeTab = tab;
  },

  addMessage(msg) {
    const list = this.tabMessages[this.activeTab];
    list.push(msg);
  },

  addChart(chart) {
    this.charts.push(chart);
  },

  setCurrentSql(sql) {
    this.currentSql = sql;
  },

  setMe({ user, tenants }) {
    if (user) this.currentUser = user;
    if (tenants) {
      this.tenants = tenants;
      if (!this.selectedTenantId && tenants.length) {
        this.selectedTenantId = tenants[0].id;
      }
    }
  },

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleQueryPanel() {
    this.isQueryVisible = !this.isQueryVisible;
  },

  clearChat() {
    this.tabMessages[this.activeTab] = [];
  },

  clearDashboard() {
    this.charts = [];
    this.currentSql = '';
  },

  isPortalTab() {
    return this.activeTab !== 'dashboards';
  },
});
