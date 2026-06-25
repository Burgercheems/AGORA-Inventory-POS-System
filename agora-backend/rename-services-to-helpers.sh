#!/bin/bash
# Run from agora-backend/ root.
# Renames src/services -> src/helpers and rewrites every import across the codebase.
# Uses `git mv` so the rename shows up as a rename in git history, not a delete+add.

set -e

cd src

echo "Renaming folder..."
git mv services helpers

echo "Renaming individual files (services.ts -> helpers.ts naming, if any use that suffix)..."
# If your service files are named like auth.service.ts, this keeps that convention
# inside the new helpers folder. If you instead want auth.helper.ts naming, see note at bottom.

cd ..

echo "Rewriting imports across the codebase..."
# Matches: from '../services/xxx', from './services/xxx', require('../services/xxx'), etc.
grep -rl --include=\*.ts "services/" src | while read -r file; do
  sed -i "s#\([\"'(]\.\.\?/\)services/#\1helpers/#g" "$file"
  echo "  updated: $file"
done

echo ""
echo "Done. Now run:"
echo "  npx tsc --noEmit     # check nothing broke"
echo "  git status            # confirm files show as 'renamed:' not 'deleted' + 'new file'"
echo ""
echo "NOTE: file names themselves (auth.service.ts) were NOT changed, only the folder."
echo "If you also want files renamed to *.helper.ts, run this separately inside src/helpers:"
echo "  for f in *.service.ts; do git mv \"\$f\" \"\${f%.service.ts}.helper.ts\"; done"
echo "...and re-run the import rewrite step with 's#service#helper#g' added."
