# M1-C.1 — Guided Studio Product Specification

**Status:** Product and implementation proposal; not implemented.
**Scope:** Persian-first six-step preference journey and conceptual recommendation, using the existing M1-A API.
**Audience:** Product owner, design, frontend, QA.

## 1. Product intent and boundaries

Guided Studio helps a visitor turn optional fragrance and atmosphere preferences into an editable **conceptual fragrance composition**. It should feel like a calm conversation in an atelier: one clear question at a time, expressive but plain Persian, and a result that shows how the visitor's choices informed it. It is not a personality test, scientific assessment, safety tool, or claim about a finished perfume.

The visitor can begin anonymously, answer six steps, move backward without losing answers, see a deterministic explanation, refine the proposed notes, then save through the existing private concept flow after signing in. The existing Creative Studio remains the open-ended creation mode. Guided Studio is the structured starting point; both ultimately produce the same `name` plus note UUID/layer/position concept payload.

There are six steps. Step six combines review with a meaningful “familiar ↔ discovery” preference. The name field and answer summary live on that step, while the discovery choice changes candidate ranking. Reviewing earlier steps is available from the summary. No seventh questionnaire step is introduced.

### Established requirements

- Persian, RTL, Vazirmatn, responsive AROMAN design language; anonymous participation; six steps; real API note/family records; maximum six unique notes; existing cookie session and CSRF behavior for saves.
- The backend persists fragrance concepts only. It does not accept questionnaire answers and has no recommendation endpoint.
- Public SMS delivery currently returns unavailable (503); there is no public OTP code or bypass.
- Recommendations are conceptual. The current catalog has 24 explicitly demo notes in six demo families, but production catalog contents may differ.

### Design assumptions proposed here

- Family-to-mood mappings and the ranking weights in `M1C1_RECOMMENDATION_RULES.md` are editorial product rules, not factual scent science.
- Default result size is four notes; user may refine to a maximum of six using Creative Studio controls.
- Questionnaire answers and draft are memory-only in V1. Refresh restarts the session; no questionnaire data is sent to analytics or stored server-side.
- “Familiar / balanced / exploratory” controls breadth of family matching, not product novelty or a measured personality trait.

## 2. Journey overview

1. **Feeling** — choose the atmosphere the visitor hopes to express.
2. **Fragrance worlds** — select one or two actual families returned by FastAPI.
3. **Sensory temperature** — choose a subjective preference: bright, soft, or warm.
4. **Scene** — select an evocative scene. This is an editorial bridge to families, not a claim that a scene has verified notes.
5. **Notes you welcome or avoid** — optionally choose actual catalog notes.
6. **Review and discovery** — choose how close or exploratory the suggestion should be, review answers, and optionally name the concept.

An answer is required in steps 1–4 and 6. Step 5 is optional; “فعلاً انتخابی ندارم” is an explicit valid answer. A visitor can go back at any time. Continue is disabled until the step's required input is valid; the page also explains what is needed in Persian. The progress indicator shows current step and total; it is not a timer or score.

## 3. Detailed step specification and Persian copy

Shared controls: header has a back action after step 1, “مرحلهٔ X از ۶” and an accessible progress indicator. Buttons are `بازگشت` and `ادامه`; on step six the primary action is `دیدن پیشنهاد من`. If step 1 is current, the secondary exit link is `بازگشت به استودیوها`. Step-level loading/failure is reserved for the initial catalog request and step 5 note data; answer interactions remain local and immediate.

### Step 1 — `feeling`

- **Title:** «حال‌وهوای شما»
- **Subtitle:** «از حسی شروع کنیم که دوست دارید همراه رایحه‌تان باشد.»
- **Question:** «دوست دارید رایحهٔ شخصی‌تان بیشتر چه حسی را تداعی کند؟»
- **Options (single-select):**
  - `calm` — «آرام و آسوده» — «مثل مکثی کوتاه میان روز.»
  - `bright` — «سرزنده و روشن» — «برای شروعی سبک و پرانرژی.»
  - `confident` — «استوار و باوقار» — «حسی جمع‌وجور، گرم و مطمئن.»
  - `intimate` — «نزدیک و لطیف» — «فضایی نرم و شخصی.»
  - `curious` — «کنجکاو و ماجراجو» — «برای حال‌وهوایی با پیچ‌وخم بیشتر.»
