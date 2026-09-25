# 簿記2級 学習アプリ 設計書

作成日: 2026-09-25
対象: 日商簿記2級 学習管理システム（Excel + Anki 運用）のアプリ化
利用者: 学習者本人1名。開発・保守は会社PC、利用は個人PC・個人スマホ。

## 1. 目的と方針

- 2027-03-06 のネット試験合格（70点以上）に向け、学習・復習・演習・記録を1つのアプリで完結させる。
- Excel「単語帳」「日次記録」「問題マスター/記録」「ロードマップ」「設定」「ダッシュボード」の機能を移行する。
- Anki はアプリの間隔反復機能で置き換える。忘却曲線に基づく SM-2 の思想は踏襲し、ボタン文言のみ平易化する。
- サーバ無し。データは端末内 IndexedDB。端末間は JSON エクスポート/インポートで手動同期。
- 無料の範囲のみ。GitHub Pages で公開。会社PCに Node.js は無く、ビルド無しで動く構成にする。
- 外部ライブラリ・CDN依存無し（オフライン保証）。

## 2. 決定事項（ブレインストーミング結果）

| 論点 | 決定 |
|---|---|
| 同期 | 手動 JSON エクスポート/インポート |
| 配布 | GitHub Pages（個人アカウント） |
| Anki | アプリが置き換える |
| 評価ボタン文言 | できなかった／迷ったが正解／できた／即答できた |
| 技術 | 素の HTML/JS（ES modules）、IndexedDB、PWA |
| テスト | ブラウザで開く自作テストページ（Node 不要） |
| ローカル確認 | `python -m http.server` |
| Excel 変換 | Python + openpyxl（会社PCで実行済み確認あり） |

## 3. 機能範囲

### v1
1. カード復習（間隔反復、4ボタン、期限カード優先出題、セッション末尾の再出題）
2. カード登録・編集（表面/裏面/具体例/間違えやすい点/分野/論点/優先度/種類）
3. 問題演習
   - 仕訳入力モード（借方・貸方の科目プルダウン＋金額、自動採点）
   - 勘定科目判断クイズ（取引文→科目選択）
   - 問題セット（計算・選択・記述。記述は自己採点 正解/不正解/要確認）
   - タイマー自動計測、標準時間超過を記録
4. 日次記録（セッション終了時に自動1行生成。手入力も可）
5. ホーム（ダッシュボード）
6. 設定（開始日・受験日・週時間・合格/安全圏点）
7. JSON エクスポート/インポート
8. 初期データ投入（Excel から: 単語帳20枚、ロードマップ24週、日次記録2件、設定、勘定科目約60）

### v2 以降（本設計の対象外）
- 弱点ヒートマップ（論点×優先度）
- 間違い原因の集計推移
- 工業簿記 計算ドリル
- 模試記録、最新3回平均75点判定
- 週次レビュー自動集計・次週計画
- Excel 書き出し

### 入れないもの
- 精算表・連結など総合問題の自動採点（紙＋自己採点＋結果記録で代替）

## 4. ファイル構成

```
boki-app/
  index.html              シェル（1ページ、ハッシュルーティング #/review 等）
  manifest.json           PWA
  sw.js                   Service Worker（静的ファイルキャッシュ）
  css/app.css
  js/
    app.js                起動・ルーティング・タブ
    db.js                 IndexedDB ラッパ（ストア定義・CRUD・export/import）
    srs.js                間隔反復（純関数）
    scoring.js            採点・正答率（純関数）
    seed.js               初回起動時の初期データ投入
    views/
      dashboard.js review.js cards.js journal.js quiz.js dailylog.js settings.js
  data/seed.json          Excel から変換した初期データ
  tools/excel_to_seed.py  Excel → seed.json 変換
  test/index.html         ブラウザ用テストランナー
  test/*.test.js
```

