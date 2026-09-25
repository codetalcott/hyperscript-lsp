# hyperscript-lsp — code review

Reviewed `codetalcott/hyperscript-lsp` at `77f9f72` on 2026-09-25. No code was changed as part of this review. Line references are to that commit.

## Verdict

The code is prototype quality throughout, and none of the user-facing paths work end to end:

- The VS Code extension can't activate, and it can't start its server.
- The server has no transport that an editor speaks.
- Hover shows the wrong element for most words.
- Diagnostics are wrong on valid code, and nothing ever sends them to an editor.
- The "Agent API" doesn't parse anything.
- The MCP servers, the data pipeline, and the build and deploy setup are all broken.

**Recommendation:** archive this repo and build editor support in `codetalcott/hyperscript-tools` (§4).

## How this was checked

- **Environment.** Fresh clone, Bun 1.3.11, Node 22.22.
  - The database (`hyperscript.db`) and the `www/` docs are gitignored, so a clone doesn't have them.
  - I built a database in a scratch copy from `data/extracted/json` and put a copy at every path the code reads (see Appendix).
- **Reference for "valid hyperscript".** The official parser from npm (`hyperscript.org`), versions 0.9.93 (current) and 0.9.14. The two agreed on every snippet tested.
- **Coverage.** The review was split into five areas: core LSP, MCP, Agent API, data pipeline, and extension/deploy/docs.
- **Evidence.** Every finding was reproduced by running code, unless it is marked *(inferred)*.

## Status at a glance

| Area | State |
|---|---|
| VS Code extension | Never activates: the dependency and language IDs are wrong. The packaged extension can't load `vscode-languageclient`. The server it launches crashes under Node. |
| LSP server | No stdio transport. Hover is wrong for most words. Diagnostics are wrong on valid code and never delivered. Document symbols and go-to-definition can't be reached. |
| Agent API | Doesn't parse. Its "confidence" is a fixed formula. |
| MCP servers (two) | The stdio server errors on 32 of 103 element names. The remote server can't complete a handshake and has no authentication. |
| Data pipeline | No documented command builds the database. Re-runs duplicate data. The cleanup tool deletes every example-to-element link. Data quality is poor. |
| Build / deploy | `build` and `start` are broken, as are 15 of 19 npm scripts, both Dockerfiles, both `fly.toml` files and both deploy scripts. |
| Tests | Fresh clone: 171 pass / 57 fail / 5 errors. With a database: 212 / 16 / 5. Many passing tests assert wrong behaviour. |
| Docs | Claim diagnostics, symbols, definition, signature help, "100% passing" and "production-ready". |

---

## 1. Critical findings

### C1. The VS Code extension can't work

- **Wrong IDs** (`vscode-extension/package.json:12-14,44-46`, `extension.ts:54-56`).
  - It depends on `dz4k.hyperscript`, which doesn't exist. The real extension is `dz4k.vscode-hyperscript-org`, and it registers the language id `_hyperscript`.
  - So the activation event `onLanguage:hyperscript` never fires, and the document selectors never match.
- **Packaging.** `.vscodeignore:11` excludes `node_modules/**`, and the extension is compiled with plain `tsc` rather than bundled. The packaged extension therefore doesn't contain `vscode-languageclient` and fails to load with `MODULE_NOT_FOUND`.
- **Server launch** (`extension.ts:39-50`). It runs `node bundled-server/main.js` over stdio. That bundle is built from `src/server/main.ts` and imports `bun:sqlite`.
  - Under Node it exits immediately with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
  - Under Bun it starts an HTTP server, ignores stdin and prints a banner to stdout. It never answers `initialize`.
- **HTML files.** The selector sends whole `.html` files to the server.
  - The server has no code to pull hyperscript out of `_="…"` attributes or `<script type="text/hyperscript">` blocks, so it analyses the whole file as hyperscript.
  - For example, `<button` is reported as an unknown command.
