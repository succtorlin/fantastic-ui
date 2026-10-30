#!/usr/bin/env node
/**
 * lint-hook.mjs: a Claude Code PostToolUse hook that runs lint-surface on each
 * file the agent writes or edits, so a surface failure is caught at the edit
 * instead of at the exam.
 *
 * It acts only inside a fantastic-ui project: a directory at or above the
 * edited file holds a `.fantastic-ui` marker file (the skill creates it when a
 * build starts). Everywhere else it exits 0 without reading the file.
 *
 *   settings.json:
 *   { "hooks": { "PostToolUse": [ { "matcher": "Write|Edit|MultiEdit",
 *       "hooks": [ { "type": "command",
 *         "command": "node ~/.claude/skills/fantastic-ui/scripts/lint-hook.mjs" } ] } ] } }
 *
 * Reads the hook payload (JSON) on stdin. Exit 0: nothing to say. Exit 2: the
 * findings go to stderr, which Claude Code shows to the agent. Run-level rules
 * (reduced motion, sticky, fake send, mono material) need the whole run, and
 * local references may point at files not written yet, so those are left to
 * the exam. Copy rules apply to markup and components, not to plain .js/.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lint } from "./lint-surface.mjs";

export const MARKER = ".fantastic-ui";
export const RUN_LEVEL = new Set(["reduced-motion-missing", "overflow-hidden-kills-sticky", "two-sticky-top0", "form-goes-nowhere", "mono-as-costume", "dead-local-ref", "root-relative-ref"]);
const COPY = new Set(["copy-buzzword", "copy-em-dash", "placeholder-proof", "logo-wall-claim", "button-label-vague"]);
const PLAIN_SCRIPT = new Set([".js", ".mjs", ".cjs", ".ts"]);
const EXT = new Set([".css", ".scss", ".pcss", ".html", ".htm", ".vue", ".svelte", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);

/** The project root holding the marker, or null when the file is outside any fantastic-ui project. */
export function projectRoot(file) {
  for (let d = dirname(resolve(file)); ; d = dirname(d)) {
    if (existsSync(join(d, MARKER))) return d;
    if (dirname(d) === d) return null;
  }
}

/** Findings for one edited file, or [] when the hook has nothing to judge. */
export function check(payload) {
  const file = payload?.tool_input?.file_path ?? payload?.tool_input?.path;
  const ext = extname(file ?? "").toLowerCase();
  if (!file || !EXT.has(ext) || /(?:^|[\\/])node_modules[\\/]/.test(file) || !existsSync(file)) return [];
  const root = projectRoot(file);
  if (!root) return [];
  return lint([file], { cwd: root }).findings.filter((f) => !RUN_LEVEL.has(f.rule) && !(PLAIN_SCRIPT.has(ext) && COPY.has(f.rule)));
}

export function format(findings) {
  return [`fantastic-ui lint-surface: ${findings.length} finding(s) in the file just written. Fix them now, or suppress one with a reason (lint-surface-allow: <rule> - <why>).`,
    ...findings.map((f) => `  ${f.severity} ${f.rule}  ${f.file}:${f.line}  ${f.message}`)].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let payload = null;
  try { payload = JSON.parse(readFileSync(0, "utf8") || "null"); } catch { process.exit(0); }
  let findings;
  try { findings = check(payload); } catch (e) { console.error(`fantastic-ui lint-hook: ${e.message}`); process.exit(0); }
  if (!findings.length) process.exit(0);
  console.error(format(findings));
  process.exit(2);
}
