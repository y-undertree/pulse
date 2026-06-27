# Pulse

Pulse は、複数の AI coding agent と協調するための個人開発者向け shared state CLI です。

人間が毎回 chat history を開かなくても、SQLite に保存された Goal / Task / Status / Context / Claim / Heartbeat / Worktree / Branch を見れば、今どの agent が何をしているかを把握できる状態を目指します。

## 判断: TypeScript で進める

この repo は TypeScript で進めます。

理由:

- ユーザーの学習優先度が TypeScript にある
- CLI、状態モデル、SQLite adapter、test harness が TypeScript 学習に向いている
- Node 25 の `node:sqlite` により、外部 SQLite driver なしで MVP を作れる
- `npm run verify` に型検査、100% coverage gate、build を集約でき、複利的に育つ harness にしやすい

トレードオフ:

- `node:sqlite` は Node 25 で使えるが、Node 側では experimental warning の対象
- Python は SQLite が標準で安定しており、配布容易性だけを見ると今も強い
- Node 25 未満の環境へ広げる場合は、`better-sqlite3` などの driver 導入か、Python 実装への回帰を再判断する

現時点では「TypeScript を先に学ぶ」目的を優先し、Node 25 前提の TypeScript MVP とします。

## Requirements

- Node.js `>=25.0.0`
- npm

## Install

```bash
npm install
```

## Verify

```bash
npm run verify
```

`verify` は以下を実行します。

- `npm run typecheck`
- `npm run coverage`
- `npm run build`

coverage は Node.js 標準 test runner の coverage gate を使い、`src/bin.ts` を除く TypeScript source に対して line / function / branch すべて 100% を要求します。`src/bin.ts` は process exit と標準入出力を接続するだけの薄い executable wrapper です。

## Usage

開発中は `npm run dev -- ...` で CLI を実行できます。

```bash
npm run dev -- --db /tmp/pulse.db init
npm run dev -- --db /tmp/pulse.db add "Implement SQLite schema" --goal "MVP" --repo pulse --branch main
npm run dev -- --db /tmp/pulse.db list
npm run dev -- --db /tmp/pulse.db claim 1 --agent codex
npm run dev -- --db /tmp/pulse.db beat 1 --agent codex --note "schema is in place"
npm run dev -- --db /tmp/pulse.db block 1 --reason "waiting for product decision"
npm run dev -- --db /tmp/pulse.db review 1 --note "ready for human review"
npm run dev -- --db /tmp/pulse.db release 1
npm run dev -- --db /tmp/pulse.db done 1 --note "merged"
npm run dev -- --db /tmp/pulse.db export
```

build 後は以下でも実行できます。

```bash
npm run build
node --disable-warning=ExperimentalWarning build/src/bin.js --db /tmp/pulse.db list
```

## Database Location

Pulse は database path を次の順で解決します。

1. `--db /path/to/pulse.db`
2. `PULSE_DB=/path/to/pulse.db`
3. `~/.pulse/pulse.db`

default を repo 外に置くことで、複数 repo / worktree から同じ local state を共有しやすくしています。runtime database は Git 管理しません。

## Commands

### `pulse init`

SQLite database と schema を作成します。

### `pulse add`

task を追加します。goal、context、agent、repo、worktree、branch を任意で記録できます。

```bash
npm run dev -- add "Fix failing tests" --goal "Release" --context "CI fails on sqlite migration"
```

### `pulse list`

task を一覧します。status / agent で絞り込めます。

```bash
npm run dev -- list --status blocked
npm run dev -- list --agent codex
npm run dev -- list --format json
```

### `pulse claim` / `pulse release`

task の担当 agent を設定、解除します。

```bash
npm run dev -- claim 1 --agent codex
npm run dev -- release 1
```

### `pulse block` / `pulse review` / `pulse done`

task を blocked、review 待ち、done にします。

```bash
npm run dev -- block 1 --reason "needs API decision"
npm run dev -- review 1 --note "ready for human review"
npm run dev -- done 1 --note "tests passed"
```

### `pulse beat`

task heartbeat を更新します。agent がまだ動いていることを人間が確認するための signal です。

```bash
npm run dev -- beat 1 --agent codex --note "working through review comments"
```

### `pulse export`

現在の状態を Markdown で出力します。

```bash
npm run dev -- export > pulse-state.md
```

## Status Model

MVP の status は意図的に小さく保ちます。

- `todo`: まだ claim されていない
- `claimed`: agent が担当している
- `blocked`: 判断待ち、外部入力待ち
- `review`: 人間の review 待ち
- `done`: 完了

各 command は `events` にも行を追加するため、chat history を開かなくても状態変化を追えます。
