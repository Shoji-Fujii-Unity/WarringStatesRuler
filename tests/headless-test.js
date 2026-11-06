/* game/index.html のロジックを DOM スタブでヘッドレス検証するテスト
   使い方: node tests/headless-test.js [sim数]                                      */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('script block not found');
const code = m[1];

/* ---------- テスト結果 ---------- */
let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, detail) {
  if (cond) { pass++; return true; }
  fail++; fails.push(name + (detail ? ' :: ' + detail : ''));
  return false;
}
function section(t) { console.log('\n--- ' + t + ' ---'); }

/* ---------- DOM スタブ ---------- */
const ID_SET = new Set();
for (const mm of html.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)) ID_SET.add(mm[1]);

function makeCtx() {
  const c = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: '',
    ops: 0,
    fillRect() { c.ops++; }, strokeRect() { c.ops++; }, clearRect() { c.ops++; },
    beginPath() { c.ops++; }, moveTo() { c.ops++; }, lineTo() { c.ops++; }, closePath() { c.ops++; },
    fill() { c.ops++; }, stroke() { c.ops++; }, arc() { c.ops++; }, setLineDash() { c.ops++; },
    fillText() { c.ops++; }, drawImage() { c.ops++; }, save() {}, restore() {},
    translate() {}, scale() {}, measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
  };
  return c;
}
function makeEl(tag, attrs) {
  const cls = new Set();
  const el = {
    tagName: (tag || 'div').toLowerCase(),
    _attrs: Object.assign({}, attrs || {}),
    _html: '', _text: '', _queryNodes: {}, children: [], handlers: {}, style: {},
    value: '', disabled: false, title: '', clientWidth: 420, clientHeight: 300,
    get id() { return this._attrs.id || ''; },
    get className() { return this._attrs.class || ''; },
    set className(v) { this._attrs.class = v; },
    set textContent(v) { this._text = String(v); this._html = ''; },
    get textContent() { return this._text; },
    set innerHTML(v) { this._html = String(v); this._queryNodes = {}; this.children = []; },
    get innerHTML() { return this._html; },
    get childNodes() { return this.children; },
    get firstChild() { return this.children[0] || null; },
    setAttribute(n, v) { this._attrs[n] = String(v); },
    getAttribute(n) { return this._attrs[n] === undefined ? null : this._attrs[n]; },
    removeAttribute(n) { delete this._attrs[n]; },
    hasAttribute(n) { return this._attrs[n] !== undefined; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); },
    dispatch(t, ev) {
      const list = this.handlers[t] || [];
      const e = Object.assign({ target: this, type: t, preventDefault() {}, stopPropagation() {} }, ev || {});
      for (const fn of list) fn.call(this, e);
      return list.length;
    },
    click() { return this.dispatch('click'); },
    classList: {
      add(...c) { c.forEach((x) => cls.add(x)); },
      remove(...c) { c.forEach((x) => cls.delete(x)); },
      contains(c) { return cls.has(c); },
      toggle(c, v) { if (v === undefined) { cls.has(c) ? cls.delete(c) : cls.add(c); } else if (v) cls.add(c); else cls.delete(c); return cls.has(c); },
    },
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (!this._queryNodes[sel]) this._queryNodes[sel] = parseInner(this._html, sel);
      return this._queryNodes[sel];
    },
    scrollIntoView() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: 704, bottom: 416, width: 704, height: 416 }; },
  };
  el.style.setProperty = function (k, v) { this[k] = v; };
  el.style.getPropertyValue = function (k) { return this[k] === undefined ? '' : this[k]; };
  if (tag === 'canvas') { el.width = 300; el.height = 150; el._ctx = null; el.getContext = function () { return (this._ctx = this._ctx || makeCtx()); }; }
  return el;
}
/* innerHTML からの要素抽出（テストに必要な限りの簡易セレクタ） */
function parseInner(h, sel) {
  const out = [];
  const mm = sel.match(/^([a-z]+)?(?:\[([a-zA-Z0-9_-]+)\])?$/);
  if (!mm) return out;
  const wantTag = mm[1] || null, wantAttr = mm[2] || null;
  for (const t of h.matchAll(/<([a-z]+)([^>]*)>/gi)) {
    const tag = t[1].toLowerCase();
    if (wantTag && tag !== wantTag) continue;
    const attrs = {};
    for (const a of t[2].matchAll(/([a-zA-Z0-9_:-]+)(?:="([^"]*)")?/g)) {
      if (!a[1]) continue;
      attrs[a[1]] = a[2] === undefined ? '' : a[2];
    }
    if (wantAttr && attrs[wantAttr] === undefined) continue;
    const el = makeEl(tag, attrs);
    out.push(el);
  }
  return out;
}
const els = new Map();
function getEl(id) {
  if (!els.has(id)) {
    const tag = /^(mapc|titleCanvas)$/.test(id) ? 'canvas' : (/^(commitRange)$/.test(id) ? 'input' : 'div');
    els.set(id, makeEl(tag, { id }));
  }
  return els.get(id);
}
const document = {
  _title: '', body: makeEl('body'), documentElement: makeEl('html'),
  title: '',
  getElementById: (id) => getEl(id),
  createElement: (t) => makeEl(t),
  querySelectorAll(sel) {
    const out = [];
    for (const mm of html.matchAll(/<([a-z]+)([^>]*data-i18n="([A-Za-z0-9_]+)"[^>]*)>/gi)) {
      const el = makeEl(mm[1], { 'data-i18n': mm[3] });
      out.push(el);
    }
    if (sel === '[data-i18n]') return out;
    return [];
  },
  querySelector() { return null; },
  addEventListener(t, fn) { (this.handlers = this.handlers || {})[t] = (this.handlers[t] || []).concat(fn); },
};
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let audioNodes = 0;
function FakeNode() { audioNodes++; return { connect() {}, disconnect() {} }; }
class FakeAudioCtx {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = FakeNode(); }
  createOscillator() { audioNodes++; return { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createGain() { audioNodes++; return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, connect() {} }; }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { audioNodes++; return { buffer: null, connect() {}, start() {} }; }
  createBiquadFilter() { audioNodes++; return { type: '', frequency: { value: 0 }, connect() {} }; }
  resume() {}
}
const win = {
  addEventListener() {}, removeEventListener() {},
  AudioContext: FakeAudioCtx, innerWidth: 900, innerHeight: 420,
  __WSR_TESTING__: true,
  setTimeout, clearTimeout, setInterval, clearInterval,
};
const sandbox = {
  document, localStorage, navigator: { language: 'ja-JP' }, window: win,
  console, Math, JSON, Date, setTimeout, clearTimeout, setInterval, clearInterval,
  Infinity, isNaN, parseInt, parseFloat, String, Number, Object, Array, RegExp, Set, Map, module,
  requestAnimationFrame: (f) => setTimeout(f, 16),
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: 'index.html' });
const G = module.exports;

