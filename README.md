# 戦国王 — Warring States Ruler

戦国（春秋戦国時代）を舞台にした、**単一 HTML の歴史シミュレーションゲーム**です。
「国を運営する戦略」と「 battlefield で兵を動かす戦術」をはっきり分けて設計しています。
戦術レイヤーは同フォルダの参考作 *Two Crowns* のターン制タクティクス構造を踏襲しています。

* 追加インストール・外部 JS ライブラリなし。`index.html` をブラウザで開くだけで遊べます。
* 画面は**横長（ landscape ）固定**。スマホは横にしてタッチで操作します。
* 日本語 / English / 中文 対応（タイトル画面で切替、ゲーム中のログも再翻訳されます）。
* セーブはブラウザの localStorage（同一フォルダを何度開いても続きから遊べます）。
* サウンドは WebAudio で合成（外部音声ファイルなし）。On/Off を切り替えられます。
* ビジュアルはすべて**ドット絵**（兵のスプライトは 12×12 の ASCII アートを SVG 化して描画、map は 16px タイルの手続き生成）。

---

## 1. 遊び方

1. `index.html` を開き、**言語 → 難易度 → 国**を選んで「はじめる」。
2. 1 季節（春→夏→秋→冬、4 季節で 1 年）ごとに**内政・外交・移動**を行い、「季節を終える」で世界が動きます。
3. 都市をタップ／クリック → 右のパネルで行動を選択。**軍編成**で兵科の比率を金20・政令1で整え、隣接する敵都市への出兵時は兵数と随伴武将を選びます。兵科は編成済みの比率が自動適用されます。
4. 出兵すると**戦術レイヤー**（グリッド戦闘）へ切り替わります。
5. 敵国をすべて滅ぼす、または 25 都市すべてを占領すると**統一達成で勝利**。自分の都市がすべて失われると敗北。

キーボード（任意）: `N` 季節を終える ／ `Space` ターン終了 ／ `U` 一手戻る ／ `S` 手動セーブ ／ `Esc` 選択解除。

## 2. 戦略レイヤー（国政・外交）

* **都市**：25 都市を 40 本の街道が結びます。都市は 人口 / 交易 / 田畑 / 城壁 / 守備兵 / 動揺 を持ちます。
* **資源**：金・兵糧・人員・為政（政略点＝行動回数）・治安（stab）・声望（fame）。
* **内政**：田畑 / 市街 / 城壁 / 練兵 / 徴兵 / 撫勒（都市開発）。開発費は金と為政を消費します。
* **軍の移動**：都市から隣接都市へ兵を移動・分割。各都市の行動から国全体の兵科編成を金20・政令1で変更し、出兵時は守備兵数に応じてその比率が自動適用されます。
* **外交**：使者（関係改善）・同盟・休戦・宣戦。AI も独自の関係値と国力差で宣戦・講和して動きます。
* **将**：27 名の武将。自国・他国から登用でき、登用した将は戦闘で部隊を強くし「戦法」を使えます。客将（放蕩中の人物）は訪れて登用を待っています。
* **事件**：豊作、凶作、一揆、謀殺、客将の来訪など。季節ごとに発生して記録に残ります。

AI があなたの都市を狙う場合、**自動解決されず戦術レイヤーに招かれます**（守り手として防衛戦）。
その場合、盤面は上下反転して描画され、あなたの本営が下側に配置されます。

## 3. 戦術レイヤー（戦闘）

* **盤面**：野戦 13×9、攻城戦 15×11。攻城側は門と城壁を越えて本営を攻めます。
* **勝利条件**：相手本営の HP を 0 にする（`camp`）／相手の士気を 0 にする（`rout`）／相手の部隊を全滅させる（`elim`）。攻め手は **26 ターン**以内に決着がつかなければ敗退（`stale`）。退却も可能です。
* **兵科**：步兵 inf ／ 弓兵 arc ／ 騎兵 cav ／ 槍兵 spc。
  相克は **騎兵 > 歩兵 > 弓兵 > 槍兵 > 騎兵**（有利 1.25〜1.6 倍、不利 0.5〜0.85 倍）。騎兵は山を超えられません。