- **Visual / interaction:** پنج کارت تصویری انتزاعی با رنگ و بافت متفاوت، بدون عکس محصول؛ کارت‌های انتخابی با علامت تیک، حاشیه و متن وضعیت همراه‌اند. Native radio group semantics; انتخاب یک مورد.
- **Required / validation:** required. Continue disabled and an inline Persian hint shown until one choice is selected. No arbitrary default.
- **Empty state:** «یک حال‌وهوا را انتخاب کنید تا ادامه دهیم.»
- **Help:** «این انتخاب فقط جهت سلیقه‌ای پیشنهاد را شکل می‌دهد؛ نتیجه یک برداشت مفهومی است.»
- **Recommendation contribution:** Adds the documented family-level editorial weights for the chosen feeling. It does not score or label the person.
- **Accessibility:** fieldset/legend; each card is a radio with complete accessible name including description; focus ring independent of color; one selection announced politely.

### Step 2 — `families`

- **Title:** «جهان‌های رایحه»
- **Subtitle:** «از خانواده‌هایی انتخاب کنید که نام یا فضای‌شان برایتان دلنشین است.»
- **Question:** «کدام جهان‌ها را دوست دارید در پیشنهادتان بیشتر ببینید؟»
- **Options:** one card per `GET /api/v1/fragrance-families` record, showing its actual Persian `name` and optional backend `description`; no manually invented family records. Current seed labels include «گلی»، «مرکباتی»، «چوبی»، «کهربایی»، «تازه» و «خوراکی».
- **Visual / interaction:** six-color sensory tiles when those six seeded families are present; neutral reusable tile for any additional family. Family color mapping is presentation-only and keyed by API `slug`; unknown slug uses neutral plum/ivory. Multi-select, maximum two. A live counter says `۱ از ۲ خانواده`.
- **Required / validation:** select 1–2. A third tap is ignored with «برای دقیق‌تر شدن پیشنهاد، حداکثر دو خانواده انتخاب کنید.» Empty selection prevents continuing. If family request errors, show retry; if API returns a valid empty array, explain that no guided suggestion can be built yet and link to Creative Studio.
- **Empty state:** «هنوز خانواده‌ای انتخاب نشده است.»
- **Help:** «خانواده‌ها دسته‌بندی‌های کلی کاتالوگ‌اند؛ نامشان برداشت کلی را نشان می‌دهد و جزئیات هر نت را تضمین نمی‌کند.»
- **Recommendation contribution:** +8 family preference weight per selected family, plus downstream weights from other answers. Selected family order is the visitor's tap order and breaks equal family scores.
- **Accessibility:** list of checkbox controls with max-selection announcement; `aria-checked`; API description is supplemental; directionally correct focus order in RTL.

### Step 3 — `temperature`

- **Title:** «دمای حسی»
- **Subtitle:** «نه دمای واقعی؛ فقط تصویری که به سلیقهٔ شما نزدیک‌تر است.»
- **Question:** «کدام توصیف به حال‌وهوای دلخواهتان نزدیک‌تر است؟»
- **Options (single-select):**
  - `bright` — «روشن و تازه» — «حسی سبک و بیدارکننده در تصور.»
  - `soft` — «نرم و متعادل» — «میانه‌ای آرام، بدون تأکید بر گرما یا تازگی.»
  - `warm` — «گرم و دربرگیرنده» — «فضایی صمیمی و عمیق در تصور.»
- **Visual / interaction:** three horizontal atmosphere bands on desktop, stacked compact cards on narrow screens; subtle gradients are backed by a text label and icon. Single select.
- **Required / validation:** required; no preselection. Continue disabled until selected.
- **Empty state:** «یکی از سه حال‌وهوا را انتخاب کنید.»
- **Help:** «این واژه‌ها توصیف سلیقه‌ای‌اند، نه اندازه‌گیری ویژگی یا عملکرد عطر.»
- **Recommendation contribution:** Uses family-level mappings in the rules doc (`bright` favors fresh/citrus families; `warm` favors amber/woody/gourmand; `soft` favors floral/fresh/woody equally). These are editorial assumptions only.
- **Accessibility:** native radio group; labels state preference rather than measurement; avoid communicating temperature with hue alone.

### Step 4 — `scene`