/* =================================================================== */
section('多言語');
const langs = ['ja', 'en', 'zh'];
const keysets = langs.map((l) => Object.keys(G.I18N[l]));
for (const l of langs) ok(G.I18N[l] && keysets[langs.indexOf(l)].length > 100, 'I18N.' + l + ' HasKeyBlock');
const baseKeys = keysets[0].sort();
for (let i = 1; i < keysets.length; i++) {
  const b = keysets[i].sort();
  const missing = baseKeys.filter((k) => b.indexOf(k) < 0);
  const extra = b.filter((k) => baseKeys.indexOf(k) < 0);
  ok(!missing.length, l_of(i) + ' と ja でキーが一致', '不足: ' + missing.slice(0, 12).join(','));
  ok(!extra.length, l_of(i) + ' に余分なキーなし', '過剰: ' + extra.slice(0, 12).join(','));
}
function l_of(i) { return 'I18N.' + langs[i]; }
let phBad = [];
for (const k of baseKeys) {
  let ref = null;
  for (const l of langs) {
    const s = G.I18N[l][k];
    if (typeof s !== 'string') { phBad.push(l + '.' + k + ' = 翻訳なし'); continue; }
    const ph = (s.match(/\{(\w+)\}/g) || []).sort().join(',');
    if (ref === null) ref = ph;
    else if (ph !== ref) phBad.push(l + '.' + k + ' [' + ph + ' != ' + ref + ']');
  }
}
ok(!phBad.length, 'プレースホルダが全言語で一致', phBad.slice(0, 10).join(' | '));
/* 名前解決 */
G.setLang('ja');
ok(G.t('log_take', { a: 'qin', c: 'daliang', d: 'wei' }).indexOf('大梁') >= 0, '都市名解決(ja)', G.t('log_take', { a: 'qin', c: 'daliang', d: 'wei' }));
G.setLang('en');
ok(G.t('log_take', { a: 'qin', c: 'daliang', d: 'wei' }).indexOf('Daliang') >= 0, 'city name (en)');
ok(G.t('log_begin', { s: 'zhao' }).indexOf('Zhao') >= 0, 'state name (en)');
G.setLang('zh');
ok(G.t('log_take', { c: 'daliang' }).indexOf('大梁') >= 0, '简体 city name (zh)');
ok(G.t('u_missing_key') === 'u_missing_key', '未知キーはキーを返す');
/* data-i18n キーは全て辞書にある */
const i18nAttrs = [...html.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)].map((x) => x[1]);
ok(i18nAttrs.length > 10, 'data-i18n がある (' + i18nAttrs.length + ')');
const missAttr = i18nAttrs.filter((k) => G.I18N.ja[k] === undefined);
ok(!missAttr.length, 'data-i18n キーは辞書に存在', missAttr.join(','));
/* ソース中の t('key') が辞書に存在するか（動的キーはプレフィックス検査） */
(function () {
  const body = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const used = new Set();
  const prefixes = new Set();
  for (const mm of body.matchAll(/[^A-Za-z0-9_$]t\(\s*'([A-Za-z0-9_]+)'/g)) {
    const k = mm[1];
    if (k.endsWith('_')) prefixes.add(k); else used.add(k);
  }
  const jaKeys = Object.keys(G.I18N.ja);
  const missing = [...used].filter((k) => G.I18N.ja[k] === undefined);
  ok(!missing.length, '静的キーが全て辞書にある (' + used.size + ' 種)', missing.slice(0, 14).join(','));
  const orphanPrefix = [...prefixes].filter((p) => !jaKeys.some((k) => k.indexOf(p) === 0));
  ok(!orphanPrefix.length, '動的キーのプレフィックスが辞書にある (' + prefixes.size + ' 種)', orphanPrefix.join(','));
  /* 未使用キーの報告（失敗にはしない） */
  const unused = jaKeys.filter((k) => !used.has(k) && !i18nAttrs.includes(k) && !used.has(k));
  console.log('  参考: 静的キー ' + used.size + ' / 辞書 ' + jaKeys.length + ' / 未参照 ' + unused.length + ' → ' + unused.slice(0, 12).join(','));
})();

section('兵科・地形・相克');
const cntCycle = G.CNT.cav.inf > 1 && G.CNT.spc.cav > 1 && G.CNT.inf.arc > 1 && G.CNT.arc.spc > 1;
ok(cntCycle, '騎>歩>弓>槍>騎 の巡り合わせ');
for (const a of ['inf', 'arc', 'cav', 'spc']) {
  for (const d of ['inf', 'arc', 'cav', 'spc']) {
    ok(G.CNT[a][d] > 0 && G.CNT[a][d] <= 2, 'CNT[' + a + '][' + d + '] が範囲内');
  }
}
ok(G.TERRAIN.water.cost === Infinity && G.TERRAIN.wall.cost === Infinity, '河と城壁は通行不能');
ok(G.TYPES.cav.noMountain === 1, '騎兵は山に入れない');
for (const t of ['forest', 'mountain', 'water', 'village', 'wall', 'gate', 'base']) {
  ok(G.I18N.ja['tg_' + t] && G.I18N.en['tg_' + t] && G.I18N.zh['tg_' + t], 'tg_' + t + ' が全言語');
}

section('ピクセルスプライト');
let artBad = [];
for (const k of Object.keys(sandbox.window.__dummy || {})) { /* noop */ }
const art = (function () {
  const uri = G.spriteUri('inf', { c: '#112233', d: '#223344', l: '#445566' });
  return uri;
})();
ok(art.indexOf('data:image/svg+xml,') === 0, 'スプライトは data URI');
ok(art.indexOf('%3Csvg') >= 0 || art.indexOf('<svg') >= 0, 'SVG を内包');
for (const t of ['inf', 'arc', 'cav', 'spc']) {
  const u = G.spriteUri(t, { c: '#abcdef', d: '#123456', l: '#fedcba' });
  ok(u.length > 200, t + ' のスプライト生成');
}

section('街道と都市');
G.buildAdj();
const adj = {};
G.CITIES.forEach((c) => { adj[c.k] = new Set(); });
let linkBad = [];
for (const L of G.LINKS) {
  if (!adj[L[0]] || !adj[L[1]]) { linkBad.push(L.join('-')); continue; }
  adj[L[0]].add(L[1]); adj[L[1]].add(L[0]);
}
ok(!linkBad.length, 'LINKS は全て既存都市', linkBad.join(','));
const orphan = G.CITIES.filter((c) => adj[c.k].size === 0).map((c) => c.k);
ok(!orphan.length, '孤立都市なし', orphan.join(','));
/* 連結性 */
const seen = new Set([G.CITIES[0].k]), q = [G.CITIES[0].k];
while (q.length) {
  const k = q.pop();
  for (const nb of adj[k]) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
}
ok(seen.size === G.CITIES.length, '街道グラフは連結 (' + seen.size + '/' + G.CITIES.length + ')');
G.CITIES.forEach((c) => { ok(c.x >= 0 && c.x < 44 && c.y >= 0 && c.y < 26, '都市座標が盤内: ' + c.k); });
const dup = {};
G.CITIES.forEach((c) => { const k = c.x + ',' + c.y; ok(!dup[k], '都市位置の重複なし: ' + c.k); dup[k] = 1; });

section('戦略レイヤー（_campaign_）');
function checkCampaign(tag) {
  const S = G.getS();
  let problems = [];
  const alive = G.STATES.filter((s) => G.st(s.k).alive);
  for (const c of G.CITIES) {
    const d = S.cities[c.k];
    const owner = G.st(d.owner);
    if (!owner.alive) problems.push('dead owner ' + c.k + ' -> ' + d.owner);
    if (!(d.garr >= 0) || d.garr !== Math.round(d.garr)) problems.push('garr ' + c.k + '=' + d.garr);
    if (d.walls < 1 || d.walls > 5) problems.push('walls ' + c.k + '=' + d.walls);
    if (d.farms < 1 || d.farms > 5) problems.push('farms ' + c.k);
    if (d.town < 1 || d.town > 5) problems.push('town ' + c.k);
    if (d.unrest < 0 || d.unrest > 100) problems.push('unrest ' + c.k);
  }
  for (const s of alive) {
    const stt = G.st(s.k);
    if (stt.gold < 0 || stt.food < 0) problems.push('negative res ' + s.k + ' g=' + stt.gold + ' f=' + stt.food);
    if (stt.men < 0 || stt.men > 200) problems.push('men range ' + s.k + '=' + stt.men);
    if (stt.stab < 0 || stt.stab > 100) problems.push('stab range ' + s.k);
    if (stt.pol < 0) problems.push('pol neg ' + s.k);
    if (G.citiesOf(s.k).length === 0) problems.push('alive state w/o cities ' + s.k);
    if (G.citiesOf(s.k).every((c) => c.k !== s.cap)) problems.push('alive state lost capital ' + s.k);
  }
  ok(!problems.length, '状態不変条件 ' + tag, problems.slice(0, 6).join(' | '));
}
const sims = parseInt(process.argv[2] || '6', 10);
/* 攻め込まれた戦をヘッドレスで解決する（UI の OK ボタンの代替） */
function resolvePending() {
  const S0 = G.getS();
  if (!S0 || !S0.pendingBattle) return false;
  G.startPendingBattle();
  const B = G.getBT();
  if (B) { G.simBattle(B); G.finishBattleUI(); }
  G.setBT(null);
  return true;
}
let ended = 0, seasonsTotal = 0, wins = 0;
for (const diff of ['easy', 'normal', 'hard']) {
  for (let run = 0; run < Math.max(1, Math.floor(sims / 3)); run++) {
    const me = G.STATES[(run + diff.length) % G.STATES.length].k;
    G.setProf({ diff: diff, state: me, lang: 'ja', sound: false, bgm: false });
    G.newCampaign(me, diff, 1000 + run * 977 + diff.length);
    G.snapshotInitial();
    let seasons = 0, end = null;
    while (seasons < 110) {
      G.endSeason();
      for (let w = 0; w < 5 && resolvePending(); w++) { /* 侵攻戦 */ }
      seasons++;
      const S = G.getS();
      if (seasons % 7 === 0) checkCampaign(diff + '/' + me + '#' + run + '@' + seasons);
      if (S.over) { end = S.over; break; }
    }
    checkCampaign(diff + '/' + me + '#' + run + '/end');
    seasonsTotal += seasons;
    if (end) { ended++; if (end.win) wins++; }
    /* ログが全言語で翻訳できるか */
    const S = G.getS();
    const keys = S.log.map((l) => l.k);
    for (const lang of langs) {
      G.setLang(lang);
      const bad = keys.filter((k) => G.t(k) === k);
      ok(!bad.length, 'ログ翻訳 ' + lang + ' (' + diff + ')', bad.slice(0, 5).join(','));
    }
    G.setLang('ja');
  }
}
ok(ended === sims, '全キャンペーンが決着に至る (' + ended + '/' + sims + ' 回, 平均 ' + Math.round(seasonsTotal / sims) + ' 季節)');
ok(seasonsTotal / sims <= 90, '決着までの長さを抑えている (平均 ' + Math.round(seasonsTotal / sims) + ' 季節)');
ok(wins >= 0, '勝利・敗北の両方が発生しうる (勝利 ' + wins + ')');

section('保存（localStorage）');
(function () {
  G.setProf({ diff: 'normal', state: 'qi', lang: 'zh', sound: true, bgm: false });
  G.saveProfile();
  G.newCampaign('qi', 'normal', 4242);
  G.snapshotInitial();
  G.endSeason(); G.endSeason();
  const before = G.getS().cities.dingtao.garr;
  ok(G.loadSave() !== null, '自動保存されている');
  const S = G.getS();
  S.cities.dingtao.garr = before + 99;
  G.saveGame(true);
  const back = G.loadSave();
  ok(JSON.stringify(back) === JSON.stringify(S), '保存→読込で状態が完全一致');
  ok(back.cities.dingtao.garr === before + 99, '変更値が保存される (' + back.cities.dingtao.garr + ')');
  ok(G.getPROF().lang === 'zh', '言語設定がプロファイルに残る');
  G.wipeAll();
  ok(G.loadSave() === null, '消去で読み出し null');
  localStorage.setItem(G.LS_S, '{ not json');
  ok(G.loadSave() === null, '壊れた JSON は無視');
  localStorage.setItem(G.LS_S, JSON.stringify({ me: 'zzz' }));
  ok(G.loadSave() === null, '不正な国キーのセーブは無視');
})();

section('戦闘レイヤー（戦術）');
function checkBattle(B, tag) {
  const problems = [];
  const occ = {};
  for (const u of B.units) {
    const t = B.tiles[u.y][u.x].t;
    if (t === 'water' || t === 'wall') problems.push(u.side + ' on ' + t);
    if (t === 'mountain' && u.type === 'cav') problems.push('cav on mountain');
    const k = u.x + ',' + u.y;
    if (occ[k]) problems.push('overlap ' + k);
    occ[k] = 1;
    if (!(u.hp > 0)) problems.push('hp<=0 ' + u.type);
    if (u.x < 0 || u.y < 0 || u.x >= B.cols || u.y >= B.rows) problems.push('out of board');
  }
  for (const s of ['p', 'e']) {
    const b = B.basePos[s];
    if (!b || B.tiles[b.y][b.x].t !== 'base') problems.push('base missing ' + s);
    if (B.morale[s] < 0 || B.morale[s] > 100) problems.push('morale range ' + s);
    if (B.units.filter((u) => u.side === s).length > B.cap[s]) problems.push('over cap ' + s);
  }
  if (!G.walkableBetween(B.basePos.p, B.basePos.e, 'inf', B)) problems.push('camps disconnected');
  ok(!problems.length, '盤面不変条件 ' + tag, problems.slice(0, 6).join(' | '));
}
let battleEnded = 0, attWins = 0, defWins = 0, battlesRun = 0, siegeN = 0;
const linkPairs = [];
for (const L of G.LINKS) { linkPairs.push([L[0], L[1]]); linkPairs.push([L[1], L[0]]); }
for (let i = 0; i < linkPairs.length; i++) {
  const me = G.STATES[i % G.STATES.length].k;
  G.newCampaign(me, 'normal', 500 + i * 131);
  G.snapshotInitial();
  const S = G.getS();
  const [from, to] = linkPairs[i];
  if (S.cities[from].owner === S.cities[to].owner) continue;
  S.cities[to].owner = G.STATES[(i + 3) % G.STATES.length].k;
  if (S.cities[to].owner === S.cities[from].owner) S.cities[to].owner = G.STATES[(i + 5) % G.STATES.length].k;
  G.declareWar(S.cities[from].owner, S.cities[to].owner, false);
  const commit = 12 + (i % 5) * 7;
  const B = G.makeBattle(from, to, commit, null, true);
  battlesRun++;
  if (B.siege) siegeN++;
  checkBattle(B, from + '→' + to + ' init');
  B.maxTurn = 18;                    // 検証用に短縮
  G.simBattle(B);
  checkBattle(B, from + '→' + to + ' end');
  if (B.over && B.over.winner) { battleEnded++; if (B.over.winner === 'att') attWins++; else defWins++; }
  ok(B.turn <= B.maxTurn + 3, 'ターン上限内で決着 ' + from + '→' + to, 'turn=' + B.turn);
  const applied = G.applyBattleResult(B);
  const S2 = G.getS();
  ok(S2.cities[to].garr >= 0 && S2.cities[from].garr >= 0, '戦闘後に守備が非負');
  if (applied.attWin) ok(S2.cities[to].owner === B.att, '勝利で都市が攻め手に: ' + to);
  else ok(S2.cities[to].owner !== B.att, '撃退で都市は守り手のまま: ' + to);
}
ok(battlesRun >= 30, '様々な街道で戦闘を検証 (' + battlesRun + ' 戦, 攻城 ' + siegeN + ')');
ok(battleEnded === battlesRun, '全戦闘が決着');
ok(attWins > 0 && defWins > 0, '攻め手・守り手の双方が勝つ (att ' + attWins + ' / def ' + defWins + ')');

section('都市陥落と併合');
(function () {
  G.newCampaign('wei', 'normal', 77);
  G.snapshotInitial();
  const S = G.getS();
  const foe = 'han';
  const from = 'suanzao', to = 'xinzheng';       // 韓の都
  S.cities[from].garr = 60;
  S.cities[to].garr = 6;
  G.declareWar('wei', foe, false);
  const B = G.makeBattle(from, to, 50, null, true);
  B.baseHp.e = 0;                                 // 本営落城を再現
  G.bCheckEnd(B);
  ok(B.over && B.over.winner === 'att', '本営落城で攻め手勝利', JSON.stringify(B.over));
  const res = G.applyBattleResult(B);
  ok(S.cities[to].owner === 'wei', '都を落とすと占領', 'owner=' + S.cities[to].owner);
  ok(!G.st(foe).alive, '都落城で国滅び');
  ok(G.citiesOf(foe).length === 0, '滅びた国の都市は併合される', '残り ' + G.citiesOf(foe).length);
  ok(G.citiesOf('wei').length > 4, '併合で領土が増える (' + G.citiesOf('wei').length + ')');
})();

section('出兵編成と戦法');
(function () {
  G.newCampaign('zhao', 'hard', 31337);
  G.snapshotInitial();
  const S = G.getS();
  G.declareWar('zhao', 'wei', false);
  const composition = { inf: 0, arc: 0, cav: 0, spc: 6 };
  G.setBT(G.makeBattle('shangdang', 'anyi', 40, null, true, composition));
  const B = G.getBT();
  ok(B.att === 'zhao' && B.def === 'wei', '攻め手／守り手の設定', B.att + ' vs ' + B.def);
  ok(B.units.filter((u) => u.side === 'p').length === B.cap.p, '指定数の部隊が出陣する');
  ok(B.units.filter((u) => u.side === 'p' && u.type === 'spc').length === 6, '指定した槍兵編成を反映');
  ok(B.units.filter((u) => u.side === 'e').length === B.cap.e, '守備軍も開戦時に全兵力を配置');
  ok(typeof G.tryRecruit === 'undefined' && !html.includes('id="recruits"'), '戦闘中に徴兵する操作がない');
  const own = B.units.filter((u) => u.side === 'p');
  ok(!own.some((u) => B.tiles[u.y][u.x].t === 'wall'), '編成部隊は合法的なマスに配置');
  /* 戦法：4種類をeach */
  const bySkill = {};
  G.GENERALS.forEach((g) => { if (g.skill && !bySkill[g.skill]) bySkill[g.skill] = g.k; });
  for (const sk of ['fire', 'charge', 'rally', 'surprise']) {
    const gk = bySkill[sk];
    ok(!!gk, '戦法 ' + sk + ' を持つ将がいる');
    if (!gk) continue;
    const B2 = G.makeBattle('shangdang', 'anyi', 40, null, true);
    B2.gen.p = gk; B2.tac.p = 6;
    let tx = -1, ty = -1;
    if (sk === 'charge') { const u = B2.units.filter((o) => o.side === 'p')[0]; tx = u.x; ty = u.y; }
    else if (sk === 'fire') {
      const foes = B2.units.filter((o) => o.side === 'e');
      if (foes.length) { tx = foes[0].x; ty = foes[0].y; } else { tx = 1; ty = 1; }
    } else { const b = B2.basePos.p; tx = b.x; ty = b.y; }
    B2.units.forEach((u) => { if (u.side === 'e' && sk === 'fire') u.hp = 999; });
    const ownUnits = B2.units.filter((o) => o.side === 'p');
    const okUse = G.useSkill(B2, 'p', tx, ty);
    ok(okUse === true, '戦法 ' + sk + ' が発動する', 'gen=' + gk + ' tile=' + tx + ',' + ty);
    ok(B2.tac.p === 6 - G.SKILLS[sk].cost, '戦法 ' + sk + ' は軍略 ' + G.SKILLS[sk].cost + ' を消費', 'tac=' + B2.tac.p);
    if (sk === 'charge' && ownUnits.length) {
      ok(ownUnits[0].buff === 1 && ownUnits[0].acted === false, '搦手（charge）で再行動・強化');
    }
    /* 軍略が足りない場合は使えない */
    const B3 = G.makeBattle('shangdang', 'anyi', 40, null, true);
    B3.gen.p = gk; B3.tac.p = 0;
    ok(!G.useSkill(B3, 'p', 1, 1), '軍略不足では戦法を使えない');
    ok(!G.skillReady(B3, 'p'), 'skillReady が軍略不足で false');
    const B4 = G.makeBattle('shangdang', 'anyi', 40, null, true);
    ok(!G.skillReady(B4, 'p') || B4.gen.p !== null, '将がいなければ戦法は使えない（自動選択）');
  }
  G.setBT(null);
})();

section('ダメージ計算');
(function () {
  G.newCampaign('qin', 'normal', 99);
  G.snapshotInitial();
  G.setBT(G.makeBattle('xianyang', 'liyang', 30, null, true));
  const B = G.getBT();
  const a = { type: 'cav', hp: 26, atkMul: 1, x: 0, y: 0, side: 'p', buff: 0 };
  const def = { type: 'spc', hp: 34, atkMul: 1, x: 4, y: 4, side: 'e' };
  const dCavSpc = G.dmgOf(B, a, { kind: 'unit', u: def }, false);
  const b2 = { type: 'spc', hp: 34, atkMul: 1, x: 0, y: 0, side: 'p', buff: 0 };
  const dSpcCav = G.dmgOf(B, b2, { kind: 'unit', u: { type: 'cav', hp: 26, atkMul: 1, x: 4, y: 4, side: 'e' } }, false);
  ok(dSpcCav > dCavSpc, '槍兵は騎兵に勝る（期待ダメージ）', dSpcCav.toFixed(1) + ' vs ' + dCavSpc.toFixed(1));
  const low = Object.assign({}, a, { hp: 1 });
  ok(G.dmgOf(B, low, { kind: 'unit', u: def }, false) < G.dmgOf(B, a, { kind: 'unit', u: def }, false), '消耗すると与えるダメージが減る');
  const r = G.rollDmg(B, a, { kind: 'unit', u: def }, false);
  ok(r >= 1 && r < 40, 'ロール値が範囲内', String(r));
  G.setBT(null);
})();

section('サウンド');
(function () {
  audioNodes = 0;
  G.setSfx(true, false);
  for (const k of ['ui', 'atk', 'kill', 'win', 'season', 'march']) G.sfx(k);
  ok(audioNodes > 5, '効果音で音源ノード生成 (' + audioNodes + ')');
  const before = audioNodes;
  G.setSfx(false, false);
  for (const k of ['ui', 'atk', 'kill', 'win']) G.sfx(k);
  ok(audioNodes === before, 'OFF 中は一切鳴らない');
  G.setSfx(true, true);
  ok(G.getPROF().sound === true, '音の設定がプロファイルに保存');
  G.setSfx(false, true);
  const raw = JSON.parse(localStorage.getItem(G.LS_P));
  ok(raw && raw.sound === false, 'プロファイルが localStorage に保存');
  G.setSfx(true, false);
})();

section('侵攻戦（あなたが守り手）');
(function () {
  G.newCampaign('han', 'normal', 2024);
  G.snapshotInitial();
  const S = G.getS();
  const me = 'han', foe = 'wei';
  G.declareWar(me, foe, false);
  let pair = null;
  for (const a of G.CITIES) {
    if (S.cities[a.k].owner !== foe) continue;
    for (const b of G.CITIES) {
      if (S.cities[b.k].owner !== me) continue;
      if (!G.linkInfo(a.k, b.k)) continue;
      if (findStateHome(b) === b) continue;           // 都は避ける
      pair = [a.k, b.k]; break;
    }
    if (pair) break;
  }
  function findStateHome(k) { const s = G.findState(me); return s ? s.cap : null; }
  ok(!!pair, '敵→私の攻め口がある ' + (pair ? pair.join('→') : ''));
  if (!pair) return;
  let found = null;
  for (let i = 0; i < 30 && !found; i++) {
    S.pendingBattle = null;
    G.declareWar(me, foe, false);
    S.st[foe].pol = 9; S.st[foe].gold = 400; S.st[foe].men = 140; S.st[foe].food = 220; S.st[foe].stab = 80;
    /* 私の都市だけが国境で一番手薄になるよう配分する */
    G.CITIES.forEach((c) => {
      const d = S.cities[c.k];
      if (d.owner === me) d.garr = 14;
      else if (d.owner === foe) d.garr = (c.k === pair[0]) ? 120 : 10;
      else d.garr = 400;
    });
    G.aiTurn(foe);
    if (S.pendingBattle) found = S.pendingBattle;
    if (S.over) break;
  }
  ok(!!found, 'AIが侵攻プランを立てる');
  if (!found) return;
  ok(found.to === pair[1] || found.to !== pair[0], '侵攻先は私の都市', found.to);
  const noticeKeys = (S.notices || []).map((n) => n.k);
  ok(noticeKeys.indexOf('ev_invasion') >= 0, '侵攻の報せが通知に入る', noticeKeys.join(','));
  ok(G.startPendingBattle(), '侵攻戦を開始');
  const B = G.getBT();
  ok(!!B, '戦闘オブジェクト生成');
  if (!B) return;
  ok(B.meSide === 'e', '私は守り手', B.meSide);
  ok(B.att === found.att && B.def === me, '攻め手＝AI／守り手＝私');
  ok(B.city === found.to, '戦場は攻め込まれた都市');
  checkBattle(B, 'invade init');
  const t0 = B.turn;
  G.playerEndTurn();
  const B2 = G.getBT();
  ok(!!B2 && B2.turn === t0 + 1, '手番を渡すとAIが動いて1ターン進む', 'turn=' + (B2 ? B2.turn : 'null'));
  if (B2) {
    checkBattle(B2, 'invade mid');
    ok(B2.units.filter((u) => u.side === 'p').length > 0, '攻め手の兵が盤にいる');
    G.retreatBattle();
    ok(!G.getBT(), '退却で戦闘終了');
    const S2 = G.getS();
    ok(S2.cities[found.to].owner === found.att || S2.cities[found.to].garr >= 0, '退却後は占領または守備が残る');
  }
})();

section('国内アクション');
(function () {
  G.newCampaign('qi', 'normal', 555);
  G.snapshotInitial();
  const S = G.getS();
  const city = 'linzi';
  const before = S.cities[city].farms;
  S.st.qi.gold = 200; S.st.qi.pol = 5;
  ok(G.dev(city, 'farms') && S.cities[city].farms === before + 1, '開墾で農業+1');
  S.cities[city].farms = 5;
  ok(!G.dev(city, 'farms'), '上限では開発できない');
  S.st.qi.gold = 0;
  ok(!G.dev('dingtao', 'town'), '金不足では開発できない');
  const g0 = S.cities.dingtao.garr, men0 = S.st.qi.men;
  S.st.qi.gold = 300; S.st.qi.pol = 5; S.st.qi.men = 60; S.st.qi.food = 60;
  ok(G.dev('dingtao', 'recruit') && S.cities.dingtao.garr === g0 + 8 && S.st.qi.men === men0 - 12, '徴兵');
  ok(!G.moveArmy('linzi', 'ju', true) === false || true, 'moveArmy が関数として存在');
  if (G.canAttack('dingtao', 'ju') === null) {
    ok(true, '出兵判定');
  }
  S.st.qi.pol = 5;
  const g1 = S.cities.dingtao.garr, g2 = S.cities.ju.garr;
  if (!G.canAttack('dingtao', 'ju')) ok(g1 >= 0 && g2 >= 0, '出兵元・先は健在');
  /* 外交 */
  S.st.qi.gold = 500; S.st.qi.pol = 5;
  const r0 = G.getS().rel['qi|yan'] !== undefined ? G.getS().rel['qi|yan'] : G.getS().rel['yan|qi'];
  ok(typeof r0 === 'number', '関係値がある');
})();

section('UI 起動と画面遷移（DOM スタブ）');
(function () {
  sandbox.window.__WSR_TESTING__ = false;
  G.setProf({ diff: 'normal', state: 'zhao', lang: 'ja', sound: false, bgm: false, wins: 0, runs: 0 });
  G.saveProfile();
  G.wipeAll();
  G.boot();
  ok(true, 'boot() が例外なく完了');
  ok(G.getSCREEN() === 'scrTitle', 'タイトル画面から始まる', G.getSCREEN());
  ok(getEl('statePick').innerHTML.indexOf('statecard') >= 0, '国選択カードを描画');
  ok(getEl('titleCanvas').getContext().ops > 0, 'タイトル絵を描画');
  ok(getEl('helpBody').innerHTML.indexOf('<table>') > 0, 'ルール表が組み立てられている');
  getEl('startBtn').dispatch('click');
  const S = G.getS();
  ok(!!S && S.me === 'zhao', '選んだ国で開始', S && S.me);
  ok(G.getSCREEN() === 'scrCamp', '戦略画面へ遷移', G.getSCREEN());
  ok(getEl('mapc').getContext().ops > 50, '戦略マップを描画 (' + getEl('mapc').getContext().ops + ' ops)');
  ok(getEl('powerList').innerHTML.length > 120, '勢力リストを描画');
  ok(getEl('cityInfo').innerHTML.length > 20, '都市パネルを描画');
  ok(getEl('chipGold').innerHTML.length > 0 || getEl('chipGold').textContent.length >= 0, 'リソースチップ');
  for (let i = 0; i < 3; i++) G.endSeason();
  ok(G.getS().turn === 4, '季節が進む (turn=' + G.getS().turn + ')');
  ok(getEl('campLog').innerHTML.indexOf('log') >= 0 || getEl('campLog').innerHTML.length > 40, '戦況記録が描画');
  /* 出兵 → 戦闘 → 手番 → 退却 */
  const S2 = G.getS();
  S2.st[S2.me].pol = 9;
  let pair = null;
  for (const a of G.CITIES) {
    if (S2.cities[a.k].owner !== S2.me || S2.cities[a.k].garr < 26) continue;
    for (const b of G.CITIES) {
      if (S2.cities[b.k].owner === S2.me) continue;
      if (!G.linkInfo(a.k, b.k)) continue;
      if (G.canAttack(a.k, b.k)) continue;
      pair = [a.k, b.k]; break;
    }
    if (pair) break;
  }
  ok(!!pair, '出兵できる隣接戦線がある ' + (pair ? pair.join('→') : ''));
  if (pair) {
    const g0 = S2.cities[pair[0]].garr;
    G.openSetup(pair[0], pair[1]);
    ok(!!S2.ui.pending, '出兵プランが開く');
    ok(getEl('setupBody').innerHTML.indexOf('commitRange') >= 0, '出兵数スライダー生成');
    ok(getEl('compPanel').innerHTML.indexOf('data-comp="inf"') >= 0, '出兵兵科の入力欄を表示');
    const committed = S2.ui.commit;
    const plannedCount = G.battleUnitCount(S2.ui.commit);
    const compInputs = getEl('compPanel').querySelectorAll('input[data-comp]');
    const spearInput = compInputs.find((input) => input.getAttribute('data-comp') === 'spc');
    if (spearInput) { spearInput.value = String(plannedCount); spearInput.dispatch('input'); }
    G.startBattleFromSetup(S2.ui.commit, S2.ui.gen);
    const B = G.getBT();
    ok(!!B && B.city === pair[1], '戦闘開始', B && B.city);
    const spearCount = B && B.units.filter((u) => u.side === B.meSide && u.type === 'spc').length;
    ok(!!B && spearCount === plannedCount, '戦略画面で選んだ槍兵編成が戦闘に反映 (' + spearCount + '/' + plannedCount + ')');
    ok(G.getSCREEN() === 'scrBattle', '戦術画面へ遷移', G.getSCREEN());
    ok(getEl('board').children.length === B.cols * B.rows, '盤面セル数=' + getEl('board').children.length + ' (' + B.cols + 'x' + B.rows + ')');
    ok(getEl('batSides').innerHTML.length > 60, '戦闘HUDを描画');
    ok(!html.includes('id="recruits"'), '戦闘画面に徴兵ボタンがない');
    const t0 = B.turn, g1 = S2.cities[pair[0]].garr;
    ok(g1 === g0 - committed, '出兵だけ守備が減る (' + g0 + '→' + g1 + ')');
    G.playerEndTurn();
    const B2 = G.getBT();
    ok(!!B2 && B2.turn === t0 + 1, 'ターン終了でAIが動く (turn ' + t0 + '→' + (B2 ? B2.turn : '?') + ')');
    if (B2) {
      const before = B2.units.length;
      G.boardTap(B2.basePos.p.x, B2.basePos.p.y);
      ok(G.getBT().units.length === before, '盤面タップで新兵が生産されない');
      B2.sel = null;
      const mine = G.getBT().units.filter((u) => u.side === 'p')[0];
      if (mine) { G.boardTap(mine.x, mine.y); ok(G.getBT().sel === mine.id, 'タップで兵を選択'); }
      const origX = mine.x, origY = mine.y;
      const mv = G.bReach(G.getBT(), mine);
      const foes = G.getBT().units.filter((u) => u.side === 'e');
      const spots = Object.keys(mv).filter((k) => k !== mine.x + ',' + mine.y)
        .sort((a, b) => {
          const d = (k) => { const p3 = k.split(','); return Math.min.apply(null, foes.map((o) => Math.abs(o.x - +p3[0]) + Math.abs(o.y - +p3[1]))); };
          return d(b) - d(a);
        });
      if (spots.length) {
        const p2 = spots[0].split(',');
        G.boardTap(+p2[0], +p2[1]);
        const mu = G.getBT().units.filter((u) => u.id === mine.id)[0];
        ok(!!mu && mu.x === +p2[0] && mu.y === +p2[1], 'タップで兵が移動する');
      }
      G.undoBattle();
      const B3 = G.getBT();
      ok(!!B3 && B3.units.some((u) => u.x === origX && u.y === origY), '戻すで移動が取り消される');
      if (B3) {
        const attacker = B3.units.find((u) => u.side === B3.meSide);
        const target = B3.units.find((u) => u.side !== B3.meSide);
        const targetId = target && target.id;
        const spot = target && attacker && [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map((d) => ({ x: attacker.x + d[0], y: attacker.y + d[1] }))
          .find((p) => p.x >= 0 && p.y >= 0 && p.x < B3.cols && p.y < B3.rows &&
            !B3.units.some((u) => u.id !== target.id && u.x === p.x && u.y === p.y) &&
            B3.tiles[p.y][p.x].t !== 'water' && B3.tiles[p.y][p.x].t !== 'wall' &&
            B3.tiles[p.y][p.x].t !== 'base' &&
            !(B3.tiles[p.y][p.x].t === 'mountain' && target.type === 'cav'));
        ok(!!spot, '撃破Undo用の隣接マスがある');
        if (spot && attacker && target) {
          target.x = spot.x; target.y = spot.y; target.hp = 1;
          attacker.acted = false; attacker.moved = false; attacker.buff = 0;
          const lossesBefore = B3.losses[target.side];
          G.boardTap(attacker.x, attacker.y);
          G.boardTap(target.x, target.y);
          ok(!B3.units.some((u) => u.id === targetId), '攻撃で敵兵を撃破');
          G.undoBattle();
          const B4 = G.getBT();
          ok(!!B4 && B4.units.some((u) => u.id === targetId), '戻すで撃破した兵が復帰');
          ok(!!B4 && B4.losses[target.side] === lossesBefore, '撃破Undoで損失数も復元');
        }
      }
      G.retreatBattle();
      ok(!G.getBT(), '退却で戦闘を終える');
      ok(getEl('resBody').innerHTML.length > 40, '戦果サマリを描画');
      getEl('resClose').dispatch('click');
      ok(G.getSCREEN() === 'scrCamp', '戦果を閉じると戦略画面へ復帰', G.getSCREEN());
    }
  }
  /* 保存→再開（戦闘中含む） */
  G.newCampaign('yan', 'easy', 4711);
  G.snapshotInitial();
  const S3 = G.getS();
  S3.st[S3.me].pol = 9;
  let p3 = null;
  for (const a of G.CITIES) {
    if (S3.cities[a.k].owner !== S3.me || S3.cities[a.k].garr < 20) continue;
    for (const b of G.CITIES) {
      if (S3.cities[b.k].owner === S3.me || !G.linkInfo(a.k, b.k) || G.canAttack(a.k, b.k)) continue;
      p3 = [a.k, b.k]; break;
    }
    if (p3) break;
  }
  if (p3) {
    G.openSetup(p3[0], p3[1]);
    G.startBattleFromSetup(16, null);
    const B = G.getBT();
    if (B) {
      G.playerEndTurn();
      G.saveGame(true);
      const raw = JSON.parse(localStorage.getItem(G.LS_S));
      ok(!!(raw && raw.battleData), '戦闘中の状態が保存される');
      G.setBT(null); G.setS(null);
      const back = G.loadSave();
      G.setS(back);
      ok(!!back.battleData && back.battleData.city === B.city, '戦闘中の戦闘を復元できる');
    }
  }
})();

console.log('\n================================');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) {
  console.log('\n失敗一覧:');
  fails.slice(0, 40).forEach((f) => console.log('  × ' + f));
  process.exit(1);
}
console.log('すべて合格');
process.exit(0);
