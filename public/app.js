(() => {
'use strict';
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor('#0b1622'); tg.setBackgroundColor('#0b1622'); } catch (e) {} }
const app = document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = {
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>', cart: '<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>', chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  tee: '<path d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>', shoe: '<path d="M3 16c0-2 1-3 3-3l3-4 3 2h3c3 0 6 2 6 5v2H3z"/><path d="M3 18h18"/>',
  bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>', ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'
};
const ic = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const SIZES = { 'Обувь': ['39','40','41','42','43','44','45','46'], 'Одежда': ['XS','S','M','L','XL','XXL'], 'Аксессуары': [] };
const STATUS = { new: ['НОВАЯ', ''], searching: ['В ПОИСКЕ', 's1'], found: ['НАЙДЕНО', 's2'], done: ['ЗАВЕРШЕНА', ''], cancelled: ['ОТМЕНЕНА', ''] };
const BRANDS = ['RMSTUDIO','NIKE','ADIDAS','SUPREME','NEW BALANCE','VANS','OFF-WHITE','STONE ISLAND','THE NORTH FACE','CARHARTT'];
let cart = []; try { cart = JSON.parse(localStorage.getItem('rm_cart') || '[]'); } catch (e) {}
const S = { tab: 'catalog', view: null, cat: 'Все', catalog: null, cfg: {}, me: { requests: [], orders: [] }, prod: null, sel: { size: '', color: '' }, mode: 'photo', photo: '', kind: 'Обувь', size: '', text: '', prof: 'requests', busy: false, cart };
const saveCart = () => { try { localStorage.setItem('rm_cart', JSON.stringify(S.cart)); } catch (e) {} };
const buzz = () => { try { tg && tg.HapticFeedback.impactOccurred('light'); } catch (e) {} };
let tt; const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); };
async function api(p, o = {}) {
  const r = await fetch(p, Object.assign({}, o, { headers: { 'content-type': 'application/json', 'x-init-data': tg ? tg.initData : '' } }));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Ошибка сети');
  return j;
}
const price = p => p ? new Intl.NumberFormat('ru-RU').format(p) + ' ' + (S.catalog.currency || '₽') : 'Цена по запросу';
const icoOf = i => i.category === 'Обувь' ? 'shoe' : i.category === 'Сумки' ? 'bag' : 'tee';
const img = (i, big) => i.image ? `<img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy">` : ic(icoOf(i), big ? 90 : 56);
const item = id => S.catalog.items.find(i => i.id == id);
function ticker() { const t = ((S.catalog && S.catalog.brands) || BRANDS).join('   /   ') + '   /   '; return `<div class="tk"><div class="tkt"><span>${esc(t)}</span><span>${esc(t)}</span></div></div>`; }
const head = () => `<div class="hd"><span class="u logo">RMstudio</span></div>${ticker()}`;

