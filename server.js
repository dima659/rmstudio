'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const env = process.env;
const PORT = env.PORT || 3000;
const BOT = env.BOT_TOKEN || '';
const ADMIN = env.ADMIN_CHAT_ID || '';
const APP_URL = (env.APP_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const DEV = !BOT || env.ALLOW_DEV === '1'; // без токена можно открывать в браузере (гость)
const SECRET = crypto.createHash('sha256').update('wh' + BOT).digest('hex').slice(0, 40);
const PUB = path.join(__dirname, 'public');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const STATUS = { new: 'Новая', searching: 'В поиске', found: 'Найдено', done: 'Завершена', cancelled: 'Отменена' };

// ---------- хранилище (JSON-файл) ----------
const DATA_DIR = env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { seq: 1000, users: {}, requests: [], orders: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) {}
let timer;
const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(DB_FILE, JSON.stringify(db), () => {}), 300); };

// ---------- Telegram Bot API ----------
const h = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function tg(method, body) {
  if (!BOT) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch (e) { console.error(method, e.message); return null; }
}
async function sendPhoto(chat, caption, dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m || !BOT) return false;
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chat));
    fd.append('caption', caption.slice(0, 1000));
    fd.append('parse_mode', 'HTML');
    fd.append('photo', new Blob([Buffer.from(m[2], 'base64')], { type: 'image/' + m[1] }), 'photo.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, { method: 'POST', body: fd });
    return (await r.json()).ok === true;
  } catch (e) { console.error('sendPhoto', e.message); return false; }
}
async function notifyAdmin(text, photo) {
  if (!BOT || !ADMIN) return;
  if (photo && await sendPhoto(ADMIN, text, photo)) return;
  await tg('sendMessage', { chat_id: ADMIN, text, parse_mode: 'HTML' });
}
const who = u => `${h(u.first_name || '')} ${u.username ? '@' + h(u.username) : ''} (id ${u.id})`;

// ---------- авторизация по initData ----------
function auth(req) {
  const raw = req.headers['x-init-data'] || '';
  if (raw && BOT) {
    const p = new URLSearchParams(raw);
    const hash = p.get('hash'); p.delete('hash');
    const str = [...p.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + '=' + v).join('\n');
    const key = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const calc = crypto.createHmac('sha256', key).update(str).digest('hex');
    if (hash && hash.length === calc.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calc)) &&
        Date.now() / 1000 - Number(p.get('auth_date') || 0) < 86400) {
      try { const u = JSON.parse(p.get('user') || 'null'); if (u && u.id) return u; } catch (e) {}
    }
  }
  return DEV ? { id: 1, first_name: 'Гость', username: 'guest' } : null;
}

// ---------- утилиты ----------
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const fail = (code, msg) => Object.assign(new Error(msg), { http: code });
function readJson(req, limit = 6e6) {
  return new Promise((ok, no) => {
    let n = 0; const c = [];
    req.on('data', d => { n += d.length; if (n > limit) { no(fail(413, 'Слишком большой файл')); req.destroy(); } else c.push(d); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch (e) { no(fail(400, 'Некорректный запрос')); } });
    req.on('error', no);
  });
}
const hits = new Map();
const limited = uid => { const n = Date.now(), a = (hits.get(uid) || []).filter(t => n - t < 6e5); a.push(n); hits.set(uid, a); return a.length > 15; };

