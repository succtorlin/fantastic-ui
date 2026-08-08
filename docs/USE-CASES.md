# fantastic-ui — use-case walkthroughs

The [README](../README.md) explains what the skill is. This page shows **how a session actually goes**, scenario by scenario: what to say, what the skill will do, what it will ask you, what you get at the end, and how to steer it. Every walkthrough assumes the skill is installed per the README and that you're talking to Claude Code in a repo.

A note on posture: this skill is opinionated on purpose. It will ask you to approve a one-sentence brief before writing code, it will refuse to mix two theme presets in one app, and it will not call a page done until the ship gates pass. If you want a quick uncommitted mockup, say so explicitly — otherwise you get the full discipline.

---

## 1. Landing page from scratch

**Say something like:**

> Build a landing page for my API monitoring tool. Real product, real data — don't make it look like a template.

**What happens, in order:**

1. **Preset check (silent unless it matters).** The skill scores your request against the eleven presets' signal table. Three outcomes: it adopts one and tells you in a line ("Using Blueprint Mono: developer tool, mono-heavy, light ground"); it asks a short question if two presets tie; or it declines all eleven and writes a fresh brief — data-dense analytics/finance products always get the fresh dark-instrument treatment, never a preset that merely happens to be dark.
2. **The one-sentence brief — your first approval gate.** Before any code you'll see something like: *"Light blueprint ground, single signal-orange accent, grid-paper texture, mono display over system sans, uptime data as the hero."* Everything downstream is judged against this sentence, so push back here, not at the end.
3. **Tokens first.** A single token block (ground scale, hairlines, ink scale, one accent, semantics, three type faces) is committed before any component. This is deliberate: color literals outside the token file are banned and grep-enforced.
4. **The hero is the product running.** Expect a `<canvas>` mini-instance, a live-data band, or a working interactive fragment — never a screenshot in a tilted browser frame. The canvas comes with its lifecycle contract: DPR-aware, RAF verifiably stops when the tab hides, one static frame under `prefers-reduced-motion`, full cleanup.
5. **Sections with rhythm.** Alternating texture bands (stat tape, explainer, asymmetric bento, atmosphere band, interactive toggle, honest fine print) instead of three uniform card rows. Copy is part of the review: concrete numbers in, hype adjectives out ("revolutionary", "seamless" are banned by the checklist).
6. **Gates, then done.** The accessibility phase (see §4) and the ship checklist run before the skill declares the page finished. If a gate fails, it fixes and re-runs — you don't have to ask.

**You get:** one page, zero webfonts, zero new dependencies, assets ≤ 30 KB each, keyboard-operable, axe-clean at WCAG 2.2 AA, and a hero a visitor can watch working.

**How to steer:** name a preset up front ("use Marigold Report") to skip the check; say "match our existing brand" and the skill will recover tokens from your CSS instead of inventing any; say "mockup only, skip the gates" if you genuinely want a sketch.

---

## 2. Restyle one app page or panel

**Say something like:**

> The settings page looks bolted-on. Restyle it to match the rest of the app.

**What happens:**

1. **Audit before opinion.** The skill inventories what already exists — token files, type faces, panel patterns, and a grep baseline of stray color literals. If your app already has a design system, the skill *recovers its brief* and extends it; it will not write a competing one.
2. **Tokens-first mechanical commit.** Hardcoded colors on the target surface are swapped for existing tokens with zero visual change intended — a separate, boring, reviewable commit.
3. **Migration onto the shared panel anatomy.** Mono eyebrow header, hairline separation instead of boxes-in-boxes, actions on the right, subpanel depth encoded by ground-scale steps (max three levels, no stacked shadows).
4. **States get designed, not inherited.** Loading skeletons on the ground scale, honest empty states, error red confined to actual errors, stale-data timestamps where data can age.
5. **Cross-screen gate.** The accent must mean the same thing here as on every other screen; focus rings identical; density comparable to sibling panels. Before/after screenshots are captured as evidence.

**You get:** one PR per screen, a grep that proves zero color literals outside the token file, and a panel that looks like it was always part of the app.

**Pitfall to avoid:** don't ask for "just make this one page pretty" with a different palette — the one-accent-per-app rule is one of the things the skill will push back on rather than silently obey.

---

## 3. Whole-app sweep ("polish everything, miss nothing")

**Say something like:**

> Apply this style across the entire app. Every page, every panel, every modal. Don't miss anything.

**What happens:** the recursive-polish mode wraps the §2 procedure in coverage mechanics:

1. **Inventory from the code, not from memory.** Every route file, every layout, and every overlay — modals, drawers, toasts, dropdown menus, command palettes — found by walking import trees recursively. Shared components are deduplicated into single work items. The skill will not accept "we have about 12 pages" as an inventory.
2. **Prior-art reconciliation.** Existing token systems are recovered, existing style-guard tests are extended (not paralleled), and dual-theme apps get one token vocabulary with light/dark values per token, contrast-validated in both.
3. **Batched migration with a ledger.** Work proceeds in batches of 3–5 surfaces: polish → gate → commit → ledger update. The ledger is a file, so a sweep that spans days or multiple Claude sessions resumes exactly where it stopped — start a new session with "continue the fantastic-ui sweep" and it reads the ledger.
4. **Loop until dry.** The job ends only when a *fresh* re-inventory finds zero unpolished surfaces and the mechanical proofs pass (zero color literals, zero axe critical/serious). Anything intentionally skipped is recorded as explicitly deferred — never silently dropped.