- **Title:** «یک تصویر برای خیال»
- **Subtitle:** «گاهی یک فضا بهتر از نام نت‌ها سلیقه را نشان می‌دهد.»
- **Question:** «کدام تصویر را برای لحظه‌ای انتخاب می‌کنید؟»
- **Options (single-select):**
  - `rainGarden` — «باغ پس از باران» — «هوای تازه، برگ‌های سبز و سکوت.»
  - `citrusMorning` — «صبحی روشن» — «نور نرم و میوه‌ای که تازه پوست گرفته شده.»
  - `quietFlowers` — «گوشه‌ای پر از گل» — «لطافت گل‌ها در فضایی آرام.»
  - `woodland` — «مسیر میان درختان» — «سایه، چوب و قدم‌زدن آرام.»
  - `warmEvening` — «غروب گرم» — «نور کم و لحظه‌ای صمیمی.»
  - `coffeePause` — «مکث کنار فنجان» — «فضایی دلنشین و کمی شیرین.»
- **Visual / interaction:** editorial panels with restrained local CSS/SVG textures (rain ripples, leaf shapes, light); no external photos. Compact cards on mobile. Single select.
- **Required / validation:** required; no preselection.
- **Empty state:** «یک تصویر را انتخاب کنید تا ادامه دهیم.»
- **Help:** «این تصویر یک انتخاب خلاقانه است؛ ویژگی تأییدشده‌ای برای نت‌ها یا عطر واقعی ادعا نمی‌کند.»
- **Recommendation contribution:** Adds the fixed family weights in the rules doc. The mappings are product editorial associations, not backend note attributes.
- **Accessibility:** visible option text carries meaning independently of texture; native radios; decorative art hidden from assistive technology.

### Step 5 — `noteAffinity`

- **Title:** «نت‌هایی که به دلتان می‌نشینند»
- **Subtitle:** «می‌توانید نام‌های آشنا را انتخاب کنید یا این مرحله را رد کنید.»
- **Question:** «از میان نت‌های موجود، کدام‌ها را دوست دارید ببینید یا ترجیح می‌دهید کنار بگذارید؟»
- **Options:** actual records from `GET /api/v1/fragrance-notes`, showing API `name` and API family name resolved through `family_id`. Search and family filter use actual API values. Two lists: «دوست دارم» (up to 3) and «ترجیح می‌دهم نباشد» (up to 3). “No choice” is valid. No popular/best-seller claim; initial ordering follows family preferences and then note name, all derived from API records.
- **Visual / interaction:** search-first compact note chips/cards, not all 24 oversized tiles. Selecting a note toggles it into one of the two mutually exclusive groups; selecting a note in the opposite group moves it and announces that change. If user explicitly selects over cap, action is rejected with a short explanation. `فعلاً انتخابی ندارم` clears both groups and marks step complete.
- **Required / validation:** optional, but user must either pick at least one note or choose `فعلاً انتخابی ندارم` before Continue. A slow/failed note fetch shows loading/error and real retry; a valid empty list gives «نتی در کاتالوگ فعلی در دسترس نیست» and allows skip. A note with missing family record remains selectable and is labeled «خانواده مشخص نشده».
- **Empty state:** search empty: «نتی با این عبارت پیدا نشد.» No note data: «در حال حاضر نتی برای انتخاب در دسترس نیست؛ می‌توانید این مرحله را رد کنید.»
- **Help:** «نت‌ها از کاتالوگ فعلی آرومان می‌آیند. انتخاب شما دربارهٔ همین نام‌هاست؛ دربارهٔ ترکیب یا عملکرد محصول واقعی وعده‌ای نمی‌دهد.»
- **Recommendation contribution:** explicitly liked real note IDs get a dominant inclusion priority; excluded IDs are always removed from candidates. A note's family contributes only when its real `family_id` maps to a family currently returned by API.
- **Accessibility:** search has persistent label; result count announced; each note has separate, labeled like/avoid control; avoid nested click targets; preserve selection state and announce move/removal; skip is a button/radio, not a hidden link.

### Step 6 — `reviewAndDiscovery`

- **Title:** «بازبینی و میزان کشف»
- **Subtitle:** «انتخاب‌هایتان را مرور کنید و بگویید پیشنهاد چقدر آشنا یا تازه باشد.»
- **Question:** «پیشنهاد چقدر به جهان‌هایی که انتخاب کردید نزدیک بماند؟»
- **Options (single-select):**
  - `familiar` — «نزدیک به انتخاب‌هایم» — «پیشنهاد بیشتر از خانواده‌های انتخابی من باشد؛ نت‌هایی که خودم پسندیدم حفظ شوند.»
  - `balanced` — «کمی آشنا، کمی تازه» — «انتخاب‌هایم اولویت داشته باشند؛ خانواده‌های دیگر هم فرصت داشته باشند.»
  - `exploratory` — «دوست دارم کشف کنم» — «در کنار علاقه‌هایم، نت‌هایی از خانواده‌های دیگر هم وارد پیشنهاد شوند.»
