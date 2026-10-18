// GET  /api/state -> { prefs, squad }   (prefs from the "state" branch, squad.json from main)
// PUT  /api/state  body { prefs }        (saves planner settings + unsaved team draft for all devices)
const { STATE_BRANCH, readJson, writeJson, ensureStateBranch, send, handle } = require("./_lib");

module.exports = (req, res) => handle(req, res, async () => {
  if (req.method === "GET") {
    const [p, s] = await Promise.all([readJson("state.json", STATE_BRANCH).catch(() => ({ json: null })), readJson("squad.json", "main")]);
    return send(res, 200, { prefs: p.json, squad: s.json });
  }
  if (req.method === "PUT") {
    const prefs = req.body && req.body.prefs;
    if (!prefs || typeof prefs !== "object") return send(res, 400, { error: "prefs missing" });
    if (JSON.stringify(prefs).length > 50000) return send(res, 413, { error: "too large" });
    await ensureStateBranch();
    prefs.savedAt = new Date().toISOString();
    await writeJson("state.json", STATE_BRANCH, prefs, "Planner settings from the site");
    return send(res, 200, { ok: true, savedAt: prefs.savedAt });
  }
  res.setHeader("Allow", "GET, PUT");
  send(res, 405, { error: "Method not allowed" });
});