* **地形**：平野・森・山・河（通行不可）・村落・城壁（通行不可）・門・本営。移動コストと防御補正が変わり、村落は部隊の回復拠点になります。
* **行動**：1 兵につき 1 ターンに「移動 + 攻撃」まで。隣接反撃あり（反撃は減衰）。攻撃側は踏み込み時に与ダメージ上乗せがあります。
* **兵科編成**：戦略レイヤーで歩兵・弓兵・騎兵・槍兵の10部隊分の比率を整えます。編成は国全体に適用され、攻守の戦闘に使われます。戦闘中は新兵を生産できません。
* **戦法**：火計 / 突騎 / 死守（守城）/ 奇襲。為政点に相当する「戦法ゲージ」（最大 3）を消費します。
* **長期化**：ターンが経つと攻城補正と与ダメージ補正が上昇（最大 3.2 倍）し、決着が加速します。
* **操作**：兵をタップ → 移動先／攻撃対象をタップ。`戻す`（Undo）、`退却`、`ターン終了`。

## 4. データとファイル

| 項目 | 内容 |
| --- | --- |
| 主要ファイル | `index.html`（HTML + CSS + JS すべて内蔵、約 190 KB） |
| セーブキー | `wsr_save_v1`（進行） / `wsr_profile_v1`（言語・難易度・サウンド設定） |
| 戦闘中セーブ | 戦闘状態も保存され、戦闘中にページを閉じても同じ戦闘から再開できます |
| テスト | `node tests/headless-test.js 9`（DOM スタブで 500 超の検証。多言語整合性・戦略 AI・戦闘不変条件・UI 遷移） |
| 補助ツール | `node tests/sprites.js`（ドット絵の格子検証と PNG コンタクトシート生成） / `diag.js`（世界情勢の診断） / `balance.js`（戦闘バランス探索） |

## 5. 動作の注意

* Google Fonts の「DotGothic16」だけを CDN から読みます。オフラインではフォールバックの等幅フォントで表示され、ゲーム性は変わりません。
* サウンドは最初のタップ／クリック後に再生されます（ブラウザの自動再生ポリシー）。
* localStorage を使うため、ブラウザのサイトデータ消去でセーブも消えます。

---

## English (summary)

A single-file strategy game set in the Warring States period. **Statecraft** (season turns: economy, development, diplomacy, army organization, generals) is deliberately separated from **tactics** (grid battles on a 13×9 field or 15×11 siege board, four unit types with a rock-paper-scissors cycle, terrain cover, state-wide army ratios reorganized for gold and decrees, four stratagems, camp HP / morale / elimination as win conditions). No troops can be recruited during battle.
When the AI targets one of your cities you are not auto-resolved: you fight the defence yourself on the tactical board (the board is rotated so your camp sits at the bottom).
Landscape layout for phones, tap-friendly, Japanese / English / Chinese, local-storage saves, synthesised WebAudio sound with on/off switches, and all art is hand-made pixel art. Run `node tests/headless-test.js 9` for the full headless test suite.

## 中文（简介）

单个 HTML 文件的战国题材策略游戏。**国政**（季节回合：经济、城建、外交、军队整编、武将）与**战术**（13×9 野战 / 15×11 攻城网格，四兵种相克「骑 > 步 > 弓 > 枪 > 骑」、地形掩体、消耗金钱和政令调整全国兵种比例、四种战法；胜利条件是摧毁本营、击溃士气或全灭敌军）明确分开。战斗中不能生产新兵。
AI 进攻你的城市时不会自动结算，而是在战术层由你防守（棋盘旋转，本营在下方）。
横向画面适配手机触控，支持日 / 英 / 中三语，存档保存在浏览器本地，音效与 BGM 由 WebAudio 合成并可开关，全部美术为手绘像素图。运行 `node tests/headless-test.js 9` 可执行完整的无头测试。
