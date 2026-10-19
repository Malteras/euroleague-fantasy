// POST /api/team  body { team }  -> commits squad.json to main (the daily report reads it)
const { writeJson, send, handle } = require("./_lib");

module.exports = (req, res) => handle(req, res, async () => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed" }); }
  const t = req.body && req.body.team;
  const ok = t && Array.isArray(t.slots) && t.slots.length === 10 && Array.isArray(t.players) && t.players.length === 10 && typeof t.coach === "string";
  if (!ok) return send(res, 400, { error: "Team must have 10 players and a coach" });
  const sha = await writeJson("squad.json", "main", t, `My team saved from the site (${t.updated || "today"})`);
  send(res, 200, { ok: true, commit: sha });
});