- **Review area:** editable summary rows for feeling, families, temperature, scene, loved/avoided notes; each `ویرایش` navigates back to that step and preserves all other answers. Concept name input defaults to «رایحهٔ من» (editable), with a 60-character maximum after trim; no claim that this is a backend-generated name.
- **Visual / interaction:** review is an editorial itinerary, not another dense form; discovery cards and concept name use same visual tokens. Single select for discovery. Then primary `دیدن پیشنهاد من`.
- **Required / validation:** discovery required; name optional and defaults to «رایحهٔ من». If entered, trimmed length 1–60; blank after trim falls back to default. Reject >60 with inline Persian message; no backend call yet.
- **Empty state:** if answers are missing due to state corruption, explain which step needs completion and return there; do not generate from guessed defaults.
- **Help:** «نت‌هایی را که خودتان پسندیده‌اید حفظ می‌کنیم؛ انتخاب میزان کشف، فقط روی نت‌های پیشنهادی دیگر اثر می‌گذارد و کیفیت یا مناسب‌بودن عطر را پیش‌بینی نمی‌کند.»
- **Recommendation contribution:** familiar prioritizes selected family IDs and preserves every valid liked catalog note, even when its family differs or is unresolved; balanced fills from selected families first and may include others when needed, without guaranteeing it; exploratory reserves one result position for a resolved non-selected family when an eligible note is available, unless an already included liked note from such a family satisfies that requirement. Name is shown on result and later sent as concept `name`; it does not affect note ranking.
- **Accessibility:** summary edits are buttons with target step names; name input has persistent label and character hint; validation uses `aria-describedby` and live announcement.

## 4. Result experience

The result is a distinct “reveal” state after step six, not another questionnaire step.

- Heading: «این تصویرِ رایحهٔ شماست» with the chosen concept name.
- Mood line uses selected feeling/scene vocabulary as the visitor's preference: e.g. «با الهام از حال‌وهوای آرامی که انتخاب کردید».
- Show a conceptual vessel using the Creative Studio's replaceable local CSS/SVG art direction. Colors can respond to the selected families using the existing presentation mapping. It must be labeled `تصویر مفهومی` and cannot look like a photographed, purchasable SKU.
- Show up to four suggestions (real note names and API-resolved families) arranged as top/heart/base conceptual layers. Explain “ترتیب لایه‌ها برای تصویرسازی ایده است؛ فرمول یا نسخهٔ ساخت نیست.”
- Explanation references only actual answers that affected the result, e.g. «این نت‌ها با توجه به علاقه‌تان به خانوادهٔ گلی و انتخاب حال‌وهوای آرام پیشنهاد شده‌اند.» If the chosen notes were liked explicitly, say «نت‌هایی که خودتان پسندیدید در پیشنهاد حفظ شده‌اند.» Do not mention an answer if it did not affect selected candidates.
- Show a concise selection summary and these four actions: `ذخیرهٔ مفهوم`, `رفتن به استودیوی خلاق`, `مرور پاسخ‌ها`, `شروع دوباره`. Direct Save is available only for a ready result with at least one real selected note. No-match has no save action that could imply a successful recommendation.
- The user may refine by removing notes, adding other API notes, changing layers/reordering in Creative Studio, up to the existing six-note limit. The saved record is simply a concept.
- If no eligible notes remain, show an honest no-match state: «با این ترکیب از انتخاب‌ها، نتی در کاتالوگ فعلی برای پیشنهاد پیدا نشد.» Actions: revise family/discovery/avoid answers, open Creative Studio; no empty “successful” result and no fake notes.

## 5. Loading, errors, authentication, and persistence

### Catalog load

Load families and notes from their existing public endpoints. Loading state names the requested content (“در حال دریافت خانواده‌ها…” / “در حال دریافت نت‌ها…”). Retry calls the same API client. A valid empty array is distinct from network/HTTP failure. Do not hardcode catalog fallback records. If families are empty, explain that Guided Studio needs available family data and offer Creative Studio. If notes are empty, user can skip Step 5, but final result clearly reports no catalog candidates.

### Save and login

