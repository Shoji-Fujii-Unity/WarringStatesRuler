/* battle balance probe (ASCII only) */
'use strict';
const path = require('path');
const fs = require('fs');
const harness = fs.readFileSync(path.join(__dirname, 'headless-test.js'), 'utf8');
const cut = harness.indexOf("const langs = ['ja', 'en', 'zh'];");
if (cut < 0) throw new Error('marker not found');
const bootstrap = harness.slice(harness.indexOf("'use strict';"), cut);
const mod = { exports: {} };
new Function('module', 'require', '__dirname', 'process', bootstrap)(mod, require, path.join(__dirname), process);
const G = mod.exports;

function probe(commit, defGarr, walls, n, attGen) {
  let att = 0, turns = 0, al = 0, dl = 0, stale = 0;
  const reasons = {};
  for (let i = 0; i < n; i++) {
    G.newCampaign('wei', 'normal', 1000 + i * 7919);
    G.snapshotInitial();
    const S = G.getS();
    const from = 'suanzao', to = 'xinzheng';
    S.cities[from].owner = 'wei'; S.cities[to].owner = 'han';
    S.cities[to].walls = walls;
    S.cities[to].garr = defGarr;
    S.cities[from].garr = Math.max(commit, 8);
    let genKey = null;
    if (attGen) {
      const cand = G.GENERALS.filter((g) => g.wander !== 1)[0];
      genKey = cand.k;
      S.gen[genKey].side = 'wei'; S.gen[genKey].city = from; S.gen[genKey].dead = false;
    } else {
      // 両軍とも将を置かない比較
      G.STATES.forEach((s) => G.gensOf(s.k).forEach((g) => { S.gen[g.k].city = null; }));
    }
    G.declareWar('wei', 'han', false);
    const B = G.makeBattle(from, to, commit, genKey, true);
    G.simBattle(B);
    if (B.over && B.over.winner === 'att') att++;
    if (B.over && B.over.reason === 'stale') stale++;
    if (B.over) reasons[B.over.reason] = (reasons[B.over.reason] || 0) + 1;
    turns += B.turn; al += B.losses.p; dl += B.losses.e;
  }
  const ratio = (commit / (defGarr + walls * 3)).toFixed(2);
  console.log('commit=' + commit + ' def=' + defGarr + ' walls=' + walls + ' ratio=' + ratio +
    (attGen ? ' [att gen]' : ' [no gen]') +
    ' -> attwin ' + String(Math.round(att / n * 100)).padStart(3) + '%' +
    '  turn ' + (turns / n).toFixed(1) + '  stale ' + stale +
    '  loss p' + Math.round(al / n) + '/e' + Math.round(dl / n) +
    '  why ' + JSON.stringify(reasons));
}
console.log('--- curve vs def30/walls3 (eff 39), 攻め手に将あり ---');
probe(20, 30, 3, 50, true);
probe(30, 30, 3, 50, true);
probe(40, 30, 3, 50, true);
probe(55, 30, 3, 50, true);
probe(70, 30, 3, 50, true);
probe(90, 30, 3, 50, true);
console.log('--- 同条件・両軍将なし ---');
probe(40, 30, 3, 50);
probe(70, 30, 3, 50);
console.log('--- walls effect (commit 70, att gen) ---');
probe(70, 30, 1, 50, true);
probe(70, 30, 2, 50, true);
probe(70, 30, 5, 50, true);
console.log('--- strong defence (att gen) ---');
probe(90, 60, 3, 50, true);
probe(130, 60, 3, 50, true);
process.exit(0);
