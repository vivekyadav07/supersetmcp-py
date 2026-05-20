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
}

module.exports = new DB();
