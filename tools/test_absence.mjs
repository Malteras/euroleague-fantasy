// Tests for absenceOf() and buyLow() in index.html. Run: node --test tools/test_absence.mjs
// The page is one file, so the test cuts the functions out between their marker comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("// absenceOf:begin"), html.indexOf("// absenceOf:end"));
const { absenceOf, buyLow } = new Function(src + "\nreturn {absenceOf,buyLow};")();

// his club's six EuroLeague games, one a round
const CLUB = ["2026-09-24", "2026-09-29", "2026-10-01", "2026-10-09", "2026-10-14", "2026-10-16"];
const g = (d, fpt) => ({ d, fpt });
const player = (o) => ({ price: 10, start: 11, status: null, out: false, log: [], dom: [], hist: [], pir2526: null, ...o });

test("no missed club game means no absence", () => {
  assert.equal(absenceOf(player({ log: CLUB.map((d) => g(d, 10)) }), CLUB), null);
});

test("price before is his price after the last round he played before the absence", () => {
  const p = player({
    price: 9.7,
    log: [g(CLUB[5], 12), g(CLUB[4], 14), g(CLUB[1], 15), g(CLUB[0], 13)],
    hist: [[1, 10.3, 0.3], [2, 10.5, 0.2], [3, 10.4, -0.1], [4, 10.3, -0.1], [5, 9.9, -0.4], [6, 9.7, -0.2]],
  });
  const a = absenceOf(p, CLUB);
  assert.equal(a.missed, 2); // rounds 3 and 4
  assert.equal(a.before, 10.5);
  assert.equal(a.drop, 0.8);
  assert.equal(a.usual, 14); // average FPT of the two games before he went out
  assert.equal(a.usualSrc, "before");
  assert.equal(a.back, true);
});

test("an absence that ended more than three club games ago is not recent", () => {
  const p = player({ log: CLUB.slice(2).map((d) => g(d, 10)), hist: [[1, 10.9, -0.1], [2, 10.8, -0.1]] });
  assert.equal(absenceOf(p, CLUB), null);
});

test("out since round 1: price before is his start price, usual level is last season's PIR", () => {
  const p = player({ start: 13.5, price: 12.5, pir2526: 15.1, log: [g(CLUB[5], 4), g(CLUB[4], 9)] });
  const a = absenceOf(p, CLUB);
  assert.equal(a.before, 13.5);
  assert.equal(a.drop, 1);
  assert.equal(a.usual, 15.1);
  assert.equal(a.usualSrc, "last season");
});

test("back means he played his latest game, EuroLeague or domestic, or is listed Return", () => {
  const missedLast = { log: CLUB.slice(0, 4).map((d) => g(d, 10)), hist: [[4, 10.4, 0]] };
  assert.equal(absenceOf(player(missedLast), CLUB).back, false);
  assert.equal(absenceOf(player({ ...missedLast, dom: [{ d: "2026-10-18", pir: 12, dnp: false }] }), CLUB).back, true);
  assert.equal(absenceOf(player({ ...missedLast, dom: [{ d: "2026-10-18", pir: null, dnp: true }] }), CLUB).back, false);
  assert.equal(absenceOf(player({ ...missedLast, status: "Return" }), CLUB).back, true);
});

// buyLow: back, not Out or Doubtful, price at least 0.3 under where it was, and his usual level reaches his break-even now
const star = () => player({ start: 13.5, price: 12.5, be: 13.8, pir2526: 15.1, log: [g(CLUB[5], 4), g(CLUB[4], 9)] });

test("a star back from injury and 1 cr cheaper is a buy-low", () => {
  const p = star();
  assert.equal(buyLow(p, absenceOf(p, CLUB)), true);
});

test("an Out or Doubtful player is not, even if he played his last game", () => {
  for (const status of ["Out", "Doubtful"]) {
    const p = { ...star(), status, out: status === "Out" };
    assert.equal(buyLow(p, absenceOf(p, CLUB)), false, status);
  }
});

test("a bench player with no games and no last season is not", () => {
  const p = player({ price: 5.3, start: 5.9, be: 5.8, dom: [{ d: "2026-10-18", pir: 4, dnp: false }] });
  assert.equal(buyLow(p, absenceOf(p, CLUB)), false);
});

test("a drop under 0.3 cr is not", () => {
  const p = { ...star(), price: 13.3, be: 14.6 };
  assert.equal(buyLow(p, absenceOf(p, CLUB)), false);
});

test("no absence is not", () => {
  assert.equal(buyLow(star(), null), false);
});
