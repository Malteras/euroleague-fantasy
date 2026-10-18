// Shared helpers for the API routes (files starting with _ are not routes on Vercel).
const crypto = require("crypto");
const REPO = process.env.GH_REPO || "Malteras/euroleague-fantasy";
const STATE_BRANCH = "state";

function authOk(req) {
  const want = process.env.APP_PASS || "";
  const got = String(req.headers["x-pass"] || "");
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function gh(path, opts = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error("GITHUB_TOKEN is not set on Vercel"), { status: 500 });
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "euroleague-fantasy-planner",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok && r.status !== 404) throw Object.assign(new Error(`GitHub ${r.status}: ${data && data.message}`), { status: 502 });
  return { status: r.status, data };
}

async function readJson(file, ref) {
  const { status, data } = await gh(`/contents/${file}?ref=${ref}`);
  if (status === 404) return { json: null, sha: null };
  return { json: JSON.parse(Buffer.from(data.content, "base64").toString("utf8")), sha: data.sha };
}

async function ensureStateBranch() {
  const { status } = await gh(`/git/ref/heads/${STATE_BRANCH}`);
  if (status !== 404) return;
  const main = await gh(`/git/ref/heads/main`);
  await gh(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${STATE_BRANCH}`, sha: main.data.object.sha }) });
}

async function writeJson(file, ref, obj, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha } = await readJson(file, ref);
    const { status, data } = await gh(`/contents/${file}`, {
      method: "PUT",
      body: JSON.stringify({
        message, branch: ref, sha: sha || undefined,
        content: Buffer.from(JSON.stringify(obj, null, 1) + "\n").toString("base64"),
      }),
    }).catch(e => ({ status: 409, data: { message: e.message } }));
    if (status === 200 || status === 201) return data.commit && data.commit.sha;
  }
  throw Object.assign(new Error("Could not write to GitHub, please try again"), { status: 502 });
}

function send(res, code, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(code).json(body);
}

async function handle(req, res, fn) {
  try {
    if (!authOk(req)) return send(res, 401, { error: "Wrong or missing passcode" });
    await fn();
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}

module.exports = { REPO, STATE_BRANCH, gh, readJson, writeJson, ensureStateBranch, send, handle };
