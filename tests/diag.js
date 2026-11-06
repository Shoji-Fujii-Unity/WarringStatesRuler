/* 診断: AIがどこまで領土を動かすか／侵攻プランが出るか */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const harness = fs.readFileSync(path.join(__dirname, 'headless-test.js'), 'utf8');
// 簡易ローダ: headless-test のスタブ部分だけを再利用するため、G 取得までを eval する
const cut = harness.indexOf("/* =================================================================== */\nsection('多言語')");
const bootstrap = harness.slice(harness.indexOf("'use strict';"), cut);
const mod = { exports: {} };
const f = new Function('module', 'require', '__dirname', 'process', bootstrap);
f(mod, require, path.join(__dirname), process);
const G = mod.exports;

function tally() {
  const S = G.getS();
  const out = {};
  G.CITIES.forEach((c) => { const o = S.cities[c.k].owner; out[o] = (out[o] || 0) + 1; });
  return out;
}
function resolvePending() {
  const S0 = G.getS();
  if (!S0 || !S0.pendingBattle) return false;
  G.startPendingBattle();
  const B = G.getBT();
  if (B) { G.simBattle(B); G.finishBattleUI(); }
  G.setBT(null);
  return true;
}
/* --- A: プレイヤー放置で AI だけが動く --- */
for (const diff of ['easy', 'normal', 'hard']) {
  G.setProf({ diff, state: 'han', lang: 'ja', sound: false, bgm: false });
  G.newCampaign('han', diff, 4242);
  G.snapshotInitial();
  const marks = [];
  let over = null;
  for (let i = 0; i < 160; i++) {
    G.endSeason();
    for (let w = 0; w < 4 && resolvePending(); w++) { /* 侵攻戦は自動解決 */ }
    const S = G.getS();
    if (i % 20 === 19) marks.push((i + 1) + ':' + JSON.stringify(tally()));
    if (S.over) { over = { season: i + 1, win: S.over.win, reason: S.over.reason }; break; }
  }
  console.log('[A] diff=' + diff, 'end=' + JSON.stringify(over));
  console.log('    ', marks.join('  '));
}
/* --- B: 侵攻プラン --- */
(function () {
  G.newCampaign('han', 'normal', 2024);
  G.snapshotInitial();
  const S = G.getS();
  const foe = 'wei';
  G.declareWar('han', foe, false);
  const pairs = [];
  G.CITIES.forEach((a) => {
    if (S.cities[a.k].owner !== foe) return;
    G.CITIES.forEach((b) => {
      if (S.cities[b.k].owner !== 'han') return;
      if (!G.linkInfo(a.k, b.k)) return;
      pairs.push(a.k + '->' + b.k);
    });
  });
  console.log('[B] 攻め口:', pairs.join(' '));
  for (let i = 0; i < 12; i++) {
    S.pendingBattle = null;
    G.declareWar('han', foe, false);
    S.st[foe].pol = 9; S.st[foe].gold = 400; S.st[foe].men = 150; S.st[foe].food = 240; S.st[foe].stab = 80;
    // 私の都市だけが付近で最も手薄になるよう布く
    G.CITIES.forEach((c) => {
      const d = S.cities[c.k], own = d.owner;
      if (own === 'han') d.garr = 14;
      else if (own === foe) d.garr = (c.k === pairs[0].split('->')[0]) ? 120 : 10;
      else d.garr = 400;
    });
    G.aiTurn(foe);
    console.log('   try' + i, 'pending=' + JSON.stringify(S.pendingBattle),
      'hanCities=' + G.citiesOf('han').length, 'battles=' + G.getS().log.filter((l) => l.k === 'log_ai_battle').length);
    if (S.pendingBattle) break;
  }
})();
process.exit(0);
