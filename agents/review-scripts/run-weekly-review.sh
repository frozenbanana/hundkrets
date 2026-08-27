#!/bin/bash
# Hundkrets Weekly Product Review — Recurring Automation
# Run this every Monday morning via systemd timer or manually:
#   /home/henry/Projects/home-server/hundkrets/agents/review-scripts/run-weekly-review.sh

export PATH="$HOME/.local/share/mise/shims:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"
mkdir -p /home/henry/Projects/review-screenshots

# Run the browser audit
node weekly-review.mjs

# Generate diff vs last week (if previous report exists)
latest=$(ls -t /home/henry/Projects/review-screenshots/*_review-report.json 2>/dev/null | head -1)
previous=$(ls -t /home/henry/Projects/review-screenshots/*_review-report.json 2>/dev/null | sed -n '2p')

if [[ -n "$previous" && -f "$previous" ]]; then
  echo ""
  echo "=== Week-over-week diff ==="
  python3 -c "
import json
with open('$previous') as f: prev = json.load(f)
with open('$latest') as f: curr = json.load(f)

for key in ['landing', 'registration', 'excursionsPublic', 'explore']:
    p = prev.get('hundkrets', {}).get(key, {})
    c = curr.get('hundkrets', {}).get(key, {})
    if p != c:
        print(f'CHANGED {key}:')
        print(f'  prev: {json.dumps(p, ensure_ascii=False)[:200]}')
        print(f'  curr: {json.dumps(c, ensure_ascii=False)[:200]}')
" 2>/dev/null
fi

echo ""
echo "✅ Data collection complete. Generating AI review..."
echo "Latest report: $latest"

review_date=$(python3 -c "import json; d=json.load(open('$latest'))['date']; print(d[:10])" 2>/dev/null || date +%Y-%m-%d)
review_file="$REPO_ROOT/agents/review-${review_date}.md"
skill_file="$REPO_ROOT/agents/skills/weekly-review.md"

opencode run \
  --dangerously-skip-permissions \
  --log-level ERROR \
  --model deepinfra/google/gemma-4-31B-it \
  -f "$latest" \
  -- \
  "Load the weekly-review skill from $skill_file.
Then read the attached JSON report: $latest.
Also review all screenshots in ~/Projects/review-screenshots/ that start with the date prefix from the report.
Write a comprehensive markdown product review to $review_file.
Use the format from the skill file: quantitative metrics + delta, qualitative screenshot observations, and ranked priorities with mermaid chart.
Save the file and confirm when done.

Known false positives — do not rank these as product fires:
- Umami zeros when the host umami.henrybergstrom.com/script.js returns 200 (script is installed). Prefer API/date-range issues.
- Missing Create excursion button when the audit user was redirected to /onboarding (incomplete onboarding, not a missing feature).
- Missing Delete account button unless the audit actually opened /app/profile and scrolled to the danger zone (button text is 'Ta bort mitt konto')."

echo ""
echo "✅ AI review written to $review_file"