- **Minor issues:**
  - `engines.vscode` is `^1.74.0`, but `vscode-languageclient@9` requires `^1.82.0`.
  - The client reads the trace setting from `hyperscriptLSP.trace.server`, so the contributed `hyperscript-lsp.trace.server` setting has no effect.
  - The two commands aren't declared in `contributes.commands`, so they don't appear in the Command Palette.
  - `--inspect=6009` comes after the script path, so it goes to the script instead of Node.

### C2. There is no standard LSP transport, and most features can't be reached

- **No stdio server.** `vscode-languageserver` is listed as a dependency but never imported by the server code, and no stdio server exists anywhere.
- **The deployed server speaks a non-standard protocol.** `src/server/lsp-server.ts` is what `main.ts` runs and what gets deployed. It takes JSON-RPC over HTTP POST, which no editor client speaks.
  - Notifications get a `{"jsonrpc":"2.0"}` reply body (`:154-180`). JSON-RPC notifications take no response, so over HTTP this should be an empty reply.
  - Error responses leave out the request id (`:214-220`).
- **Diagnostics are never sent.** No transport calls `publishDiagnostics` anywhere.
- **Symbols and go-to-definition are unreachable.** Both are implemented in `lsp-handlers.ts`, but no transport routes to them or advertises them (`lsp-server.ts:33-45`, `lsp-websocket.ts:119-126`). Only `src/mcp` and the tests call them.
- **The WebSocket server is the only plausibly usable path.** `src/server/lsp-websocket.ts` accepts raw JSON-RPC frames (as Monaco sends them), but only for completion and hover. Its problems:
  - It creates two database services and two sets of handlers (`:23-27`); one set is never closed.
  - All clients share one document map, and documents are never freed when a client disconnects.
  - It doesn't check the `Origin` header.
  - It replies to unknown notifications with errors (`:203-211`).
- **Four overlapping server entry points:**
  - `main.ts` → `lsp-server.ts`: HTTP JSON-RPC, the deployed one.
  - `websocket-main.ts`: the WebSocket server.
  - `index.ts`: what package.json's `main`, `build`, `dev` and `start` point at. It is a REST endpoint per LSP method, and its diagnostics are only written to the log.
  - `simple-server.ts`: a REST API over the database.

### C3. Element lookups return the wrong element

This affects hover, completion, diagnostics, the Agent API and `src/mcp`.

- **Cause.**
  - `src/db/connection.ts:106-180` matches `name LIKE %word% OR description LIKE %word%`, with no preference for exact matches. `searchElements` has no `ORDER BY`.
  - `database-service.ts:221-238` then takes the first *command* that matches before it even looks at the other element types.
- **Hover through the LSP handlers** (verified):

  | Hovered word | Docs shown for |
  |---|---|
  | `put` | `go` |
  | `toggle` | `hide` |
  | `on` | `throw` |
  | `me` | `take` |
  | `into` | `hide` |

- **Direct `getHoverInfo` calls:**

  | Word | Element returned |
  |---|---|
  | `it`, `if` | command `take` |
  | `behavior` | command `go` |
  | `init` | command `put` |
  | `def` | command `hide` |
  | `end` | command `pick` |
  | `count` | feature `on` |

- **`index.ts` has a second hover bug.** It looks up only the text *before* the cursor (`index.ts:56`), so hovering mid-word on `toggle` shows `take`.
- **Completion is noisy.**
  - The prefix `m` returns 88 items, because it matches anywhere in any description.
  - Labels are duplicated (`it`, `me`, `you`, `set`, `js`, `async`, `on`, `as`).
  - Items are sorted alphabetically, with no preference for prefix matches.
- **The tests don't catch it.** The hover tests only check that the text contains the word. For example, `hover-integration.test.ts:34` expects "put", which `go`'s description contains.
- **Fix:** exact-name lookups per element type, through a single lookup path.

### C4. Diagnostics disagree with the language

`src/server/lsp-handlers.ts:305-573` is line-by-line pattern matching. The official parser accepts every snippet below ("/" marks a line break).