**You get:** provable coverage. The classic failure of "polish everything" jobs — the forgotten modals — is structurally impossible because overlays are inventory items.

**How to scope it:** you can bound the sweep ("sweep only the dashboard section", "marketing pages excluded") and the ledger will record the boundary as a deferral, so a later sweep can pick it up.

---

## 4. Accessibility audit and remediation (WCAG 2.2 AA)

**Say something like:**

> Run a WCAG audit on the app and fix what fails.

This module is valuable even if you never touch the visual design — it's a standalone check-and-fix procedure.

**What happens:**

1. **Token contrast matrix first.** Every ink×ground and accent×ground pair — including semantic tint backgrounds, which count as grounds — is validated once with a runnable script (4.5:1 body text, 3:1 large text / UI boundaries / focus rings, opacity compounding included in the math). A failing pair is fixed **in the token**, so every screen inherits the fix; you never patch the same contrast bug per-page.
2. **Automated sweep** with axe-core (`wcag2a`/`wcag2aa`/`wcag22aa` tags) plus Lighthouse — against the surfaces that actually render, in every designed state (loading, empty, error, locked), not against dead code or an error shell.
3. **The part automation can't do:** four manual passes — keyboard, screen reader, reduced motion, and 320 px / 200 % reflow.
4. **Triage with honest semantics.** `violations` and `incomplete` are treated differently: critical/serious violations block the ship; every `incomplete` node gets *measured by hand and recorded* (on one real audit, "0 violations + 14 incomplete" concealed 9 genuine AA failures).
5. **Fix on-system, re-audit to zero blockers.** Fix patterns are keyed to the design system: two-layer focus rings, semantic-color text variants, ≥ 24 px target sizes, `aria-live` on refreshing panels. Each fixed bug class gets a mutation-tested regression guard.

**Hard rules you'll see enforced:** never dim text with `opacity-*` (it compounds through nesting and blinds axe); never fake structure with ARIA roles that announce wrong coordinates; never remove a dimming that encodes state without a replacement channel.

**You get:** an audit trail (matrix results, axe output, per-`incomplete` measurements), fixes committed at the token/primitive level, and regression tests that have actually been shown to go red.

---

## 5. Choosing a direction with theme presets

**Say something like:**

> Which preset fits a scheduling product for universities? — or — Start the marketing site in Charter Navy.

**What's on the shelf:** eleven named directions — Coastal Editorial, Blueprint Mono, Marigold Report, Atelier Warm, Terracotta Commerce, Midnight Showroom, Broadcast Light, Studio Kinetic, Campus Bright, Charter Navy, Dispatch Yellow. Nine light-ground, two dark, each shipping a one-sentence brief, a contrast-validated token block, and the component grammar that makes the direction read.

**How selection really works:** it's a workflow gate, not a menu. Named preset → used. Existing token system in the codebase → **no preset** (the existing brief is recovered and extended). Otherwise the request is scored against a signal table (medium, domain, imagery, density) with per-preset disqualifiers; a half-fit is *refused* in favor of a fresh brief, because a stretched preset produces exactly the template output this skill exists to prevent.

**The two hard rules:** one preset per application (your marketing site may diverge from your app; screens inside one app may not), and presets are token sets, not component libraries.

---

## 6. Advanced: live heroes and atmosphere assets

Two reference modules you can invoke by name when the job calls for them:

- **Canvas hero** (`references/canvas-hero.md`) — a fully annotated live-canvas hero with the complete lifecycle contract, plus card sparklines and scroll reveals. Ask: *"give the hero a live canvas like the RRG example."*
- **AI atmosphere** (`references/ai-atmosphere.md`) — AI-generated atmosphere backgrounds done reproducibly: a prompt recipe and a committed pipeline script that compresses to a ≤ 30 KB webp. The asset is regenerable, not a mystery PNG. Ask: *"add an atmosphere band behind the stats section."*

---

## FAQ

**Can I use it with Vue/Svelte/plain HTML?** Yes — the worked code is React + CSS modules, but the disciplines and most of the CSS transfer directly.

**Will it fight my existing design system?** The opposite: detecting an existing token system is an explicit gate that *disables* preset selection and recovers your brief. The skill extends what you have.

**What if I disagree with a rule?** Say so in the conversation — the disciplines are flexible in application (light vs dark, dense vs airy). Four things don't flex: one accent per app, semantic color only with meaning, zero webfonts, and gates before ship. If you need to break one, the skill will do it visibly, not silently.

**How long does a whole-app sweep take?** It's batched and ledger-resumable by design — plan on multiple sessions for a real app, with a commit after every 3–5 surfaces and a provable "dry" end state.

**Where do I start if I'm skeptical?** Use case 4. Run the accessibility audit on one page — it's read-mostly, produces evidence, and shows you the skill's standard of proof before you let it touch your visuals.
