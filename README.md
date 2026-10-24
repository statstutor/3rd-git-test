# DELVE — a browser companion

A family-use browser version of **DELVE: A Solo Map-Drawing Game** by Anna Blackwell
(https://blackwellwriter.itch.io/). DELVE is her design; this project is not for distribution.

## Play

Open **`dist/delve.html`** in a browser. That's all: it works offline, and your game
autosaves in the browser. Use *Save file* / *Load file* to keep a hold as a `.json` file.

## Develop

```sh
npm install      # once (esbuild)
npm test         # rules engine tests
npm run build    # rebuild dist/delve.html
```

- `src/data/` — the rulebook's tables as plain data (rooms, units, ♣/♠, quotes). Correct a
  line here without touching logic.
- `src/engine/` — the rules engine: pure functions, no DOM. Ruling IDs (R1…) in comments
  point into RULINGS.md.
- `src/ui/` — map rendering, ink art, panels.
- `RULINGS.md` — how our table reads the rulebook's open questions. The code follows it.
- `CHANGELOG.md` — what's in each version.