| Valid hyperscript | LSP diagnostic | Rule |
|---|---|---|
| `on click put "it's done" into #out` | Error: Unmatched single quote | counts quote characters (`:325-353`) |
| `on click` / `put 'x' before me` | Error: missing 'into' | only `into` is accepted (`:404-416`) |
| `set x to 10` / `log x` | Warning: unused variable | only `put X into` counts as a use (`:418-428`, `:524-546`) |
| `fetch /api/data` / `put result into #out` | Error: 'result' used but not defined | same for `event` (`:549-570`) |
| `if I match .active` / `remove .active` (at end of handler) | Error: missing 'end' | `:355-367`. The parser requires `end` only when more tokens follow. |
| `if x then log 1 end` (on one line) | Error: missing 'end' | only the first word of later lines is checked |
| `on every click add .clicked` | Warning: unknown event 'every' | hardcoded event list (`:495-521`) |
| `on keypress[key is 'Enter'] send submit to the closest <form/>` | Error: Unknown command 'submit'; Warning: unknown event 'keypress' | any word not found in the database (`:462-493`) |
| `on mouseenter wait 1s then add .hover` | Error: Unknown command 'mouseenter' | same |
| `on click -- don't do anything silly` | a quote error plus two "Unknown command" errors | comments are skipped only at the start of a line |
| `set count1 to 0` / `increment count1` / `put count1 into #out1` | 3 × Error: Unknown command 'count1' | variable names are reported as commands |

- **Scale.** A valid document with 50 handlers produced 150 errors.
- **Real errors are missed.** `on click toggle`, `on click put 'x' into` and `add .foo to` get no diagnostics, although the parser rejects them.
- **"Unknown" is arbitrary.** Whether a word counts as unknown depends on whether it appears anywhere in some element's description (C3). So `x` passes and `count1` fails.
- **`parser.ts` has the same problems.** It is used by `index.ts` and `simple-server.ts`.
  - It reports "Missing end" on any line containing the word `on`, including `toggle .active on me`.
  - It ignores which quote character opened a string.
- **The diagnostics tests encode these behaviours.** They use a mock database with exact-match lookups (`lsp-diagnostics.test.ts:11-30`) and expect several of the false positives above.
- **Fix:** take diagnostics from the official parser, whose errors carry line and column.

### C5. The Agent API doesn't validate

`src/server/agent-api.ts:580-645` does two checks:

- The first word of each line must be one of 10 allowed words or match the (substring) database lookup.
- A line containing `" put "` without `" into "` is an error.

Everything else passes.

**Wrong verdicts.**

- **Reported valid, with 0.95 confidence:**
  - `on click frobnicate #x`
  - `on click puts 'x' into me`
  - `on click put 'hello into me` (unterminated string)
  - `on click set x = 5`
  - `on click toggle`
  - `the quick brown fox`
  - `x = 5`
  - `end end end`
  - the empty string
- **Reported invalid** (all valid):
  - `put … before me`
  - `put … at the end of #log`
  - `put` split across lines
  - `log 'please put it back'`

**"Confidence" is a fixed formula** (`:684-691`).

- Valid code scores 0.95 − 0.05 × warnings.
- Invalid code scores max(0.7, 0.9 − 0.1 × errors). The score reads as certainty that the code is wrong, and it drops as errors increase: one error gives 0.8, two or more give 0.7.
- `getValidationConfidence` subtracts 0.15 per uncertainty string, whatever the string says.

**Other problems.**

- **Wrong syntax help.** `getSyntaxHelp('on')` returns `throw <expression>`, because of C3. Likewise `put` → `go`, `toggle` and `def` → `hide`, and `add`, `set` and `remove` → `take`.
- **A missing database is reported as errors in the code.** The API never calls `isReady()`, and lookups fail silently, so valid code gets "Unknown command: 'toggle'".
- **Cache problems.**
  - The cache key doesn't include the validation level actually used, so results depend on call order.
  - Cached objects are returned by reference, so a caller that modifies a result changes later results.
  - The documented "LRU" eviction is actually first-in-first-out.
