# M1-B.2 visual alignment handoff

## Reference review and decisions

Inspected all nine Stage 2 images:

- `homepage-desktop-1440.png`, `homepage-mobile-390.png`
- `studio-desktop-overview.png`, `studio-desktop-note-selection.png`, `studio-desktop-composition.png`, `studio-desktop-live-result.png`
- `studio-mobile-note-selection.png`, `studio-mobile-composition.png`, `studio-mobile-live-result.png`

The references establish an editorial Persian hero, botanical atmosphere, asymmetric whitespace, a three-area desktop Studio, faceted note tiles, and a three-step mobile flow. The current implementation already had real catalog and Studio API behavior, composition editing, saving/authentication, and retry states, but its visual hierarchy leaned on generic cards and a simple vessel. The Figma views omit API loading/error/empty states, focus and keyboard behavior, six-note handling, and save/login states. The mobile reference's persistent action area can obscure content, and its note tiles are too dense to adopt literally.

The implementation keeps the editorial hero, botanical line art, and three Studio areas; it reshapes the mobile selection area into readable faceted buttons, with two columns on narrow phones and three on tablet widths. The Notes / Composition / Result tabs stay available while browsing the library, show the current selection count, and do not use a bottom overlay. Layered composition zones make top/heart/base assignments visible. The local SVG vessel changes atmosphere using only the selected notes' backend family labels and layer arrangement. Family-to-mood mapping is deliberately presentation-only and unknown labels stay neutral. Product visuals are labeled conceptual placeholders. No Figma imagery was copied into the application.

Missing reference states were completed from the existing API behavior and accessible UI patterns; they are not attributed to Figma. No approved product photography, official logo asset, or reference for error, loading, empty, keyboard-focus, and authentication states was available. The guided experience remains an honest future entry point.

## Screenshot evidence

`npm run screenshots:visual` captures homepage and real-API Studio screenshots at 320, 390, 768, and 1440 pixels to `artifacts/visual-alignment/`. It checks for 24 actual seeded notes, expected demo note names, loaded status, RTL/no horizontal overflow, and browser/API errors before saving. Studio files show the loaded Notes view, one selected note, notes placed across three layers, six selected notes, and the named Result view. On mobile, the set also captures the Notes, Composition, and Result tabs as separate full-page states. The prior `artifacts/screenshots/` screenshots remain the M1-B baseline.

## Responsive and accessibility notes

At 320 and 390 pixels the note library uses two columns with generous button hit areas; at 768 pixels it uses three columns to reduce the long scroll. When a composition has at least one selection, an in-flow “continue to composition” action follows the note list; it never overlays the last note. The Notes step also shows the live count. `npm run test:browser:responsive` checks grid count, Persian note-name sizing, final-note access, the continuation action, selection count, and keyboard movement through all three tabs at 320, 390, 768, and 1440 pixels. The step tabs remain in normal flow to avoid covering content. Buttons and inputs retain visible focus styles, controls have Persian accessible names, and reduced-motion settings suppress decorative movement. At tablet width the three desktop areas remain coordinated without horizontal page overflow; the columns collapse into a single mobile workflow at narrow widths.

## Later refinement

Useful next design inputs are approved product photography, an official logo asset, and updated Figma states for API errors/empties, saved concepts, and mobile composition. Further iteration can tune illustration detail and typography against those references without coupling the application to Figma Make. Current screenshots should be reviewed at full size; no pixel-perfect claim is made.