Anonymous users can complete and refine the result. `ذخیرهٔ مفهوم` uses a shared frontend concept-save/auth helper that reuses the existing concepts API client, cookie credentials, CSRF renewal, and login experience; do not duplicate authentication or CSRF code. If the create request returns 401, preserve the complete visible result, answers, and edits while opening the existing login dialog. After successful login, saving requires an explicit user retry; do not submit automatically. Existing SMS 503 is shown honestly: «ارسال پیامک در حال حاضر در دسترس نیست. پاسخ‌ها و مفهوم شما در همین صفحه باقی می‌مانند؛ بعداً دوباره تلاش کنید.» No success is claimed. Prevent duplicate submissions with pending state and one in-flight request. A failed POST never clears the draft or shows a saved state. A no-match result cannot be saved as if it were a successful recommendation. A successful save uses the existing API response and only then reports the saved concept ID/status.

Session expiry during save: existing client handles 401; reopen login without clearing draft. If auth is later completed, require explicit save retry. 403 CSRF recovery remains in shared client. 422 (e.g. stale note UUID) should not claim success; refresh catalog, identify missing selection, let visitor edit. 503/network errors leave draft intact and show retry.

### Refresh and restart

For V1, answer state, selected note IDs, generated result, and unsaved refinements stay in React memory only; refreshing or closing the tab resets to step 1. This avoids quietly retaining preference data. State is not placed in URL parameters, localStorage, cookies, analytics, or backend. A visible `شروع دوباره` asks for confirmation only if a result/draft has been composed; it clears in-memory answers and selection after confirmation. Navigating between Guided and Creative uses the explicit handoff described in the implementation plan; it is not current behavior.

## 6. Responsive experience

Use the existing brand tokens: ivory `#F7F2EC`, deep plum `#382A3D`, dark plum `#302434`, champagne `#D6AD72`, blush `#F2D5CF`, lilac `#C8AECF`, sage `#93A58A`. Preserve 65% Living Atelier / 35% Fragrance Dreamscape: warm editorial surface and tactile local artwork, with restrained atmospheric depth on choice/result moments. Avoid copying the Coming Soon page.

- **320px:** one compact card column; short step heading; progress label plus thin progress bar; no sticky bottom action; primary action follows content in normal flow. Keep option cards concise and touch targets ≥44 CSS px. Search/filter can wrap. No nested scrolling.
- **390px:** one or two columns only for short options; scene and feeling cards remain readable; note list uses compact chips/cards. Progress stays visible without a fixed overlay.
- **768px:** centered reading column around 640–700px; choice groups can use 2–3 columns when labels fit; summary can sit beside a quiet illustration. Back/continue remain in document flow.
- **1440px:** content width ~1160px, editorial split layout with question/choices and decorative atmosphere; stable progress rail/step list may sit at side if it does not displace the main task. No forced three-column form.

Each transition moves focus to the new step heading and announces “مرحلهٔ n از ۶”. Motion is short and optional; reduced-motion uses immediate content swap. Selection has check icon + border + text. All controls maintain keyboard focus and touch target. RTL visual order, DOM order, and arrow-key behavior must be tested together; native radio/checkbox behavior preferred over custom keyboard models.

## 7. Accessibility requirements

- One `main`; each step has a heading; fieldsets and legends for choice groups; progress exposed as `role=progressbar` with min/max/current and Persian accessible value text.
- Announce step changes, option count updates, validation and API failures using polite/assertive live regions as appropriate; do not announce every decorative change.
- Selected and disabled states include semantics and icon/text, not color alone. Focus ring visible against ivory and plum surfaces.
- Keyboard: Tab reaches controls in logical RTL reading sequence; native Space/Enter works; Back and Continue have stable labels. If arrow navigation is added, follow the tested RTL convention and do not override expected screen-reader behavior.
- Minimum 44×44 CSS px touch controls where practical; controls never overlap content; errors are adjacent and linked via `aria-describedby`.
- Ensure reduced motion, zoom/reflow, contrast, and screen-reader names are tested at 320px through desktop.

## 8. Known limitations and later work

- No real recommendation API, questionnaire persistence, product inventory/price, product media, or SMS provider exists in this backend milestone.
- Seed data is fictional demonstration catalog data. The interface should use `is_demo` if showing a demo disclosure, and should not represent sample notes as stocked products.
- Guided recommendations are only as broad as real catalog families and notes. Unknown families are neutral; missing family records never become guessed metadata.
- The recommendation is an editable editorial concept and is not a physical formula, safety assessment, allergen check, performance prediction, or product match guarantee.
- More nuanced mappings require product-owner review and user research; additional Figma credits can refine art direction after functionality is agreed.