- **`database-optimizer.ts` is never used by the API, but has side effects anyway.** Constructing the API with a database path:
  - opens a second read-write handle that is never closed;
  - writes 6 views and 2 indexes into your database;
  - prints to stdout.
- **The optimizer's views are mostly empty or wrong.**
  - No `GROUP BY`.
  - `GLOB '*[*]*'` matches a literal `*`, not square brackets.
  - Commands are excluded.
  - Confidence is sorted as text.
  - Its reported "performance improvement" is just warm-up.
- **The failing tests hide how weak the passing ones are.** All 7 failing Agent API tests fail only because of the hard-coded `/Users/williamtalcott/…` database path.
  - With a correct path they pass.
  - That includes tests that assert wrong output: the llm-workflow test expects `valid: true` for code the parser rejects.

### C6. The MCP servers are broken and unsafe to deploy

There are two MCP servers, `mcp-server/` and `src/mcp/`, with the same tool names and different implementations.

**The stdio server in `mcp-server/`.**

- **Missing column.** `mcp-server/src/services/database-service.ts:38,71` selects `expressions.syntax`, which doesn't exist.
  - `search_language_elements` (with the default type) and `get_hover_info` fail for 32 of the 103 names, including every special symbol.
- **Symbol search is always empty.** `type: "symbol"` looks up `results.symbols`, but the key is `specialSymbols` (`:63`).
- **Empty syntax and examples.** Feature syntax is read from an empty column, and hover examples are hard-coded to `[]`.

**The remote server** (`mcp-server/src/remote-server.ts`).

- **No client can finish connecting.** It handles only `GET /sse` (`:79-84`) and never routes the POSTed messages, so `initialize` never completes. Other requests hang with no timeout.
- **Responses would leak between clients.** One `Server` instance is connected to every client (`:17`, `:82`). The reviewer added the missing routing in a test harness and saw responses go to whichever client connected last.
- **No protection.**
  - There is no authentication.
  - It doesn't check the `Origin` header, which the MCP spec requires for HTTP transports.
  - It returns raw SQL errors to clients.
  - `fly-mcp.toml` exposes it publicly.

**The analyzer** (`analyzer-service.ts`).

- The regex at `:50` takes time that grows quadratically with input: 2.2 s at 96 KB and 8.7 s at 192 KB, and the SDK accepts 4 MB request bodies.
- It also reports "Missing 'end'" and quote errors on valid one-liners.

**Everything else.**

- **Generated code.** 3 of the 8 generated patterns fail the official parser (`prevent default`; `fetch "<url>" + @page`). Others check `it.ok` without `as response`.
- **Startup.**
  - The documented `node dist/index.js` crashes on `bun:sqlite`.
  - After bundling, the database path resolves to a location outside the repo.
- **SDK and protocol.**
  - The SDK is pinned at 0.5.0, which uses the deprecated SSE transport.
  - Tool failures come back without `isError`.
  - `tsc -p mcp-server` fails.
- **`src/mcp/`.**
  - It can't start from this repo, because the SDK isn't a root dependency.
  - Its default search returns only a header (`:171` vs `:180`).

### C7. A fresh clone can't build or run the documented system

- **The build scripts don't read the committed data.** The database is gitignored, and neither build script reads `data/extracted/json`:
  - `scripts/database/ingest.ts:8-9` reads `scripts/scripts/data/collected_json` and writes `scripts/hyperscript.db`.
  - `db-init.ts:6-9` reads `scripts/database/data/collected_json`.

  Both print success and exit 0 with 0 rows.
- **Consumers read different paths:**
  - the LSP reads `src/hyperscript.db`;
  - MCP reads `data/database/hyperscript.db`;
  - the validation scripts read `<repo>/hyperscript.db`;
  - tests read `tests/unit/`, `tests/` and `/Users/williamtalcott/…`.
