# D&D Combat Tracker

Touch-first combat tracker:
- Initiative order with Next/Prev turn + Round counter
- HP tracking with big buttons (damage/heal presets)
- Conditions toggles
- Effects (buffs/debuffs) with durations (round-based) + concentration flag
- Resistances/vulnerability/immunity per damage type (auto-applies to damage)
- Undo
- Local persistence (localStorage)

## Run locally
1) Install Node.js
2) In this folder:

```bash
npm install
npm run dev
```

## Deploy (static)
```bash
npm run build
```
Deploy the `dist/` folder anywhere static.