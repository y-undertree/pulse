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

## Local Command Setup

`pulse add` や `pulse release` のように通常の command として実行する場合は、build して local link を作成します。

```bash
npm run link:local
```

これにより、この package の `bin.pulse` が global npm prefix に link され、同梱の Codex skill も `${CODEX_HOME:-~/.codex}/skills/pulse-shared-state` に install されます。CLI link を解除する場合は以下を実行します。

```bash
npm unlink -g pulse-shared-state
```

Codex skill は上記では削除されません。不要になった場合は `${CODEX_HOME:-~/.codex}/skills/pulse-shared-state` を削除してください。

skill だけを install する場合は以下を実行します。

```bash
npm run install:skill
```

install 先を明示する場合は `--skills-dir` を指定します。

```bash
npm run install:skill -- --skills-dir /path/to/codex/skills
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

local link 後は `pulse ...` で実行できます。

```bash
pulse --db /tmp/pulse.db init
pulse --db /tmp/pulse.db add "Implement SQLite schema" --goal "MVP" --repo pulse --branch main
pulse --db /tmp/pulse.db list
pulse --db /tmp/pulse.db status
pulse --db /tmp/pulse.db summary
pulse --db /tmp/pulse.db claim 1 --agent codex
pulse --db /tmp/pulse.db beat 1 --agent codex --note "schema is in place"
pulse --db /tmp/pulse.db block 1 --reason "waiting for product decision"
pulse --db /tmp/pulse.db review 1 --note "ready for human review"
pulse --db /tmp/pulse.db release 1
pulse --db /tmp/pulse.db done 1 --note "merged"
pulse --db /tmp/pulse.db export
```

link せずに build artifact を直接実行する場合は以下でも動きます。

```bash
npm run build
./build/src/bin.js --db /tmp/pulse.db list
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
pulse add "Fix failing tests" --goal "Release" --context "CI fails on sqlite migration"
```

### `pulse list`

task を一覧します。status / agent で絞り込めます。

```bash
pulse list --status blocked
pulse list --agent codex
pulse list --format json
```

### `pulse status`

現在の状態を観測用に表示します。status count、attention 対象、active task、backlog、done を分けて表示します。

```bash
pulse status
```

### `pulse summary`

現在の状態を短く共有するための要約を表示します。blocked / review の attention、active agent、次の todo を一目で確認できます。

```bash
pulse summary
```

### `pulse claim` / `pulse release`

task の担当 agent を設定、解除します。

```bash
pulse claim 1 --agent codex
pulse release 1
```

### `pulse block` / `pulse review` / `pulse done`

task を blocked、review 待ち、done にします。

```bash
pulse block 1 --reason "needs API decision"
pulse review 1 --note "ready for human review"
pulse done 1 --note "tests passed"
```

### `pulse beat`

task heartbeat を更新します。agent がまだ動いていることを人間が確認するための signal です。

```bash
pulse beat 1 --agent codex --note "working through review comments"
```

### `pulse export`

現在の状態を Markdown で出力します。

```bash
pulse export > pulse-state.md
```

## Status Model

MVP の status は意図的に小さく保ちます。

- `todo`: まだ claim されていない
- `claimed`: agent が担当している
- `blocked`: 判断待ち、外部入力待ち
- `review`: 人間の review 待ち
- `done`: 完了

各 command は `events` にも行を追加するため、chat history を開かなくても状態変化を追えます。

## MVP Scope

Pulse の MVP は、個人開発者が複数 AI agent の現在状態を手動で共有・観測できるところまでとします。

MVP に含めるもの:

- SQLite database の初期化
- task の追加
- agent claim / release
- `todo` / `claimed` / `blocked` / `review` / `done` の状態管理
- heartbeat 更新
- repo / worktree / branch / context の記録
- `pulse list` による機械可読 JSON と table 一覧
- `pulse status` による観測用の現在状態表示
- `pulse summary` による短い状況要約
- `pulse export` による Markdown 出力
- local command としての `pulse ...` 実行
- 100% coverage gate 付きの `npm run verify`

MVP に含めないもの:

- agent process の自動検出
- Git worktree / branch の自動 scan
- chat history の自動要約取り込み
- stale heartbeat の自動判定
- TUI / dashboard
- GitHub Issues / Pull Requests との同期
- 複雑な workflow engine