- **A missing database silently becomes an empty one.** `src/db/connection.ts:62-66` opens the database read-write with `create: true`.
  - Verified: `bun test` on a fresh clone created 0-byte `src/hyperscript.db` and `tests/unit/hyperscript.db`.
  - Queries then fail with "no such table", callers swallow the error, and the server returns empty results while `/health` says ok.
- **Stale paths after the restructure.**
  - 15 of 19 npm scripts point at files that have moved. `scripts/migrate-structure.ts:172-175` moved the files, but its `updateImports()` is a stub.
  - Every data-collection and validation script fails at import (`'../schemas'`, `'../../schemas'`, `'../../db/connection'`).

### C8. The data pipeline corrupts or loses data

- **The cleanup tool deletes every example link.**
  - `cleanup-artifacts.ts:212-240` and `detect-artifacts.ts:233-251` look up element types as `'command'`, `'keyword'`, and so on, but ingest writes `'Command'`, `'Keyword'`, `'SpecialSymbol'`.
  - As a result, detect reports all 704 example-to-element links as orphaned.
  - A live cleanup run deletes all 704 of them (reproduced on a copy).
  - The only thing currently preventing this is the import bug in C7.
- **The cleanup tool is also unsafe in other ways:**
  - Its de-duplication keeps `MIN(id)` over random UUIDs, which is an arbitrary row, not the earliest.
  - It deletes parent rows without their children. That orphans tags and examples, and fails with a foreign-key error on keywords.
  - The steps don't run in one transaction.
  - Backup is opt-in.
  - The counts it reports are computed from constants.
  - It throws after modifying the database and still exits 0.
- **Ingest commits partial data.**
  - Inner `catch` blocks at `:632` and `:704` sit inside the supposedly single transaction, so a partial import is committed and reported as success.
  - Re-running on an existing database hits a primary-key violation, rolls back, prints "Import failed", and exits 0.
- **Re-runs duplicate or keep stale data.**
  - `db-init.ts` skips rows by id, so edited JSON leaves stale rows in place.
  - The scraper assigns fresh UUIDs on every run. A re-scrape followed by ingest adds a second copy of every element and breaks every example link.
- **The schema has drifted from its consumers.**
  - `db-init.ts` lacks the code-example tables.
  - Neither schema has `expressions.syntax`.
  - Ingest reads a `syntax_patterns` field that doesn't exist, so all 22 expression syntax strings are dropped.
  - `src/schemas.ts` declares timestamps as dates while the JSON stores strings, so 0 of 219 raw entries validate. It also silently strips fields, so no element keeps its source info.
- **Validation can't fail.** The "expected" lists are copied from the scraper's own seed lists, commands and features are assumed valid, and the scripts exit 0 on failure.
- **`scripts/database/schema.ts:250-251`** resolves its default path from the current directory, so running it from the repo root writes a database outside the repo.

### C9. The deployed configuration is unsafe

- **LSP app.** `fly-lsp.toml` runs `main.ts` → `lsp-server.ts`:
  - public and unauthenticated;
  - CORS open to every origin;
  - one global document map with no size or count limit and no eviction, so anyone can exhaust the 512 MB VM's memory *(inferred from code)*;
  - clients overwrite each other's documents when they use the same URI.
- **MCP app.** `fly-mcp.toml`: see C6.
- **If either Fly app is live, take it down.**

---

## 2. Other findings

### LSP server (`src/server`, `src/db`)

- **Handler logic.**
  - Go-to-definition returns the cursor position itself for any known word (`lsp-handlers.ts:753-778`).
  - `findBehaviorEnd` assumes behaviours have no `end` (`:216-225`), so a behaviour's range runs to the next `behavior` or the end of the file.
- **Caching and lookup** (`database-service.ts`).
  - The cache has no size limit, and entries expire only when read (`:61-88`).
  - Lookups that find nothing aren't cached, so each unknown word queries the database on every diagnostics run.
  - `findDefinition` and `getHoverInfo` check element types in different orders (`:302-313` vs `:223-238`).
