---
name: verify
description: Run build check to catch syntax errors and broken imports. Use after implementing features or fixing bugs.
---

Run the following verification steps and report results:

1. **Build check**: Run `npm run build` in the project root. Report any errors.
2. **Quick scan**: If build succeeds, grep for common issues in changed files:
   - `console.log` statements that should be removed
   - Unused imports
   - References to undefined variables or missing JSON keys
3. **Data integrity**: If any `src/data/*.json` files were modified, validate they parse correctly.

Report a pass/fail summary. On failure, list each issue with file path and line number.
