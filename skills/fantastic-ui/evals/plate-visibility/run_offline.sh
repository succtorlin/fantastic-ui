#!/usr/bin/env bash
# Mechanical half of the plate-visibility eval: no LLM, no browser, no network.
#
#   bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh      (from the repo root)
#   PYTHON=/path/to/python3 bash skills/fantastic-ui/evals/plate-visibility/run_offline.sh
#
# Steps (one PASS/FAIL line each, non-zero exit if any fails):
#   1. the trap: tokens mapped with the darker --well first + --page = the real
#      page colour  ->  plate refuses, exit 1, error "page_mismatch", no file
#   2. a well-based plate scores below the visibility floor under header-band
#      (score exit 4); the same seed on the page-first palette passes
#   3. batch --dry-run, then a real batch into a temp copy of this eval:
#      exit 0, one ledger row per plate, sha256 matches, files <= max_kb
#   4. node --test on plate-check.test.mjs (skipped when node is missing)
set -euo pipefail

EVAL_REL="skills/fantastic-ui/evals/plate-visibility"
GEN_REL="skills/fantastic-ui/scripts/gen_atmosphere.py"
CHECK_TEST_REL="skills/fantastic-ui/scripts/plate-check.test.mjs"

if [[ ! -f "$GEN_REL" || ! -f "$EVAL_REL/manifest.json" || ! -f "$EVAL_REL/fixture/tokens.css" ]]; then
  echo "run_offline.sh: run me from the fantastic-ui repo root (the directory that contains skills/)." >&2
  echo "  cwd is $PWD; expected ./$GEN_REL and ./$EVAL_REL/manifest.json here." >&2
  exit 2
fi

ROOT="$PWD"
PY="${PYTHON:-python3}"
GEN="$ROOT/$GEN_REL"
TOKENS_CSS="$ROOT/$EVAL_REL/fixture/tokens.css"

if ! command -v "$PY" >/dev/null 2>&1; then
  echo "run_offline.sh: python not found ($PY); set PYTHON=/path/to/python3" >&2
  exit 2
fi

TMPROOT="${TMPDIR:-/tmp}"
TMP="$(mktemp -d "${TMPROOT%/}/plate-eval.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

FAILS=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n      %s\n' "$1" "$2"; FAILS=$((FAILS + 1)); }
skip() { printf 'SKIP  %s\n' "$1"; }

# token value from the fixture, e.g. tok --ground -> #0a0907
tok() { sed -n "s/^[[:space:]]*$1:[[:space:]]*\(#[0-9a-fA-F]\{3,8\}\);.*/\1/p" "$TOKENS_CSS" | head -n1; }