- **Connection handling** (`connection.ts`).
  - WAL mode is enabled only when `verbose` is set (`:68-70`).
  - The connection pool does nothing useful with synchronous `bun:sqlite`, and it throws when exhausted.
- **`index.ts` crashes and leaks.**
  - It returns HTTP 500 when the requested line is past the end of the document (`:52`).
  - It opens a new database connection on every `/initialize` without closing the previous one (`:87`).
- **Duplication.**
  - There are two database access layers with different behaviour: `src/db/query.ts` (used by `index.ts` and `simple-server.ts`) and `src/db/connection.ts` (used by everything else). `mcp-server` has a third.
  - LSP types are hand-written twice (`lsp-handlers.ts`, `types.ts`), while the official `vscode-languageserver-protocol` is installed but unused.
- **Hardcoded language data.** The handlers contain their own event list and skip lists, against CLAUDE.md's rule that language data comes from the database.
- **Performance is fine.** Diagnostics run in linear time: about 75 µs per line, or about 0.4 s for 5,600 lines.

### Build and deployment

- **`bun run build`** targets the browser and fails on `bun:sqlite` and `http2`. `start` then has nothing to run, and both point at the legacy `index.ts`.
- **`config/docker/lsp.Dockerfile`:**
  - Line 24, `COPY src/hyperscript.db … 2>/dev/null || echo …`, is not valid: COPY doesn't run a shell, and BuildKit reads it as 12 sources *(the build failure itself is inferred; no Docker daemon was available)*.
  - The HEALTHCHECK uses `curl`, which isn't in the runtime image.
  - The CMD runs the TypeScript source, so the built `dist/` is unused.
- **`config/docker/mcp.Dockerfile`:**
  - It copies `bun.lockb`, which doesn't exist.
  - `COPY ../src/…` reaches outside the build context.
  - The CMD runs `node`, which crashes.
  - The database is copied to a path the code doesn't read.