// ---------- API ----------
async function apiRoute(req, res, p) {
  if (p === '/api/catalog') return json(res, 200, catalog);
  if (p === '/api/config') return json(res, 200, { channelUrl: env.CHANNEL_URL || '', reviewsUrl: env.REVIEWS_URL || '', supportUrl: env.SUPPORT_URL || '' });
  const u = auth(req);
  if (!u) return json(res, 401, { error: 'Откройте приложение из Telegram' });
  db.users[u.id] = { id: u.id, first_name: u.first_name || '', username: u.username || '', seen: Date.now() };
  if (p === '/api/me' && req.method === 'GET') {
    return json(res, 200, {
      user: { id: u.id, first_name: u.first_name || '', username: u.username || '' },
      requests: db.requests.filter(r => r.uid === u.id).slice(-50).reverse(),
      orders: db.orders.filter(o => o.uid === u.id).slice(-50).reverse()
    });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (limited(u.id)) return json(res, 429, { error: 'Слишком часто, попробуйте позже' });

  if (p === '/api/requests') {
    const b = await readJson(req);
    const text = String(b.text || '').trim().slice(0, 800);
    const photo = typeof b.photo === 'string' && b.photo.length < 5.5e6 ? b.photo : '';
    if (!photo && text.length < 3) return json(res, 400, { error: 'Добавьте фото или описание' });
    const r = { id: ++db.seq, uid: u.id, text, size: String(b.size || '').slice(0, 20), kind: String(b.kind || '').slice(0, 20), hasPhoto: !!photo, status: 'new', created: Date.now() };
    db.requests.push(r); save();
    notifyAdmin(`🆕 <b>Заявка №${r.id}</b>\nОт: ${who(u)}\nРазмер: ${h(r.size || '—')}\nОписание: ${h(text || '—')}\n\n/status ${r.id} searching|found|done|cancelled\n/reply ${r.id} текст`, photo);
    return json(res, 200, { request: r });
  }
  if (p === '/api/orders') {
    const b = await readJson(req, 1e5);
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(x => {
      const it = catalog.items.find(i => i.id === x.id);
      if (!it) return null;
      const size = String(x.size || '');
      if (it.sizes.length && !it.sizes.includes(size)) return null;
      return { id: it.id, brand: it.brand, name: it.name, size, color: String(x.color || '').slice(0, 30) };
    });
    if (!items.length || items.includes(null)) return json(res, 400, { error: 'Проверьте размеры в корзине' });
    const o = { id: ++db.seq, uid: u.id, items, status: 'new', created: Date.now() };
    db.orders.push(o); save();
    notifyAdmin(`🛒 <b>Заказ №${o.id}</b>\nОт: ${who(u)}\n` + items.map(i => `• ${h(i.brand)} ${h(i.name)} ${h(i.size)} ${h(i.color)}`).join('\n') + `\n\n/status ${o.id} searching|found|done|cancelled`);
    return json(res, 200, { order: o });
  }
  return json(res, 404, { error: 'Not found' });
}

// ---------- вебхук бота ----------
async function onUpdate(up) {
  const m = up && up.message;
  if (!m || !m.text) return;
  const t = m.text.trim(), chat = m.chat.id;
  if (/^\/start/.test(t)) {
    if (!APP_URL) return;
    return tg('sendMessage', { chat_id: chat, text: 'Привет! Откройте каталог или отправьте заявку на поиск вещи по фото.', reply_markup: { inline_keyboard: [[{ text: 'Открыть RMstudio', web_app: { url: APP_URL } }]] } });
  }
  if (String(chat) !== String(ADMIN)) return;
  let r;
  if ((r = /^\/status\s+(\d+)\s+(new|searching|found|done|cancelled)\b/.exec(t))) {
    const id = +r[1], item = db.requests.find(x => x.id === id) || db.orders.find(x => x.id === id);
    if (!item) return tg('sendMessage', { chat_id: chat, text: 'Не найдено №' + id });
    item.status = r[2]; save();
    await tg('sendMessage', { chat_id: item.uid, text: `Статус №${id}: ${STATUS[r[2]]}` });
    return tg('sendMessage', { chat_id: chat, text: `Готово: №${id} → ${STATUS[r[2]]}` });
  }
  if ((r = /^\/reply\s+(\d+)\s+([\s\S]+)/.exec(t))) {
    const id = +r[1], item = db.requests.find(x => x.id === id) || db.orders.find(x => x.id === id);
    if (!item) return tg('sendMessage', { chat_id: chat, text: 'Не найдено №' + id });
    await tg('sendMessage', { chat_id: item.uid, text: `Ответ по №${id}:\n${r[2]}` });
    return tg('sendMessage', { chat_id: chat, text: 'Отправлено' });
  }
  if (/^\/help/.test(t)) return tg('sendMessage', { chat_id: chat, text: '/status <номер> searching|found|done|cancelled\n/reply <номер> <текст>' });
}

// ---------- статика ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
function serve(res, p) {
  if (p === '/') p = '/index.html';
  let f;
  try { f = path.normalize(path.join(PUB, decodeURIComponent(p))); } catch (e) { res.writeHead(400); return res.end(); }
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(d);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p === '/tg/webhook' && req.method === 'POST') {
      if (req.headers['x-telegram-bot-api-secret-token'] !== SECRET) { res.writeHead(403); return res.end(); }
      const up = await readJson(req, 1e6);
      res.writeHead(200); res.end('ok');
      onUpdate(up).catch(e => console.error('update', e));
      return;
    }
    if (p.startsWith('/api/')) return await apiRoute(req, res, p);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serve(res, p);
  } catch (e) {
    if (!e.http) console.error(e);
    json(res, e.http || 500, { error: e.http ? e.message : 'Ошибка сервера' });
  }
});

server.listen(PORT, async () => {
  console.log('RMstudio mini app on :' + PORT + (DEV ? ' (dev: без проверки Telegram)' : ''));
  if (BOT && APP_URL) {
    const r = await tg('setWebhook', { url: APP_URL + '/tg/webhook', secret_token: SECRET, allowed_updates: ['message'] });
    console.log('setWebhook:', r && r.ok ? 'ok' : JSON.stringify(r));
    await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: APP_URL } } });
  } else if (BOT) console.log('Задайте APP_URL, чтобы включить вебхук бота');
});
