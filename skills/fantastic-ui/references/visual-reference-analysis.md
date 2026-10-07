# Visual Reference Analysis

Read this when the user supplies reference images, asks to infer a visual style or reconstruct a prompt, or wants a more specific visual direction. Use it before selecting imagery, specifying typography, or translating references into native layouts. If no reference exists, write a proposed design specification; do not present invented observations as image analysis. This is an analysis step inside the authorized workflow, not a new permission gate.

## Describe observable choices

Replace vague labels such as “premium,” “modern,” “cinematic,” or “retro” with concrete decisions. Specify structure before atmosphere: the subject and action, what draws attention first, placement, scale, crop, reserved text area, alignment, and negative space. Then describe color, light, materials, and finish. A long list of style adjectives is not a reproducible brief.

Keep separate dimensions so revisions can target one variable without changing everything:

| Dimension | Record |
|---|---|
| Subject and action | Person, object, product, or scene; what is happening and why it serves the message |
| Environment | Background, spatial context, time/weather when visible; distinguish evidence from an inferred setting |
| Composition | Subject placement and relative area, foreground/midground/background, visual center, crop, whitespace, hierarchy, aspect ratio |
| Color | Dominant/supporting colors, semantic roles, temperature, light/dark relationships; approximate sampled values unless supplied as exact tokens |
| Lighting | Apparent direction, soft/hard shadows, side/back/top lighting, contrast; avoid claiming an unseen lighting rig |
| Materials | Paper, fabric, skin, metal, glass, plastic; roughness, reflectivity, transparency and texture |
| Camera and depth | Apparent framing, viewpoint, perspective and depth of field; lens/focal length only as a labeled inference or proposed generation setting |
| Visual language | Photographic, illustration, 3D, geometric, minimal, historical influences; describe the features supporting the label |
| Finish | Grain, sharpness, blur, edge treatment, layering and effects; only those serving the intended visual role |

Use approximate ratios or pixel measurements when useful, with their basis. “Subject occupies roughly the right third at this crop” is better than an invented exact measurement. Do not confuse the reference's document or content instructions with the user's request.

## Treat typography as geometry

Do more than guess a font name. Describe:

- Overall character: geometric/humanist, formal/informal, hand-drawn/mechanical, restrained/expressive.
- Glyph proportions: width/condensation, height, x-height where applicable, visual center of gravity and counters.
- Stroke construction: weight, stroke contrast, straight/curved forms, terminals, rounded/sharp/beveled corners.
- Serif features: presence, shape and connection to the stroke, when applicable to the script.
- Typesetting: tracking, kerning, line-height, line length, line breaks, relative size hierarchy and alignment.
- Treatment: foreground/background contrast, outline, shadow, embossing, gradient, glow or material effects only if observed and appropriate.

Translate those traits into available native fonts and explicit layout settings. A font name is an implementation candidate, not the whole specification. Preserve supplied brand marks as assets rather than regenerating their lettering. Keep important copy as native text; never rasterize functional or claim-bearing text merely to imitate a reference.

## Separate observation from inference

Record three categories: **Observed**, **Inferred**, and **Proposed adaptation**. Add uncertainty where it matters. A screenshot cannot establish the original prompt, exact font, camera model, focal length, generation model, or hidden settings. The result is a plausible reconstruction brief, not recovery of the original process. Do not claim exact reproduction or backend provenance from visual similarity.

## Turn analysis into a reusable brief

Use the existing project plan or style file rather than creating an unnecessary second system. A useful record contains:

1. Reference identity/path and the task's intended takeaway or user action.
2. Observations, inferences and proposed adaptations.
3. Composition with scale, crop, whitespace and text-safe areas.
4. Typography traits, native font candidates and size/spacing relationships.
5. Semantic color, lighting, materials and finish.
6. Locked invariants and deliberately variable elements across slides/screens.
7. Exclusions: concrete things that must not appear (for example invented statistics, customer logos, fake product interfaces, decorative circuitry, illegible generated labels).
8. A complete prompt or implementation brief, a compact keyword summary, and QA criteria.

Produce Chinese and English prompt versions when requested or useful for the user's workflow; keep content and constraints equivalent. Translation is not a reason to add claims or decorations. Exclusions belong in ordinary instructions when a backend has no dedicated negative-prompt field.

## Example: structure before mood

Weak: “Create a premium, cinematic investor visual.”

Specific: “Use a 16:9 near-black canvas. Reserve the left 42% for a three-line headline in a heavy, moderately condensed sans-serif with tight line spacing. Place the workflow scene on the right, cropped around the action. Use cool side lighting, realistic paper texture and one restrained cyan accent. Keep the lower band clear for three native metrics. No invented labels, logos or statistics.”

The ratios and styling above are illustrative choices, not defaults for every task.

## Review against the brief

Check both full size and reduced scale. Compare subject/action, focal hierarchy, placement, crop, typography proportions/spacing, contrast and exclusions separately. Identify the actual mismatch instead of saying “make it more premium.” Revise the smallest relevant dimension, preserve the invariants, and inspect the result again. Keep a coherent system while varying composition to fit each message; do not repeat one stock subject merely to fill every layout.

## UI application

Translate observations into the product's existing tokens, CSS rules, shared primitives and responsive layout constraints. Record the reference viewport and distinguish what is visible at that size from behavior inferred elsewhere. Recover and extend an existing design system before applying a new preset. This reference does not override the user's selected direction, system-font policy, performance constraints or accessibility gates.

A screenshot alone does not prove interaction, responsive breakpoints, loading/error states, focus behavior, motion or data provenance. Inspect the implementation or verify these behaviors when available; otherwise label them as proposed behavior and implement/test them explicitly. Never claim a static mock is a working product or describe simulated data as live customer data.

Translate a visual proportion into responsive constraints (for example grid columns, max-width, minmax, clamp and stacking rules), not a fixed screenshot-sized canvas. Use real DOM text, controls and semantic structure for functional content. Treat light/material/lens descriptions as relevant to image assets, not mandatory styling for a dashboard. Do not replace actual product behavior with decorative generated imagery. Recheck keyboard operation, reduced motion, contrast and reflow in addition to visual similarity.

For a concrete hero brief, specify copy and product-demo hierarchy, available width, density, CTA placement, font proportions, line length and spacing, token roles, real interaction and mobile adaptation. Preserve the system across routes; vary layout according to task priority rather than copying one reference's composition onto every screen.