- **Fly configs.**
  - `fly-mcp.toml` points at a `Dockerfile` that doesn't exist.
  - `fly-lsp.toml` has an empty `[build]` section *(inferred: flyctl won't find a Dockerfile)*.
  - `fly-mcp.toml` defines both `[http_service]` and `[[services]]` on port 3000.
- **Deploy scripts.**
  - `scripts/deployment/deploy-lsp.sh` changes into `scripts/` (not the repo root) since the move. It also calls scripts that have moved, runs `flyctl deploy` without `-c`, and aborts on the failing `bun test`.
  - `test-docker.sh` builds from `scripts/` and refers to a `deploy.sh` that doesn't exist.

### Dependencies and types

- **Unused packages.**
  - `@hono/zod-validator`, `vscode-languageserver-protocol` and `vscode-languageserver-textdocument` are never imported.
  - `vscode-languageserver` appears only as a type import in one test.
- **Misplaced or missing packages.**
  - Script-only packages (`cheerio`, `markdown-it`, `front-matter`, `uuid`, `zod`) and `@types/*` sit in `dependencies`.
  - `@modelcontextprotocol/sdk` is used by `src/mcp` but not declared at the root.
- **Metadata.**
  - `typescript` is a peerDependency.
  - `@types/bun` is set to `latest`.
  - `engines.node` says `>=16`, although nothing runs on Node.
- **`tsc --noEmit -p .`: 236 errors in 39 files.**
  - Most are strictness noise.
  - The root tsconfig has no `include`, which produces 13 spurious "cannot find module" errors from the sub-packages.
  - Several are real bugs:
    - the broken script imports;
    - `index.ts:52` (possibly undefined line);
    - `performance_target: "normal"` in the example and the guide, which isn't an allowed value;
    - `typeDistribution`, referenced in tests but never defined, so the guarded assertions never run;
    - type imports from `types.ts` that it doesn't export.

### Tests

- **Counts.** Fresh clone: 171 pass / 57 fail / 5 errors. With a database at every expected path: 212 / 16 / 5.
- **Almost all failures are path problems:**
  - the missing database;
  - `/Users/williamtalcott/…` in 4 files;
  - moved fixtures: `fixture-integration.test.ts:12` reads `tests/unit/server/test-fixtures`, and because it loads the fixtures while tests are being collected, its 13 tests never register;
  - moved deployment files.
- **The rest are real bugs.** The remaining MCP failures come from the missing `syntax` column.
- **Many passing tests assert wrong behaviour:**
  - hover substring checks;
  - the diagnostics mock;
  - Agent API validity;
  - a cleanup test that passes only after data loss.
- **Two validation test files contradict each other.** One requires duplicates to exist; the other requires the result of the destructive cleanup.
- **Fragile setup.**
  - Tests bind fixed ports 3000–3003, 4000 and 4001.
  - The WebSocket tests have no timeout or error path.
  - The optimizer test writes to a fixed `/tmp` path.
- **"Multi-line" test inputs are single lines.** They are written with an escaped `\\n` (`agent-api.test.ts:107,124,338`, `load-testing.test.ts`).
- **The performance tests are stable but measure little.** They rely on `Date.now()` resolution, report a synthetic memory figure, and include a deliberate 3-second sleep.

### Documentation

- **Features claimed but missing.**
  - Diagnostics, document symbols, go-to-definition and signature help are described as implemented (`docs/setup/vscode-setup.md:61-66`, `docs/architecture/lsp-implementation.md:20-38`).
  - The docs claim "95 tests, 100% passing" and "production-ready" (`lsp-implementation.md:49-50,150`).
  - They describe LRU caches that don't exist (`:110-112`).
- **Commands that fail.** Nearly every documented command fails (deployment.md, development-workflow.md, and CLAUDE.md's `unified-validation` and `ingest` steps).
- **CLAUDE.md misdirects.** It points LSP work at `src/db/query.ts`, which the LSP doesn't use.
- **README problems.**
  - It links CONTRIBUTING.md and LICENSE; neither exists.
  - package.json has `author: "Your Name"`.
  - The clone URL uses `yourusername`.
- **MCP docs problems.**
  - They describe `/health` and `POST /call` endpoints that don't exist.
  - The authentication recipe can't work with SDK 0.5.0.
  - They say to run `node dist/index.js`, which crashes.
  - `INSTALL.md` and `claude-config.json` hard-code `/Users/williamtalcott` paths.

### Data quality (`data/extracted/json`)

- **Totals.** 219 entries:

  | Type | Count |
  |---|---|
  | Commands | 37 |
  | Expressions | 22 |
  | Features | 9 |
  | Keywords | 27 |
  | Special symbols | 8 |
  | Examples | 116 |

  The structure is valid once dates are converted. `markdown_cookbook_examples_enriched.json` is byte-identical to the non-enriched file.
- **Coverage against the parser (0.9.93).**
  - The data has 34 of the 54 commands the parser recognises. Missing: `answer`, `ask`, `blur`, `breakpoint`, `clear`, `close`, `empty`, `exit`, `focus`, `for`, `get`, `morph`, `open`, `reset`, `scroll`, `select`, `speak`, `start`, `swap`, `beep!`.
  - It lists `async`, `beep` and `pseudo-commands` as commands; none of them is one.
  - Features lack `bind`, `install`, `live` and `when`, and `event-source` should be `eventsource`.
- **Scraper errors.**
  - All 22 expressions are categorised "Arithmetic": the operator `/` was harvested from `</div>`.
  - The first code block on each page is stored as the syntax. That captured examples, `<script>` tags and raw `{%syntax%}` template tags.
  - Line breaks were dropped, gluing words together ("request to thegiven URL").
  - 15 of the 27 keywords are placeholders.
  - Usage contexts are fixed ±15-character windows; 11 don't even contain the keyword.
  - `you` and `@` are defined wrongly.
- **Examples.**
  - Only 6 of 116 come from the cookbook.
  - 14 of the 18 examples taken from Typst sources are prose or markup, not code.
  - All are labelled "Beginner".
  - 110 of 116 `document_path` fields contain `/Users/williamtalcott/…` paths.

### Repo hygiene

- No CI, no lint configuration, no LICENSE file.
- `.DS_Store` is tracked.
- The generated `repo-structure-*.json` files at the root are stale.
- The `.gitignore` pattern `test-*.ts` ignores every file with that name anywhere in the repo.
- `docs/dev/roadmap.md` is out of date.

---

## 3. What is sound

- **No SQL injection.** All values are passed as bound parameters, and table names come from fixed lists.
- **The committed JSON is internally consistent.** UUIDs are unique, and all 704 example-to-element references resolve.
- **The servers work at the protocol level.** With a database present, `bun run server` and the WebSocket server both answer correctly, apart from the content problems in C3 and C4.
- **The VS Code client is reusable.** It is a standard `LanguageClient` setup of about 100 lines, and can be reused once the IDs, packaging and transport are fixed.

## 4. Recommendation

Fixing this codebase in place would mean replacing the transports, the lookup layer, diagnostics, the Agent API, the MCP servers and the data pipeline. Archive it instead, and add editor support to `codetalcott/hyperscript-tools` (reviewed read-only at `1fd9364`; its tests weren't run).

**What hyperscript-tools already has, which this repo lacks:**

- **A single loader for the official parser.** It runs without a browser. Its default mode parses the way the browser runtime does and recovers after each feature, and `safeParse` returns errors with positions.
- **A command and feature inventory kept in sync with the parser.** A test checks it against the parser's own registry in both directions.
- **Tests that keep the docs honest.** A fixed set of valid and invalid snippets, and a test that every example it ships actually parses.
- **CI and releases.** CI on Node 22 and 24, and releases published to npm.

**What it lacks for editor support:**

- **A language server.** Its `lsp-bridge.ts` exposes MCP tools, not the LSP protocol.
- **HTML extraction.** Pulling `_`, `script` and `data-script` attributes and `<script type="text/hyperscript">` blocks out of an HTML file, with positions mapped back to the file.
- **A VS Code client.**
- **Plugin-feature handling.** It rejects `worker`, `socket` and `eventsource` because it doesn't load their plugins. The `worker` and `eventsource` plugins also touch browser globals when they are registered or used, so they need stubs to run without a browser.

**Suggested shape:**

1. Move the symbol, completion and hover logic in `lsp-bridge.ts` out of its MCP wrappers, so the MCP server and a language server can share it.
2. Add `packages/language-server`:
   - built on `vscode-languageserver`;
   - diagnostics from `safeParse` (lines are 1-based, columns 0-based);
   - HTML region extraction.
3. Add `packages/vscode-extension`:
   - this repo's client, switched to `TransportKind.ipc` + `module`, so it runs on VS Code's own Node and users don't need Bun or Node installed;
   - bundled with esbuild or tsup;
   - depending on `dz4k.vscode-hyperscript-org` and selecting the `_hyperscript` language.
4. Carry over the valid snippets this LSP wrongly flags (C4) as new cases in hyperscript-tools' test corpus. The extracted JSON is superseded; reuse individual descriptions or examples only after they pass the examples test.

**Before archiving:** point this repo's README at hyperscript-tools, and take down the Fly apps if they're live.

---

## Appendix: reproduction

- **Test database.**
  1. Extract a copy: `git archive HEAD | tar -x`.
  2. Symlink `data/extracted/json` to `scripts/scripts/data/collected_json`.
  3. Run `bun run scripts/database/ingest.ts`.
  4. Copy `scripts/hyperscript.db` to `src/`, `tests/`, `tests/unit/`, `data/database/` and the repo root.
- **Reference parser.**
  - Install with `npm install hyperscript.org@0.9.93`.
  - Import `dist/_hyperscript.esm.js` by file path; the package's `exports` map only exposes the browser build.
  - `_hyperscript.parse(src).errors` returns `{message, line, column, token}`.
