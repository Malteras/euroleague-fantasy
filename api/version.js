// GET /api/version -> { commit }   the commit this deployment was built from (no passcode: it is not private)
const { send } = require("./_lib");

module.exports = (req, res) => send(res, 200, { commit: process.env.VERCEL_GIT_COMMIT_SHA || null });
