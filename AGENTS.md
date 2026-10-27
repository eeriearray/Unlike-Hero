# Main game hub

The canonical working checkout is this repository root on `main`. The user plays at http://localhost:8081. Make game changes here unless the user explicitly requests an isolated checkout. Do not launch a competing hub from `.claude/worktrees/` or the legacy `Unlike-Hero/` folder. Preserve those copies as historical work; do not delete or blindly merge them.

Use `npm run play` / `Start Hub.command` to launch the primary checkout on port 8081. Do not silently choose a different port. `npm start` also defaults to 8081 and watches imported server modules for changes. Refresh the browser after client changes; a backend restart ends active rooms. Run `npm run registry` after changing game manifests.
