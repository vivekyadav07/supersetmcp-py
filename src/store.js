import { reactive } from 'vue';

const TAB_KEYS = ['dashboards', 'users', 'sla_targets', 'sla_performance', 'tenants'];
const SESSION_KEY = 'portal_session_user_id';

function emptyTabMessages() {
  return Object.fromEntries(TAB_KEYS.map((k) => [k, []]));
}

function loadSessionUserId() {
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export const store = reactive({
  activeTab: 'dashboards',
  selectedTenantId: null,
  askedAs: 'manager',
  sessionUserId: loadSessionUserId(),
  currentUser: null,
  tenants: [],
  tabMessages: emptyTabMessages(),
  charts: [],
  currentSql: '',
  isDarkMode: false,
  isQueryVisible: false,

  get isAuthenticated() {
    return Boolean(this.sessionUserId && this.currentUser);
  },

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

  login(user) {
    this.sessionUserId = user.id;
    this.currentUser = user;
    try {
      localStorage.setItem(SESSION_KEY, user.id);
    } catch {
      /* ignore */
    }
  },

  logout() {
    this.sessionUserId = null;
    this.currentUser = null;
    this.tenants = [];
    this.selectedTenantId = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
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
