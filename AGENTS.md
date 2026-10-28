# Main game hub

The canonical working checkout is this repository root on `main`. The user plays at http://localhost:8081. Make game changes here unless the user explicitly requests an isolated checkout. Do not launch a competing hub from `.claude/worktrees/` or the legacy `Unlike-Hero/` folder. Preserve those copies as historical work; do not delete or blindly merge them.

Use `npm run play` / `Start Hub.command` to launch the primary checkout on port 8081. Do not silently choose a different port. `npm start` also defaults to 8081 and watches imported server modules for changes. Refresh the browser after client changes; a backend restart ends active rooms. Run `npm run registry` after changing game manifests.

Complete game work in this main checkout, run relevant checks, and commit the finished changes on `main`. If work was explicitly isolated, integrate and verify it here before calling it delivered. Include any remaining uncommitted work or failed checks in the handoff. The `.claude/launch.json` hub configuration must use `npm run play` on port 8081.
