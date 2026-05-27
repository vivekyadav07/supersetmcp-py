const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const SEED_FILE = path.join(__dirname, 'db.seed.json');

class DB {
  constructor() {
    this.data = {
      tenants: [],
      users: [],
      sla_categories: [],
      sla_targets: [],
      sla_performance: [],
    };
  }

  async init() {
    try {
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
      await this.ensureAuthFields();
    } catch (err) {
      if (err.code === 'ENOENT') {
        const seed = await fs.readFile(SEED_FILE, 'utf-8');
        this.data = JSON.parse(seed);
        await this.write();
      } else {
        throw err;
      }
    }
  }

  async write() {
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  get(key) {
    return this.data[key] || [];
  }

  async set(key, value) {
    this.data[key] = value;
    await this.write();
  }

  findById(collection, id) {
    return this.get(collection).find((item) => item.id === id) || null;
  }

  findByTenant(collection, tenantId) {
    return this.get(collection).filter((item) => item.tenantId === tenantId);
  }

  generateId(prefix) {
    const items = Object.values(this.data).flat();
    let n = 1;
    let id;
    do {
      id = `${prefix}${n}`;
      n++;
    } while (items.some((item) => item && item.id === id) || this.findById('tenants', id));
    return id;
  }

  async updateCollection(collection, updater) {
    const next = updater([...this.get(collection)]);
    await this.set(collection, next);
    return next;
  }

  async ensureAuthFields() {
    const seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf-8'));
    const seedById = Object.fromEntries((seed.users || []).map((u) => [u.id, u]));
    let changed = false;
    const users = this.get('users').map((u) => {
      const s = seedById[u.id];
      if (!s) return u;
      const merged = { ...u };
      ['userId', 'mobile', 'password', 'emailVerified', 'mobileVerified'].forEach((key) => {
        if (merged[key] === undefined && s[key] !== undefined) {
          merged[key] = s[key];
          changed = true;
        }
      });
      return merged;
    });
    if (changed) {
      this.data.users = users;
      await this.write();
    }
  }

  getTabData(activeTab, tenantId) {
    switch (activeTab) {
      case 'users':
        return {
          users: this.get('users').filter(
            (u) => !tenantId || (u.tenantIds || []).includes(tenantId)
          ),
          tenant: tenantId ? this.findById('tenants', tenantId) : null,
        };
      case 'tenants':
        return {
          tenants: this.get('tenants'),
        };
      case 'sla_targets':
        return {
          sla_categories: this.get('sla_categories').filter(
            (c) => !tenantId || c.tenantId === tenantId
          ),
          sla_targets: this.get('sla_targets').filter(
            (t) => !tenantId || t.tenantId === tenantId
          ),
          tenant: tenantId ? this.findById('tenants', tenantId) : null,
        };
      case 'sla_performance':
        return {
          sla_targets: this.get('sla_targets').filter(
            (t) => !tenantId || t.tenantId === tenantId
          ),
          sla_performance: this.get('sla_performance').filter(
            (p) => !tenantId || p.tenantId === tenantId
          ),
          tenant: tenantId ? this.findById('tenants', tenantId) : null,
        };
      default:
        return {};
    }
  }
}

module.exports = new DB();
