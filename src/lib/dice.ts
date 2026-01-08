// src/lib/dice.ts
export type DiceRollDetail = {
  expr: string;
  total: number;
  terms: Array<{
    sign: 1 | -1;
    kind: "dice" | "number";
    count?: number;
    sides?: number;
    rolls?: number[];
    value: number; // subtotal for the term (already signed)
  }>;
};

function isIntString(s: string) {
  return /^[0-9]+$/.test(s);
}

function parseDiceToken(tok: string): { count: number; sides: number } | null {
  // supports: d6, 1d6, 13d6, 2D8
  const m = tok.match(/^(\d*)[dD](\d+)$/);
  if (!m) return null;
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
  if (count < 1 || sides < 2) return null;
  return { count: Math.trunc(count), sides: Math.trunc(sides) };
}

export function isDiceExpression(raw: string): boolean {
  return /[dD]/.test(raw);
}

export function rollDiceExpression(
  raw: string,
  rng: () => number = Math.random
): DiceRollDetail {
  const expr = raw.replace(/\s+/g, "");
  if (!expr) throw new Error("Empty expression");

  // Tokenize into signed terms: +2d6, -4, +d8, etc.
  // We do a simple scan splitting on +/-, keeping sign.
  const termsSrc: Array<{ sign: 1 | -1; tok: string }> = [];
  let i = 0;
  let sign: 1 | -1 = 1;

  if (expr[0] === "+") i++;
  else if (expr[0] === "-") {
    sign = -1;
    i++;
  }

  let start = i;
  for (; i <= expr.length; i++) {
    const ch = expr[i];
    if (i === expr.length || ch === "+" || ch === "-") {
      const tok = expr.slice(start, i);
      if (!tok) throw new Error(`Bad expression near '${expr.slice(0, i)}'`);
      termsSrc.push({ sign, tok });
      sign = ch === "-" ? -1 : 1;
      start = i + 1;
    }
  }

  const detail: DiceRollDetail = { expr: raw, total: 0, terms: [] };

  for (const t of termsSrc) {
    const dice = parseDiceToken(t.tok);
    if (dice) {
      const rolls: number[] = [];
      for (let r = 0; r < dice.count; r++) {
        // rng() in [0,1); map to 1..sides
        const roll = 1 + Math.floor(rng() * dice.sides);
        rolls.push(roll);
      }
      const sum = rolls.reduce((a, b) => a + b, 0);
      const signed = t.sign * sum;
      detail.terms.push({
        sign: t.sign,
        kind: "dice",
        count: dice.count,
        sides: dice.sides,
        rolls,
        value: signed,
      });
      detail.total += signed;
      continue;
    }

    if (isIntString(t.tok)) {
      const n = Math.trunc(Number(t.tok));
      const signed = t.sign * n;
      detail.terms.push({ sign: t.sign, kind: "number", value: signed });
      detail.total += signed;
      continue;
    }

    throw new Error(`Unrecognized term '${t.tok}'`);
  }

  return detail;
}
