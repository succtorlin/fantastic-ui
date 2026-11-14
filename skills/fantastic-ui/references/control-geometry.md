# Button sizes and block alignment

Apply these rules to every surface you build or change, including marketing,
application screens, panels, responsive layouts, and overlays.

- **Buttons:** Give peer actions the same rendered width and height. Peers
  include actions in the same bar or dialog footer, repeated row or card
  actions, and segments in a control group. Use equal grid tracks, a shared
  action column, or shared inline and block size tokens. Size for the longest
  supported label and reserve the same space in busy, selected, and disabled
  states. Use the same sizing across repeated instances. Check long
  translations and zoom. Stack the group or widen its tracks when space runs
  out. Keep the labels readable and the hit areas accessible.
- **Button families:** Establish a repeated size for each role on the surface.
  Icon-only controls, inline links, and a full-width action can have their own
  geometry. If they belong to the same visual group, match outer sizes within
  that group and use styling or placement to show priority.
- **Building blocks:** Give sections, cards, panels, form fields and repeated
  rows shared alignment lines. Use one grid or give separate regions the
  same container widths, column tracks and gutters. Align both edges of
  same-span blocks and the top or bottom edges that should line up in a row.
  Intentional asymmetry still lands on the shared grid lines. Compare the
  rendered outer edges and the inner content inset when padding defines the
  visible line.
- **Verify in context:** Inspect the real route at each supported breakpoint,
  with long labels and the loading or error states visible. Include dialogs
  and repeated rows. Fix the parent grid or shared primitive when it controls
  the mismatch.

Add markers to the markup so the Fantastic UI exam measures the intended
peers at every viewport it checks. The attributes only tell the exam what
to compare. CSS or component layout props control the geometry.

| Marker | What to compare |
| --- | --- |
| `data-fui-buttons="Review actions"` on a group | The rendered width and height of its visible action buttons and button links |
| `data-fui-align-start="content"` and `data-fui-align-end="content"` on blocks | Shared inline start or end edges, including right-to-left layouts |
| `data-fui-align-top="summary"` and `data-fui-align-bottom="summary"` on blocks | Shared top or bottom edges for a row that remains a row at the examined sizes |

Use the same edge name only for elements that share that edge at the
examined widths. For layouts that collapse between rows and columns, mark
edges that remain shared and inspect the remaining edges in the appropriate
layout. Place a button marker on the common parent of repeated peer actions
and keep unrelated controls in separate groups. The exam reports differences
over 1 CSS pixel. Use `--dialog` to open and check a marked dialog and repeat
the checks in any other interactive state the exam does not open.
