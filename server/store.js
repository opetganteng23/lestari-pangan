// Lapisan data. Default: berkas JSON (tanpa dependensi). Jika MONGODB_URI diisi dan paket `mongodb` terpasang,
// pakai MongoDB dengan antarmuka yang sama. Filter yang didukung: kesetaraan, {$in:[...]}, {$ne:x}.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const uid = (p) => `${p}_${crypto.randomBytes(5).toString('hex')}`;

function match(doc, f) {
  for (const [k, v] of Object.entries(f || {})) {
    const x = k.split('.').reduce((o, p) => (o == null ? o : o[p]), doc);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$in' in v && !v.$in.includes(x)) return false;
      if ('$ne' in v && x === v.$ne) return false;
    } else if (x !== v) return false;
  }
  return true;
}
function sortDocs(a, sort) {
  if (!sort) return a;
  const [k, dir] = Object.entries(sort)[0];
  return a.sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * dir);
}

class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'db.json'); this.data = {}; this.t = null;
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }
  persist() {
    clearTimeout(this.t);
    this.t = setTimeout(() => this.flush(), 150);
  }
  flush() { clearTimeout(this.t); const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data)); fs.renameSync(tmp, this.file); }
  isEmpty() { return Object.keys(this.data).length === 0; }
  col(name) {
    const self = this; const arr = () => (self.data[name] ||= []);
    return {
      async insert(doc) { doc._id ||= uid(name.slice(0, 3)); arr().push(doc); self.persist(); return doc; },
      async find(f, o = {}) { let r = arr().filter((d) => match(d, f)).map((d) => ({ ...d })); r = sortDocs(r, o.sort); return o.limit ? r.slice(0, o.limit) : r; },
      async findOne(f) { const d = arr().find((d) => match(d, f)); return d ? { ...d } : null; },
      async update(f, patch) { let n = 0; for (const d of arr()) if (match(d, f)) { Object.assign(d, patch); n++; } if (n) self.persist(); return n; },
      async remove(f) { const before = arr().length; self.data[name] = arr().filter((d) => !match(d, f)); self.persist(); return before - self.data[name].length; },
      async count(f) { return arr().filter((d) => match(d, f)).length; },
    };
  }
}

class MongoStore {
  constructor(uri, dbName) { this.uri = uri; this.dbName = dbName; this.cols = {}; }
  async connect() {
    const { MongoClient } = require('mongodb');
    this.client = await new MongoClient(this.uri).connect(); this.db = this.client.db(this.dbName);
  }
  async isEmpty() { return (await this.db.listCollections().toArray()).length === 0; }
  flush() {}
  col(name) {
    const c = () => this.db.collection(name);
    const q = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? v : v]));
    return {
      async insert(doc) { doc._id ||= uid(name.slice(0, 3)); await c().insertOne(doc); return doc; },
      async find(f, o = {}) { let cur = c().find(q(f)); if (o.sort) cur = cur.sort(o.sort); if (o.limit) cur = cur.limit(o.limit); return cur.toArray(); },
      async findOne(f) { return c().findOne(q(f)); },
      async update(f, patch) { return (await c().updateMany(q(f), { $set: patch })).modifiedCount; },
      async remove(f) { return (await c().deleteMany(q(f))).deletedCount; },
      async count(f) { return c().countDocuments(q(f)); },
    };
  }
}

async function openStore(dataDir) {
  if (process.env.MONGODB_URI) {
    const s = new MongoStore(process.env.MONGODB_URI, process.env.MONGODB_DB || 'lestaripangan');
    await s.connect(); s.kind = 'MongoDB'; return s;
  }
  const s = new FileStore(dataDir); s.kind = 'Berkas JSON (mode demo)'; return s;
}
module.exports = { openStore, uid };