原則:
- `srs.js` `scoring.js` は DOM・DB 非依存の純関数。ここを重点テスト。
- views は描画と「操作→db 呼び出し」のみ。1画面1ファイル、300行超で分割。

## 5. データモデル（IndexedDB ストア）

ID は Excel と同形式で互換維持。

- **settings**（1件）: `startDate, examDate, weekdayMin=90, weekendMin=120, passScore=70, safeScore=75`
- **roadmap**（24件）: `id(RM-01), week, phase, field, topic, priority, planMin, planQ, targetRate, commuteTask, nightTask, weekendTask, minLine, stdLine, extraLine, doneCond`
- **cards**: `id(FC-W01-0001), createdAt, field, topic, priority(A/B/C), type, front, back, example, pitfall, tags, status(新規/学習中/定着/停止)` ＋ SRS 状態 `due, interval(日), ease(初期2.5), reps, streak, lastResult, lastReviewed`
- **reviewLogs**: `id, cardId, at, rating(1-4), prevInterval, newInterval, elapsedSec`
- **questions**: `id(Q-…), setId, field, topic, priority, difficulty, format(仕訳/科目判断/計算/選択/記述), text, choices[], answer, explain, stdSec, tags`
  - 仕訳: `answer = {debit:[{acct,amt}], credit:[{acct,amt}]}`
  - 科目判断: `answer = "売掛金"`, `choices = [候補]`
- **answerLogs**: `id(AL-…), questionId, at, week, myAnswer, correct(true/false/"要確認"), score, maxScore, sec, stdSec, overSec, cause, needReview, nextReview`
- **dailyLogs**: `id(DL-YYYYMMDD-区分NN), date, week, sessionType, field, topic, priority, content, planMin, actualMin, q, correct, wrong, blank, rate, understand, focus, confidence, cause, comment`
- **accounts**: `name, category(資産/負債/純資産/収益/費用), level(3級/2級商/2級工)`

間違い原因の選択肢: 知識不足／科目判断ミス／読み違い／計算ミス／桁ミス／時間切れ／回答範囲不足

Week 算出: `floor((日付 − startDate) / 7) + 1`（settings から。Excel と同じ）

## 6. 間隔反復（srs.js）

初期: `interval=0, ease=2.5, streak=0, reps=0`

| rating | 文言 | interval | ease | streak |
|---|---|---|---|---|
| 1 | できなかった | 0（同セッション末尾に再出題、due=今日） | −0.20（下限1.3） | 0 |
| 2 | 迷ったが正解 | ×1.2（最低1日） | −0.15 | +1 |
| 3 | できた | reps=0:1日 → 次3日 → 以降 ×ease | 変化無し | +1 |
| 4 | 即答できた | 新規:4日、以降 ×ease×1.3 | +0.15 | +1 |

- interval は日単位整数、上限180日。`due = 今日 + interval`。
- 期限カード = `due <= 今日`。出題順: 優先度 A→B→C、次に due 古い順。
- rating=1 のカードはセッション末尾に再出題し、rating≥3 で当日完了。
- 状態: 新規(reps=0) → 学習中(interval<21) → 定着(interval≥21)。停止は手動。
- 復習画面のボタン下に常時表示: 「一部しか答えられなかったら『できなかった』」

既存20枚の初期化: 9/24 の正解5枚が Excel から特定できれば `interval=1, reps=2, due=9/25`、不正解15枚は `interval=0, due=今日`。特定できなければ全20枚 `due=今日` で開始（実装時に Excel を確認して決める）。

## 7. 採点（scoring.js）

- 仕訳: 借方・貸方それぞれの `{科目,金額}` 集合が完全一致で正解。部分点無し。フィードバック種別: 正解／科目ミス／金額ミス／貸借不一致。
- 科目判断・選択: 完全一致。
- 計算: 数値一致（カンマ・全角数字・空白を正規化後）。
- 記述・総合: 自己採点 3択（正解／不正解／要確認）。
- 正答率 = 正解 ÷ (正解 + 不正解)。未回答・要確認は分母から除外。分母0は「データ不足」表示（0%にしない）。
- タイマー: 問題表示で開始、回答確定で停止。`overSec = max(0, sec − stdSec)`。