# jq-free JSON probe: jq_py FILE 'python expression over d' -> prints the result
jq_py() { "$PY" -c 'import json,sys; d=json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$1" "$2"; }

# one-line summary of a captured run: its stdout JSON, else the tail of stderr
show() {
  if [[ -s "$1" ]]; then head -c 600 "$1" | tr '\n' ' '
  else tail -n 3 "$1.err" 2>/dev/null | tr '\n' ' '; fi
}

# run the generator; stdout -> $1, stderr -> $1.err, sets RC
gen() {
  local out="$1"; shift
  RC=0
  "$PY" "$GEN" "$@" >"$out" 2>"$out.err" || RC=$?
}

PAGE="$(tok --ground)"; WELL="$(tok --well)"; PANEL="$(tok --panel)"; HAIR="$(tok --hair)"
ACCENT="$(tok --accent)"; ACCENT_HI="$(tok --accent-hi)"
if [[ -z "$PAGE" || -z "$WELL" || -z "$ACCENT" ]]; then
  echo "run_offline.sh: could not read --ground/--well/--accent from $TOKENS_CSS" >&2
  exit 1
fi
WELL_FIRST="$WELL,$PAGE,$PANEL,$HAIR,$ACCENT,$ACCENT_HI"
PAGE_FIRST="$PAGE,$PANEL,$HAIR,$ACCENT,$ACCENT_HI"
# Same render settings as manifest.json's defaults. Seed 11 is a well-first plate
# that is ~76% darker than the page and lands far under the header-band floor;
# NOTE some other well-first seeds scrape past 8/1 on their bright accent alone,
# which is why the page_mismatch guard (step 1) exists at all.
RENDER=(--style warp --seed 11 --size 1600x320 --intensity 1.0 --focus 0.70,0.45)

# ---------------------------------------------------------------- step 1 ----
step1() {
  local name="1 trap: well-first tokens + --page refuses with page_mismatch"
  gen "$TMP/s1-tokens.out" tokens --css "$TOKENS_CSS" --selector ':root' \
      --map "ground=--well,ground2=--ground,ground3=--panel,accent=--accent,accentHi=--accent-hi" \
      --out "$TMP/trap-tokens.json"
  if [[ $RC -ne 0 ]]; then fail "$name" "tokens (the naive mapping) exited $RC: $(show "$TMP/s1-tokens.out")"; return; fi

  gen "$TMP/s1-plate.out" plate --tokens "$TMP/trap-tokens.json" --page "$PAGE" \
      "${RENDER[@]}" --out "$TMP/trap.webp"
  if [[ $RC -ne 1 ]]; then fail "$name" "plate --page $PAGE on well-first tokens exited $RC, want 1: $(show "$TMP/s1-plate.out")"; return; fi
  local err; err="$(jq_py "$TMP/s1-plate.out" 'd.get("error")' 2>/dev/null || true)"
  if [[ "$err" != "page_mismatch" ]]; then fail "$name" "error was '$err', want page_mismatch: $(show "$TMP/s1-plate.out")"; return; fi
  if [[ -e "$TMP/trap.webp" ]]; then fail "$name" "a refused plate still wrote $TMP/trap.webp"; return; fi

  # the same hole through --palette
  gen "$TMP/s1-pal.out" plate --palette "$WELL_FIRST" --page "$PAGE" \
      "${RENDER[@]}" --out "$TMP/trap2.webp"
  err="$(jq_py "$TMP/s1-pal.out" 'd.get("error")' 2>/dev/null || true)"
  if [[ $RC -ne 1 || "$err" != "page_mismatch" ]]; then fail "$name" "--palette well-first + --page: exit $RC error '$err', want 1 page_mismatch"; return; fi

  # control: the page-first palette with the same --page is NOT refused
  gen "$TMP/s1-ok.out" plate --palette "$PAGE_FIRST" --page "$PAGE" \
      "${RENDER[@]}" --out "$TMP/ok.webp"
  if [[ $RC -ne 0 ]]; then fail "$name" "control (page-first palette) exited $RC, want 0: $(show "$TMP/s1-ok.out")"; return; fi
  pass "$name (exit 1, page_mismatch; page-first control exit 0)"
}

# ---------------------------------------------------------------- step 2 ----
step2() {
  local name="2 a well-based plate fails score under header-band"
  # no --page here on purpose: this is what an author who never declared the
  # page would ship. --allow-faint because its own gate measures vs the well.
  gen "$TMP/s2-well.out" plate --palette "$WELL_FIRST" "${RENDER[@]}" \
      --out "$TMP/well.webp" --allow-faint
  if [[ $RC -ne 0 || ! -f "$TMP/well.webp" ]]; then fail "$name" "rendering the well-based plate exited $RC: $(show "$TMP/s2-well.out")"; return; fi

  gen "$TMP/s2-score.out" score --plate "$TMP/well.webp" --page "$PAGE" \
      --slot 1424x96 --scrim header-band --fit cover
  if [[ $RC -ne 4 ]]; then fail "$name" "score exited $RC, want 4: $(show "$TMP/s2-score.out")"; return; fi
  local vis; vis="$(jq_py "$TMP/s2-score.out" '"%s/%s pass=%s" % (d["visibility"]["ge_1_1"], d["visibility"]["ge_1_3"], d["pass"])' 2>/dev/null || echo '?')"
  if [[ "$vis" != *"pass=False" ]]; then fail "$name" "score exit 4 but JSON says $vis"; return; fi

  # control: the page-first plate (step 1's ok.webp) passes the same slot
  gen "$TMP/s2-ok.out" score --plate "$TMP/ok.webp" --page "$PAGE" \
      --slot 1424x96 --scrim header-band --fit cover
  local okvis; okvis="$(jq_py "$TMP/s2-ok.out" '"%s/%s" % (d["visibility"]["ge_1_1"], d["visibility"]["ge_1_3"])' 2>/dev/null || echo '?')"
  if [[ $RC -ne 0 ]]; then fail "$name" "control: page-first plate scored exit $RC ($okvis), want 0"; return; fi

  # and the old full-width scrim hides even the good plate
  gen "$TMP/s2-full.out" score --plate "$TMP/ok.webp" --page "$PAGE" \
      --slot 1424x96 --scrim full --fit cover
  local fullvis; fullvis="$(jq_py "$TMP/s2-full.out" '"%s/%s" % (d["visibility"]["ge_1_1"], d["visibility"]["ge_1_3"])' 2>/dev/null || echo '?')"
  if [[ $RC -ne 4 ]]; then fail "$name" "full-width scrim on the good plate scored exit $RC ($fullvis), want 4"; return; fi

  pass "$name (well $vis; page-first $okvis; page-first under full scrim $fullvis — ge_1_1/ge_1_3 %)"
}

# ---------------------------------------------------------------- step 3 ----
step3() {
  local name="3 batch --dry-run, then a real batch into a temp copy"
  local proj="$TMP/proj"
  mkdir -p "$proj/$EVAL_REL"
  cp -R "$ROOT/$EVAL_REL/fixture" "$proj/$EVAL_REL/fixture"
  cp "$ROOT/$EVAL_REL/manifest.json" "$proj/$EVAL_REL/manifest.json"
  local man="$EVAL_REL/manifest.json"
  local out_dir ledger n_plates
  out_dir="$(jq_py "$proj/$man" 'd["out_dir"]')"
  ledger="$(jq_py "$proj/$man" 'd["ledger"]')"
  n_plates="$(jq_py "$proj/$man" 'len(d["plates"])')"

  RC=0
  (cd "$proj" && "$PY" "$GEN" batch --manifest "$man" --dry-run) >"$TMP/s3-dry" 2>"$TMP/s3-dry.err" || RC=$?
  if [[ $RC -ne 0 ]]; then fail "$name" "dry-run exited $RC: $(show "$TMP/s3-dry")"; return; fi
  if [[ -e "$proj/$ledger" ]] || { [[ -d "$proj/$out_dir" ]] && [[ -n "$(ls -A "$proj/$out_dir")" ]]; }; then
    fail "$name" "--dry-run wrote files ($ledger or $out_dir)"; return
  fi

  RC=0
  (cd "$proj" && "$PY" "$GEN" batch --manifest "$man") >"$TMP/s3-run" 2>"$TMP/s3-run.err" || RC=$?
  if [[ $RC -ne 0 ]]; then fail "$name" "batch exited $RC: $(show "$TMP/s3-run")"; return; fi

  local verdict
  verdict="$("$PY" - "$proj" "$man" <<'PYEOF'
import hashlib, json, os, sys
proj, man = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(proj, man)))
max_kb = m.get("defaults", {}).get("max_kb", 30)
ledger = os.path.join(proj, m["ledger"])
problems = []
if not os.path.isfile(ledger):
    print("FAIL no ledger at " + m["ledger"]); sys.exit()