function vCatalog() {
  const c = S.catalog, items = c.items.filter(i => S.cat === 'Все' || i.category === S.cat);
  return `<div class="sp" data-a="tab" data-v="search" role="button" tabindex="0">${ic('search')}<span>Поиск по фото или описанию</span><b>${ic('cam', 22)}</b></div>
<div class="ch">${['Все', ...c.categories].map(x => `<button class="${x === S.cat ? 'on' : ''}" data-a="cat" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
<div class="pr"><div style="font-size:12px;font-weight:800;letter-spacing:1.5px">НОВЫЙ ДРОП</div><div class="u" style="font-size:20px;line-height:1.2">Не нашли нужное? Найдём сами</div><div>Отправьте фото или описание</div><button class="btn" data-a="tab" data-v="search">Найти вещь</button></div>
<div class="u sec">Каталог<span>${items.length} шт</span></div>
<div class="gd">${items.map(i => `<button class="pc" data-a="prod" data-v="${i.id}"><div class="pi">${img(i)}</div><div class="pt"><small>${esc(i.brand.toUpperCase())}</small><div>${esc(i.name)}</div><strong>${price(i.price)}</strong></div></button>`).join('') || '<div class="sub">Ничего не найдено</div>'}</div>`;
}
function vProd() {
  const i = S.prod, sel = (arr, k) => `<div class="sz">${arr.map(x => `<button class="${S.sel[k] === x ? 'on' : ''}" data-a="${k}" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  return `<div class="im">${img(i, true)}</div>
<div><div class="sub" style="font-weight:800;letter-spacing:1px">${esc(i.brand.toUpperCase())}</div><h2 class="u" style="font-size:20px;margin:4px 0">${esc(i.name)}</h2><div class="pv">${price(i.price)}</div></div>
${i.colors.length ? `<div><div class="lbl">Цвет</div>${sel(i.colors, 'color')}</div>` : ''}
${i.sizes.length ? `<div><div class="lbl">Размер</div>${sel(i.sizes, 'size')}</div>` : ''}
<button class="cd link" data-a="askreq"><div><b>Нет вашего размера?</b><div class="sub">Оставьте заявку, найдём у поставщиков</div></div>${ic('chev')}</button>`;
}
function vSearch() {
  const sizes = SIZES[S.kind] || [], photo = S.mode === 'photo';
  return `<h1 class="u" style="font-size:26px">Поиск</h1>
<div class="sg"><button class="${photo ? 'on' : ''}" data-a="mode" data-v="photo">По фото</button><button class="${photo ? '' : 'on'}" data-a="mode" data-v="text">По описанию</button></div>
${photo ? `<div class="dz">${S.photo ? `<img src="${S.photo}" alt="Фото вещи"><button class="x" data-a="rmphoto" aria-label="Убрать фото">${ic('x')}</button>` : `${ic('cam', 30)}<div class="u" style="font-size:14px;color:var(--t)">Загрузите фото вещи</div><div class="sub">Найдём такую же или похожую</div>`}</div>
<div class="two"><button class="btn" data-a="cam">Сделать фото</button><button class="btn o" data-a="gal">Из галереи</button></div>` : ''}
<div><div class="lbl">Размер</div><div class="sg">${Object.keys(SIZES).map(k => `<button class="${S.kind === k ? 'on' : ''}" data-a="skind" data-v="${k}">${k}</button>`).join('')}</div>
${sizes.length ? `<div class="sz" style="margin-top:10px">${sizes.map(x => `<button class="${S.size === x ? 'on' : ''}" data-a="psize" data-v="${x}">${x}</button>`).join('')}</div>` : ''}</div>
<textarea id="txt" aria-label="Описание" placeholder="${photo ? 'Цвет, бюджет, пожелания (необязательно)' : 'Бренд, модель, цвет, ссылка'}">${esc(S.text)}</textarea>
<button class="btn" style="min-height:54px" data-a="sendreq" ${S.busy ? 'disabled' : ''}>Отправить заявку</button>
<div class="sub">Ответ придёт в Telegram. Статус заявки смотрите в профиле.</div>`;
}
function vCart() {
  if (!S.cart.length) return `<h1 class="u" style="font-size:26px">Корзина</h1><div class="cd"><div class="sub">Корзина пуста</div></div><button class="btn" data-a="tab" data-v="catalog">В каталог</button>`;
  return `<h1 class="u" style="font-size:26px">Корзина</h1>${S.cart.map((c, n) => { const i = item(c.id); return i ? `<div class="row"><div class="th">${ic(icoOf(i))}</div><div class="tx"><b>${esc(i.brand)} ${esc(i.name)}</b><div class="sub">${esc([c.size, c.color].filter(Boolean).join(' · ') || '—')}</div></div><button class="ib" data-a="rmcart" data-v="${n}" aria-label="Удалить">${ic('trash', 20)}</button></div>` : ''; }).join('')}
<button class="btn" style="min-height:54px" data-a="sendorder" ${S.busy ? 'disabled' : ''}>Отправить заказ (${S.cart.length})</button><div class="sub">Менеджер свяжется с вами в Telegram и назовёт итоговую цену.</div>`;
}
function vProfile() {
  const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || S.me.user || {}, name = u.first_name || 'Гость';
  const L = S.prof === 'requests' ? S.me.requests.map(r => rowS(r, (r.text || 'Заявка по фото').slice(0, 40), '№' + r.id + ' · ' + (r.size || 'размер не указан'))) : S.me.orders.map(o => rowS(o, 'Заказ №' + o.id, o.items.map(i => i.name).join(', ')));
  const link = (t, u2, n) => `<button class="row" data-a="link" data-v="${esc(u2)}"><span style="color:var(--p)">${ic(n)}</span><span class="tx"><b>${t}</b></span>${ic('chev', 18)}</button>`;
  return `<h1 class="u" style="font-size:26px">Профиль</h1>
<div class="cd us">${u.photo_url ? `<img class="av" src="${esc(u.photo_url)}" alt="">` : `<div class="av u">${esc(name[0].toUpperCase())}</div>`}<div><div class="u" style="font-size:17px">${esc(name)}</div><div class="sub" style="margin-top:3px">${u.username ? '@' + esc(u.username) : ''}</div></div></div>
<div class="cd st"><div><b>${S.me.requests.length}</b>ЗАЯВКИ</div><div><b>${S.me.orders.length}</b>ЗАКАЗЫ</div></div>
<div class="sg"><button class="${S.prof === 'requests' ? 'on' : ''}" data-a="prof" data-v="requests">Мои заявки</button><button class="${S.prof === 'orders' ? 'on' : ''}" data-a="prof" data-v="orders">Мои заказы</button></div>
${L.join('') || '<div class="cd"><div class="sub">Пока пусто</div></div>'}
${link('Наш Telegram-канал', S.cfg.channelUrl, 'grid')}${link('Отзывы клиентов', S.cfg.reviewsUrl, 'ok')}${link('Написать менеджеру', S.cfg.supportUrl, 'user')}`;
}
function rowS(x, title, sub) { const s = STATUS[x.status] || STATUS.new; return `<div class="row"><div class="th">${ic('cam', 22)}</div><div class="tx"><b>${esc(title)}</b><div class="sub" style="font-size:12px">${esc(sub)}</div></div><span class="pl ${s[1]}">${s[0]}</span></div>`; }
function tabbar() {
  const t = (id, n, l, extra = '') => `<button class="${S.tab === id ? 'on' : ''}" data-a="tab" data-v="${id}">${ic(n)}${extra}${l}</button>`;
  return `<nav class="tb">${t('catalog', 'grid', 'Каталог')}${t('search', 'search', 'Поиск')}${t('cart', 'cart', 'Корзина', S.cart.length ? `<i>${S.cart.length}</i>` : '')}${t('profile', 'user', 'Профиль')}</nav>`;
}
function render() {
  if (S.view === 'prod') {
    app.innerHTML = `<div class="hd"><button class="ib" data-a="back" aria-label="Назад">${ic('back')}</button><span class="u logo" style="text-align:center;font-size:15px">Товар</span><span style="width:44px"></span></div>${ticker()}<main class="bd">${vProd()}</main><div class="bar"><button class="btn" style="min-height:52px" data-a="addcart">Добавить в корзину</button></div>`;
  } else {
    const v = { catalog: vCatalog, search: vSearch, cart: vCart, profile: vProfile }[S.tab]();
    app.innerHTML = `${head()}<main class="bd">${v}</main>${tabbar()}`;
  }
  try { tg && (S.view ? tg.BackButton.show() : tg.BackButton.hide()); } catch (e) {}
}
function openLink(u) { if (!u) return toast('Ссылка пока не задана'); if (tg && /^https:\/\/t\.me\//.test(u)) tg.openTelegramLink(u); else if (tg) tg.openLink(u); else window.open(u, '_blank'); }
async function refreshMe() { try { S.me = await api('/api/me'); } catch (e) {} }
const A = {
  tab: v => { S.tab = v; S.view = null; render(); scrollTo(0, 0); },
  cat: v => { S.cat = v; render(); },
  prod: id => { S.prod = item(id); S.sel = { size: '', color: S.prod.colors[0] || '' }; S.view = 'prod'; render(); scrollTo(0, 0); },
  back: () => { S.view = null; render(); },
  color: v => { S.sel.color = v; render(); }, size: v => { S.sel.size = v; render(); },
  addcart: () => { const i = S.prod; if (i.sizes.length && !S.sel.size) return toast('Выберите размер'); S.cart.push({ id: i.id, size: S.sel.size, color: S.sel.color }); saveCart(); toast('Добавлено в корзину'); S.view = null; S.tab = 'catalog'; render(); },
  rmcart: n => { S.cart.splice(+n, 1); saveCart(); render(); },
  mode: v => { S.mode = v; render(); }, skind: v => { S.kind = v; S.size = ''; render(); }, psize: v => { S.size = S.size === v ? '' : v; render(); },
  cam: () => document.getElementById('f-cam').click(), gal: () => document.getElementById('f-gal').click(), rmphoto: () => { S.photo = ''; render(); },
  askreq: () => { const i = S.prod; S.text = i.brand + ' ' + i.name + (S.sel.color ? ', ' + S.sel.color : ''); S.mode = 'text'; S.view = null; S.tab = 'search'; render(); },
  prof: v => { S.prof = v; render(); }, link: v => openLink(v), reload: () => location.reload(),
  sendreq: async () => {
    if (S.busy) return;
    if (!(S.mode === 'photo' && S.photo) && S.text.trim().length < 3) return toast(S.mode === 'photo' ? 'Добавьте фото или описание' : 'Опишите вещь');
    S.busy = true; render();
    try {
      await api('/api/requests', { method: 'POST', body: JSON.stringify({ text: S.text, size: S.size, kind: S.kind, photo: S.mode === 'photo' ? S.photo : '' }) });
      S.photo = ''; S.text = ''; S.size = ''; await refreshMe(); S.tab = 'profile'; S.prof = 'requests'; toast('Заявка отправлена');
    } catch (e) { toast(e.message); }
    S.busy = false; render();
  },
  sendorder: async () => {
    if (S.busy || !S.cart.length) return;
    S.busy = true; render();
    try { await api('/api/orders', { method: 'POST', body: JSON.stringify({ items: S.cart }) }); S.cart.length = 0; saveCart(); await refreshMe(); S.tab = 'profile'; S.prof = 'orders'; toast('Заказ отправлен'); }
    catch (e) { toast(e.message); }
    S.busy = false; render();
  }
};
app.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el || !A[el.dataset.a]) return; buzz(); A[el.dataset.a](el.dataset.v, el); });
app.addEventListener('input', e => { if (e.target.id === 'txt') S.text = e.target.value; });
if (tg) tg.BackButton.onClick(() => A.back());
function compress(file) {
  return new Promise((ok, no) => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.8)); };
    im.onerror = () => no(new Error('Не удалось прочитать фото')); im.src = u;
  });
}
['f-cam', 'f-gal'].forEach(id => document.getElementById(id).addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { S.photo = await compress(f); S.mode = 'photo'; S.tab = 'search'; S.view = null; render(); } catch (err) { toast(err.message); }
}));
async function boot() {
  let step = 0;
  const paint = () => { app.innerHTML = `<div class="spl"><div class="ring"><svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="53" fill="none" stroke="#24394f" stroke-width="8"/><circle cx="60" cy="60" r="53" fill="none" stroke="#5bb0e8" stroke-width="8" stroke-linecap="round" stroke-dasharray="215 333"/></svg><b class="u">RM</b></div>
<div style="text-align:center"><div class="u" style="font-size:32px;color:var(--p)">RMstudio</div><div class="sub" style="margin-top:6px">Загрузка · ${Math.min(99, step * 33)}%</div></div>
<div class="stp">${['Проверяем доступ', 'Загружаем каталог', 'Готовим ваши заявки'].map((t, i) => `<div class="${i < step ? 'k' : ''}">${i < step ? ic('ok', 18) : '<span style="width:18px"></span>'}${t}</div>`).join('')}</div>${ticker()}</div>`; };
  paint(); const t0 = Date.now(), iv = setInterval(() => { step = Math.min(step + 1, 3); paint(); }, 450);
  try { const r = await Promise.all([api('/api/catalog'), api('/api/config'), api('/api/me')]); S.catalog = r[0]; S.cfg = r[1]; S.me = r[2]; }
  catch (e) { clearInterval(iv); app.innerHTML = `<div class="spl"><div class="u" style="font-size:20px">Нет соединения</div><div class="sub">${esc(e.message)}</div><button class="btn" style="width:auto" data-a="reload">Повторить</button></div>`; return; }
  await new Promise(r => setTimeout(r, Math.max(0, 1500 - (Date.now() - t0)))); clearInterval(iv); render();
}
boot();
})();
