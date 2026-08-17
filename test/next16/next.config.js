// Don't let `next dev` write AGENTS.md / CLAUDE.md into the fixture when it
// detects an AI coding agent in the environment (CLAUDECODE, AI_AGENT, CURSOR_*
// and friends -- see next/dist/compiled/@vercel/detect-agent). Keeps the test
// tree identical whether the suite is run by a human, by CI, or by an agent.
module.exports = { agentRules: false };