## 8. 日次記録の自動生成

セッション終了時に dailyLogs へ1行。
- `sessionType`: 単語帳／問題演習
- `q` = ユニーク数、`correct` = 最終 rating≥3（演習は correct=true）の数、`wrong` = それ以外、`actualMin` = 経過分（四捨五入）
- `id` = `DL-YYYYMMDD-` + 区分コード（ANKI/QUIZ/NIGHT等）+ 同日同区分の既存件数+1 を2桁
- 手入力行も同形式。空白と0を区別（未入力は null）。

## 9. 画面

下部タブ5つ。スマホ優先（幅360px想定）、PC も同一 UI。ボタン高さ48px以上。

| タブ | 内容 |
|---|---|
| ホーム | 現在Week、受験まで日数、今日の期限カード数、今週の実績/予定時間、直近正答率、今週のロードマップ課題、「復習開始」「演習開始」 |
| 復習 | カード表面→タップで裏面→4ボタン。進捗「3/12」。終了で結果サマリ＋日次記録自動保存 |
| 演習 | モード選択（仕訳入力／科目判断／問題セット）。仕訳は借方・貸方各2行、科目プルダウン＋金額。即時採点＋解説。間違い原因を1タップ選択 |
| 記録 | 日次記録一覧（週別折りたたみ）、手動追加、Week別の時間・正答率の簡易表 |
| 管理 | カード一覧・追加・編集／問題一覧・追加／設定／エクスポート・インポート／ロードマップ閲覧 |

PWA: manifest でスタンドアロン表示、sw.js で静的ファイルをキャッシュしオフライン動作。

## 10. エラー処理

- IndexedDB 不可（プライベートモード等）: 利用不可を明示。localStorage への縮退はしない。
- インポート: `version` 不一致・必須ストア欠落は拒否し理由表示。実行前に現データを自動エクスポート（ダウンロード）。モードは「上書き」「マージ（同IDは更新日時が新しい方優先）」。
- 仕訳入力: 金額空欄・科目未選択は採点せず入力を促す。
- 保存失敗: トースト表示、入力内容は画面に保持。

## 11. エクスポート/インポート形式

```json
{ "version": 1, "exportedAt": "ISO8601", "stores": { "settings": [...], "cards": [...], ... } }
```
全ストアを1ファイル。ファイル名 `boki-backup-YYYYMMDD-HHMM.json`。

## 12. テスト

- `test/index.html` をブラウザで開く。自作ミニランナー（assert、緑/赤表示、失敗件数）。
- 対象: srs.js 全 rating 遷移・上下限・状態遷移、scoring.js 仕訳一致/科目ミス/金額ミス/貸借不一致、計算の正規化、正答率の除外ルール、DailyLogID 連番、export→import 往復一致、Week 算出。
- 画面は手動確認。スマホ実機は Pages 公開後に確認。

## 13. 公開・運用手順

1. GitHub 個人アカウントでリポジトリ作成（名称は実装時に確認）
2. 会社PCで clone → 開発 → `python -m http.server` で確認 → push
3. Settings → Pages → `main` ブランチ `/boki-app` を公開
4. スマホで URL を開き「ホーム画面に追加」
5. 端末間同期: 使い終わった端末でエクスポート → もう一方でインポート

Excel → seed: `tools/excel_to_seed.py` が単語帳・ロードマップ・日次記録・設定を `data/seed.json` へ。初回起動時のみ投入。以降アプリが正本、Excel は更新停止。

## 14. 制約・注意

- 会社PCに新規ソフトを入れる場合は事前にユーザー確認。
- 個人情報・勤務先情報を保存しない。問題文は架空企業名・架空金額。
- 同一記録の二重取込を避ける（ID 重複チェック）。