rows = [json.loads(l) for l in open(ledger) if l.strip()]
if len(rows) != len(m["plates"]):
    problems.append("ledger has %d rows for %d plates" % (len(rows), len(m["plates"])))
outs = [r.get("out", "") for r in rows]
if outs != sorted(outs):
    problems.append("rows not sorted by out")
summary = []
for r in rows:
    out = r.get("out", "")
    for k in ("ts", "argv", "raw"):
        if k in r:
            problems.append("%s: row carries %r" % (out, k))
    if os.path.isabs(out):
        problems.append("%s: out is absolute" % out)
    path = os.path.join(proj, out)
    if not os.path.isfile(path):
        problems.append("%s: file missing" % out); continue
    size = os.path.getsize(path)
    if size > max_kb * 1024:
        problems.append("%s: %d bytes > %d KB" % (out, size, max_kb))
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if r.get("sha256") != sha:
        problems.append("%s: sha256 mismatch" % out)
    sv = r.get("slotVisibility") or {}
    g11, g13 = sv.get("ge_1_1"), sv.get("ge_1_3")
    if g11 is None or g13 is None:
        problems.append("%s: no slotVisibility" % out)
    elif g11 < 8 or g13 < 1:
        problems.append("%s: slotVisibility %s/%s under the 8/1 floor" % (out, g11, g13))
    summary.append("%s %s %.1fKB %s/%s" % (os.path.basename(out), r.get("scrim", "?"), size / 1024, g11, g13))
print(("FAIL " + "; ".join(problems)) if problems else ("OK " + "; ".join(summary)))
PYEOF
)"
  if [[ "$verdict" != OK* ]]; then fail "$name" "${verdict#FAIL }"; return; fi

  # determinism: a second run leaves the ledger byte-identical
  cp "$proj/$ledger" "$TMP/ledger.first"
  RC=0
  (cd "$proj" && "$PY" "$GEN" batch --manifest "$man") >"$TMP/s3-run2" 2>"$TMP/s3-run2.err" || RC=$?
  if [[ $RC -ne 0 ]]; then fail "$name" "second batch exited $RC: $(show "$TMP/s3-run2")"; return; fi
  if ! cmp -s "$TMP/ledger.first" "$proj/$ledger"; then
    fail "$name" "second batch changed the ledger (plate entries must render deterministically)"; return
  fi
  pass "$name ($n_plates plates: ${verdict#OK })"
}

# ---------------------------------------------------------------- step 4 ----
step4() {
  local name="4 node --test plate-check.test.mjs"
  if ! command -v node >/dev/null 2>&1; then skip "$name (node not installed)"; return; fi
  if [[ ! -f "$CHECK_TEST_REL" ]]; then fail "$name" "$CHECK_TEST_REL is missing"; return; fi
  RC=0
  node --test "$CHECK_TEST_REL" >"$TMP/s4.out" 2>&1 || RC=$?
  if [[ $RC -ne 0 ]]; then fail "$name" "node --test exited $RC: $(tail -n 25 "$TMP/s4.out")"; return; fi
  pass "$name ($(grep -E '^(# |ℹ )(tests|pass|fail) ' "$TMP/s4.out" | tr '\n' ' ' | sed 's/ $//'))"
}

step1
step2
step3
step4

if [[ $FAILS -gt 0 ]]; then
  echo "plate-visibility offline eval: $FAILS step(s) failed"
  exit 1
fi
echo "plate-visibility offline eval: all steps passed"
