# Build Log — YT Focus Mode

Mirror of the Notion Build Log: https://app.notion.com/p/3f3b8452dfa1814e8435f40e681413d8

Each entry: what was decided, why, and why it's an interesting beat for a video.

---

## 2026-10-08 — Scoping the extension

**Decision:** Focus mode blocks YouTube's homepage feed, recommendations, and Shorts, but allows a manually curated list of channels, pinned videos/playlists, and anything that passes an AI topic check.

**Why:** The real problem isn't "no YouTube at work" — it's the infinite recommendation rabbit hole. Music and one specific reference video are legitimate work tools; the homepage feed and Shorts are not.

**Why it matters for the video:** This is the core hook — "I didn't block YouTube, I blocked YouTube's business model." Good opening line.

---

## 2026-10-08 — Classifier: TypeSafe (Jev) instead of a general LLM

**Decision:** Use TypeSafe's Jev model (a "System One" model) with a Noul (yes/no confidence) question to judge whether a video's title/channel/description matches the user's allowed topics — instead of calling a general-purpose LLM and parsing free text.

**Why:** Jev returns a typed, structured answer (0–1 score + confidence) directly, no prompt engineering or text parsing needed. It's a better fit for a fast, deterministic-feeling gate inside a browser extension than a chat-style LLM call.

**Why it matters for the video:** Nice beat on "using the right primitive for the job" — most people reach for ChatGPT-style prompting for this kind of yes/no decision; this shows a purpose-built alternative.

---

## 2026-10-08 — Work-hours lock

**Decision:** A weekly schedule (e.g. Mon–Fri 9–18) during which the on/off toggle is disabled — focus mode can't be manually turned off, only the schedule itself (outside the session) can change it.

**Why:** A toggle you can click away the moment you're tempted isn't a real commitment device. Locking it during declared work hours removes the escape hatch.

**Why it matters for the video:** Relatable "protect me from myself" moment — good for a short clip showing the toggle visibly disabled with a lock icon.

---

## 2026-10-08 — Blocked-video UX: hold the overlay

**Decision:** When a video is blocked, show the overlay immediately and hold it until the TypeSafe classification call resolves, rather than flashing the content first.

**Why:** Avoids a flash of the "forbidden" video before the block kicks in, even at the cost of a brief loading state. Oriol flagged this as a "we'll change it if it doesn't feel natural" decision — worth revisiting after using it for real.

**Why it matters for the video:** Honest beat about iterating on UX feel, not just shipping the first version.

---

## 2026-10-08 — First live test, end to end

**Decision:** Loaded the unpacked extension in Chrome and tested on real youtube.com — toggled Focus Mode on, confirmed the homepage feed and Shorts shelf vanish, then opened an arbitrary video (not pinned, not on an allowed channel) and confirmed the blocked overlay appears and pauses the player behind it.

**Why:** No point shipping code based on code-review alone — YouTube's DOM is a moving target and the only real signal is seeing it hide/block on the live site.

**Why it matters for the video:** This is the "it actually works" beat — a clean before/after: full YouTube homepage with Shorts and recommendations, then one click and it's just a blank header. Strong B-roll moment, and the blocked-video overlay card (orange tag, "This one's outside your allowlist") is a good close-up shot on its own.

**Known gap:** No TypeSafe API key configured yet, so right now anything not pinned or on an allowed channel fails closed (blocked) rather than going through the Jev topic check. That's correct behavior, just untested with a real key yet.

---

## 2026-10-08 — Bug: Shorts bypassed focus mode entirely

**Decision:** Fixed a real gap — the content script only gated `/watch` pages, so navigating directly to a `/shorts/<id>` URL played completely unblocked, even with Focus Mode on and "hide Shorts" enabled. The homepage Shorts shelf was hidden, but the actual Shorts player route had zero gating. Also removed a CSS rule that hid `ytd-reel-video-renderer` globally — that's the same component YouTube reuses for the real Shorts player, not just the home shelf, so it could silently blank out legitimate UI. Shorts are now blocked outright (full overlay, no allowlist check) the moment you land on `/shorts/*`.

**Why:** Found by actually trying to open a Short while focus mode was on, not by reading the code. CSS-hiding the entry points (shelf, nav link) said nothing about what happens once you're already on the route — classic gap between "looks blocked" and "is blocked."

**Why it matters for the video:** Great "here's the bug we almost shipped" moment — before/after of Shorts playing freely vs. the new block screen. Shows the value of testing the actual product, not just trusting the diff.

---

## 2026-10-08 — Bug: collab videos never matched the channel allowlist

**Decision:** Opened a Fred again.. collab track ("LATIN MAFIA, Fred again.. - Te Estoy Correteando") to test the allowed-channels feature and it blocked anyway. Root cause: YouTube renders the channel credit on multi-artist videos as a `<button>` ("Fred again . .and LATIN MAFIA") that opens a dropdown of all credited channels, not the plain `<a>` tag a single-artist video uses. The content script's selector only looked for an `<a>`, so for any collab video it extracted an empty channel string — the allowlist check never had anything to compare against. Fixed by reading the whole owner block's text regardless of element type, and switched channel matching from exact equality to a normalized substring check (strips punctuation/spacing so "Fred again" matches inside "Fred again . .and LATIN MAFIA").

**Why:** Exact-string equality was always going to be fragile against YouTube's inconsistent channel-name formatting (trailing dots, spacing, multi-artist credits) — this is the kind of bug that only shows up with a real artist who collabs a lot, which is exactly the case Oriol tested.

**Why it matters for the video:** Good concrete example of "the allowlist looked right in code, but the actual site doesn't cooperate" — collabs are extremely common in the music genres people actually want to allow through focus mode, so this wasn't an edge case, it was close to the default case.

---

## 2026-10-08 — Bug: changing threshold/topic didn't re-run Jev on already-seen videos

**Decision:** Confirmed Jev itself was working correctly the whole time — a "Hyperfocus | LOCK IN" study video scored 0.5 confidence, correctly blocked at a 0.7 threshold. But after Oriol lowered the threshold to 0.5 and expanded the topic description, the same video kept blocking. Root cause: per-video topic decisions are cached (so revisiting a video doesn't re-call the API every time), but the cache was never invalidated when the threshold or topic description changed — so it kept serving the stale "blocked" verdict computed under the old settings. Fixed by clearing the decision cache whenever those two settings change.

**Why:** Caching API decisions is the right call for cost/latency, but caching is only ever as correct as its invalidation. This is the classic cache-invalidation bug, and it looked exactly like "the API isn't working" from the outside even though the API was never the problem.

**Why it matters for the video:** This is a genuinely good teaching moment — "the AI was right, the caching was wrong" — and it's a good excuse to explain why decision caching exists at all (cost + latency) without pretending it's free.

---

## 2026-10-08 — Removed decision caching entirely

**Decision:** Oriol's call: Jev is cheap and fast enough to just call on every video, every time. Ripped out the whole per-video decision cache (chrome.storage.session) and its invalidation logic instead of patching it further.

**Why:** The cache existed to save API calls, but it just caused the previous bug (stale verdicts surviving a settings change) and added a whole invalidation problem to maintain for a cost saving that doesn't matter at this usage volume. Simpler code, one less bug class, and the "cache" was solving a problem that didn't need solving.

**Why it matters for the video:** Good "premature optimization" beat — adding the cache felt like the responsible engineering choice, but it was optimizing for a cost that was never actually a problem, and it introduced a correctness bug instead of removing it. Removing it was the right fix, not a workaround.

---

## 2026-10-08 — Fixed the blocked/allowed flicker

**Decision:** Flipped the "hold the overlay" decision from earlier (blocked-video UX entry above) now that Jev's real-world latency is confirmed well under a second. Previously the overlay showed the *blocked* copy immediately on every video, then hid itself if the decision came back allowed — so every allowed video briefly flashed "outside your allowlist" before correcting. Now: silently pause the video (no overlay at all) while the check runs, and only show the overlay — with the correct message — once a decision actually resolves to blocked. Allowed videos now just resume playback with no visible glitch.

**Why:** Oriol flagged this as genuinely awkward to use ("says NO then pops back to the video") and pointed out Jev is fast enough that there's no need for a loading/pending UI state at all — simpler to just not show anything until there's a real answer.

**Why it matters for the video:** Nice example of a UX decision getting reversed once real latency data came in, instead of over-engineering a "checking..." spinner state for a wait that turned out to be imperceptible.

---

## 2026-10-08 — Bug: allowed videos stayed stuck paused

**Decision:** The previous flicker fix introduced a new problem: pre-emptively pausing the video while Jev ran, then calling `.play()` to resume it once allowed, worked in automated testing but not in real use — the browser's autoplay gesture typically expires during the async round trip, so the scripted resume gets silently blocked with no visible error. Removed the pre-emptive pause entirely: playback now just starts normally and only gets paused (via the overlay) if the video actually comes back blocked.

**Why:** Chasing the first UX fix created a second, worse bug — a video that silently refuses to resume looks broken with zero feedback, worse than a half-second flicker. The actual constraint (browser autoplay policy) wasn't visible from automated testing, only from real usage.

**Why it matters for the video:** Good chain of three UI iterations in one session — hold overlay → flicker → pause/resume → don't pre-emptively touch playback at all. Shows that "fix the UX" isn't always a straight line, and that automated testing can pass while real browser behavior (autoplay gestures) still breaks it.

---

## 2026-10-08 — Added a neutral "checking" shade

**Decision:** Added a lightweight grey/desaturated shade layer that appears the instant a video check starts and disappears the instant it resolves. It's purely visual — `pointer-events: none`, never touches the `<video>` element — so it gives feedback during the ~1s Jev call without reintroducing the pause/resume autoplay bug from the previous fix.

**Why:** Oriol's suggestion — gives a clear "something is happening" cue (so the player doesn't look frozen/broken for that brief window) without claiming an answer before there is one, and without the playback side effects of actually pausing the element.

**Why it matters for the video:** Nice visual beat — a subtle grey wash over the thumbnail right as a video loads, gone in under a second. Good before/after shot to show the UX settled after three iterations.

---

## 2026-10-08 — Gen Z copy + a "DENIED" stamp on the blocked card

**Decision:** Rewrote the blocked-video copy with Gen Z slang ("nah bestie, not today 💀", "shorts = brainrot, not on my watch") and added a rotated red "DENIED" stamp badge on the card, styled like a rubber stamp rather than any existing meme format — avoids any copyright/trademark risk from reusing a real meme image while still landing the joke. Also added a floating pill badge during the "checking" shade phase that rotates through a few funny lines ("asking jev if this slaps fr fr", "consulting the ai overlords...") so the pending state has personality too, not just a silent grey dim.

**Why:** Oriol wants this to be funny and shareable, not just functional — a tool built for a social media video should itself be a little bit of a bit. Avoided real meme images deliberately: an original stamp-and-slang treatment gets the laugh without the copyright risk or an external image dependency.

**Why it matters for the video:** This is probably the single best screen-recording moment in the whole build — the stamp animation plus the slang copy is exactly the kind of beat that makes a build video fun to watch instead of just a feature walkthrough.

---

## 2026-10-08 — Fixed the checking-to-blocked jump cut

**Decision:** The small pill badge for "checking" and the big centered card for "blocked" were two different elements, so the transition between them visually jumped. Replaced the separate shade/badge with the same centered overlay card used for the blocked state — "checking" now just hides the DENIED stamp and buttons and gently pulses the card's shadow, then swaps in the verdict content once Jev responds. One element, one position, no jump.

**Why:** Oriol flagged it as ugly, too small, and glitchy on the handoff. The fix wasn't to polish the small badge, it was to realize it shouldn't have been a separate element in the first place.

**Why it matters for the video:** Another small but real lesson — sometimes the bug isn't in the code, it's in the design choice (two elements instead of one state machine for one element).

---

## 2026-10-08 — Translucent backdrop + fade transition

**Decision:** Backdrop opacity dropped from a fully opaque #111111 to rgba(17,17,17,0.3) — the video is now dimly visible through the overlay instead of fully hidden. Also switched the overlay's show/hide from an abrupt `display: none → flex` toggle to an opacity/visibility transition, so it fades in and out instead of popping.

**Why:** Oriol's calls — a translucent backdrop feels less heavy-handed than a full blackout, and the instant display toggle (no transition possible on the `display` property) was very likely the remaining "glitch" on load.

---

## 2026-10-08 — Found the real "reload glitch": debounced settings writes

**Decision:** Spent a while chasing this as a rendering bug (separate elements, no fade transition) before adding diagnostic logging and reproducing it directly. The actual cause: every keystroke in the topic-description textarea and every tick of the threshold slider in the popup wrote to `chrome.storage` immediately. The content script listens for any settings change and re-runs its whole check on whatever video is open — so typing a sentence or dragging the slider while a YouTube tab was open fired a dozen re-checks in a few seconds, each one flashing the checking card and re-resolving. That's the "appears, disappears, looks like a reload, appears again" Oriol described. Fixed by debouncing the actual storage write (400ms after the last change), while keeping the popup's own UI instantly responsive via local React state.

**Why:** Classic case of chasing symptoms in the wrong layer — the UI code was fine, the bug was in how often it got re-invoked. Diagnostic logging (navigation events, overlay show/hide, with videoIds) is what actually found it, not more guessing about CSS transitions.

**Why it matters for the video:** Honest "I was fixing the wrong thing" moment — three UI iterations on the overlay itself, and the real bug was a missing debounce on a settings form, two layers away from where the symptom appeared.

---

## 2026-10-08 — Overlay glitch: still unresolved, parked

**Decision:** Tried four fixes in sequence for the "appears, disappears, looks like a reload, appears again" glitch — unified the checking/blocked elements, added fade transitions, translucent backdrop, debounced popup settings writes. Oriol confirms it's still happening. Parking it rather than guessing further blind.

**Why:** Diagnostic logging ruled out the theories tested so far (no duplicate onNavigate/handleWatchPage calls in the reproduction run), but the actual failing sequence hasn't been caught live yet — next session needs a direct screen recording or console log from the moment it happens, not more speculative fixes.

**Why it matters for the video:** Worth keeping in as an honest beat if the video covers debugging — not every bug gets solved in one sitting, and "here's what we ruled out" is still useful progress even without a fix yet.

---

## 2026-10-08 — Per-video filtering on the homepage, not blanket hiding

**Decision:** Replaced the old "hide the whole homepage feed" behavior with per-video filtering: every card in the grid gets the same pinned/channel/topic check used on `/watch` pages, via a MutationObserver that catches new cards as you scroll. Blocked or still-checking cards get blurred in place (`filter: blur()`, not removed from the DOM) rather than disappearing — so the grid layout never reflows as verdicts land asynchronously at different times, which would have reintroduced the same jank class as the overlay glitch.

**Why:** Oriol wants the homepage itself to only show approved content, not an empty page. Blur-in-place over remove-from-DOM was a direct lesson from the overlay glitch work earlier in the session — anything that changes layout as async results trickle in creates visible jank.

**Why it matters for the video:** This is the single best "it's actually smart" demo in the whole extension — open youtube.com and watch the grid selectively clear up in real time as Jev judges each card, while off-topic ones stay blurred. Great screen recording moment.

**Technical note worth mentioning on camera:** TypeSafe's API takes one `state` with multiple questions about it — not multiple different states in one call. So grid filtering isn't one giant batched API call; it's ~15-20 small parallel calls firing at once, which in practice resolves just as fast without the reliability risk of cramming many different videos into one shared context.

---

## 2026-10-08 — Bug: home grid filtering selected nothing, real YouTube markup

**Decision:** The first version of the grid filter used the same `#video-title-link`/`#channel-name` style selectors as the /watch page, inherited by assumption. Inspected the live DOM directly and found YouTube's actual home grid cards use a completely different, newer "lockup" component with no ids at all on the title/channel elements — only class names like `ytLockupMetadataViewModelTitle`. That's why every card passed through unfiltered: the selector matched nothing, so videoId extraction silently failed for every card and nothing ever got evaluated. Rewrote the selectors against the real markup, found by walking the DOM live rather than guessing. Also added an explicit skip for sponsored/ad cards, which have their own distinct component and shouldn't be touched or spend an API call.

**Why:** YouTube's various surfaces (search results, watch page, home grid) don't share one component system — the /watch page's older `ytd-*` elements and ids don't carry over to the home grid's newer "view model" components. Assuming shared markup across surfaces without checking is exactly how this kind of silent failure happens — no errors, no console noise, just nothing happening.

**Why it matters for the video:** Good illustration of inspecting real markup instead of assuming it — the code looked completely reasonable and still did nothing, because the selectors were targeting elements that simply don't exist on that page.

---

## 2026-10-08 — Confirmed working: homepage grid filtering live

**Decision:** Verified end to end on the real homepage — one video ("Hyperfocus | LOCK IN for 2 Hours | Deep Work Study With Me") stayed clear and clickable while every surrounding card stayed blurred. Oriol confirmed it looks good.

**Why it matters for the video:** This screenshot is the cleanest single image of the whole build — one sharp, allowed video surrounded by a blurred-out feed is an immediate, no-explanation-needed visual of what this extension does. Strong thumbnail/cover-image candidate too, not just a B-roll clip.

---

## 2026-10-08 — First clean win: a real Notion tutorial correctly allowed through

**Decision:** Tested a random "New to Notion? Watch this FIRST (2026 Notion Guide)" video, never seen before, not pinned, not from an allowed channel. Jev scored it 0.69 confidence against the topic description (which mentions "tutorials on Notion") against a 0.5 threshold — allowed, correctly, on the first fresh call after removing the cache.

**Why it matters for the video:** This is the payoff shot — the system correctly recognizing new, unseen content by what it actually is, not by a pre-approved list. Good contrast to show right after the allowlist-matching clips: "this part only works because someone typed the channel name in advance; this part works because the AI actually understood the video."

## 2026-10-08 — A promo video, built in code (Remotion)

**Decision:** Made a 34-second vertical (9:16) promo for TikTok/Reels/Shorts with Remotion, React code that renders to MP4, instead of screen-recording and editing in CapCut. It reuses the extension's actual design tokens (#111 canvas, #FF5A1F orange, Space Grotesk/Mono, hard shadows), the real overlay copy ("nah bestie, not today 💀", "asking jev if this slaps fr fr"), and the real blurred-feed screenshot. Story: POV hook → doomscroll with a racing clock ("3 hours later 💀") → "what if YouTube had a bouncer?" → blurred feed → DENIED stamp → Shorts blocked → rage-clicking the locked toggle → "I didn't block YouTube. I blocked its business model." Sound effects and the beat were synthesized with ffmpeg (or are Remotion's free SFX), so there's zero licensing risk.

**Why:** The UI is already a dark, stamp-and-slang bit, so recreating it in code keeps every frame on-brand and lets you edit copy or timing in seconds and re-render. No music licensing headaches, because the trending sound gets added in-app at posting time.

**Why it matters for the video:** Meta beat: the same AI that built the extension also made its ad, from the same design tokens. A side-by-side of the code and the rendered DENIED stamp slamming in makes a good closing shot.

---

## 2026-10-09 — Promo v2: real footage, 4:5, in Spanish

**Decision:** Threw out the mocked-up YouTube scenes and rebuilt the promo around two real screen recordings: a doomscroll through the homepage into Shorts, and the moment the extension's popup gets switched on and the feed blurs, leaving only a Notion tutorial and a focus-music video sharp. Remotion acts as a virtual camera over the footage: zooming into the popup, panning up to the toggle right as it flips, following the scroll to each surviving video. The format moved from 9:16 to 4:5 (1080×1350) for Instagram feed posts and LinkedIn, and every caption is now in Spanish ("¿y si YouTube te ayudara a enfocarte?", "He bloqueado su modelo de negocio.").

**Why:** Oriol's call: mocked-up UI reads as fake, and the real thing is more convincing. The screen recordings were 800px GIFs, so the zooms are kept moderate; anything past ~2x starts looking mushy. The blocked-video/DENIED and locked-toggle scenes were dropped for now because there's no real footage of them yet.

**Why it matters for the video:** "Grabación real · UI sin retocar" is the credibility beat, because people can tell when a demo is staged. Also a nice workflow detail: the edit is code, so changing the language or the aspect ratio was a find-and-replace, not a re-edit.

---

## 2026-10-09 — Reframing the message: beat the algorithm, not YouTube

**Decision:** Dropped the first-person "No he bloqueado YouTube. He bloqueado su modelo de negocio." outro and replaced it with "Céntrate en lo que de verdad te importa. Gánale al algoritmo." Also replaced the synthesized techno beat (annoying on repeat) with two calmer synthesized options to compare: a lo-fi electric piano with vinyl crackle, and an upbeat marimba.

**Why:** Oriol's call. The product isn't an attack on YouTube; it's about people's attention and productivity, so they can focus on what they actually came for. "Me vs. YouTube" is a hard line to stand behind publicly; "you vs. the algorithm" is the user's own fight, and it puts the viewer in the hero role.

**Why it matters for the video:** Good example of copy positioning: the same feature reads as hostile or as empowering depending on who the villain is. Also, the lo-fi track is a quiet callback to the hook ("UNA playlist de lo-fi").

---

## 2026-10-09 — Music picked, reveal moved onto the drop

**Decision:** Oriol picked a Pixabay "product launch" track (jonasblakewood) out of three, removed every sound effect, and moved the "Presentamos YT Focus Mode" reveal from 10s to 17.6s, the exact frame where the track drops after its pause. The question "¿y si YouTube te ayudara a enfocarte?" stays as a short bridge before the demo, and the "modo foco: ON" pill at the end is gone ("menos es más").

**Why:** The track builds from soft to a big drop, which is the same arc the video tells (rabbit hole → you take control). With the music doing that work, the sound effects only got in the way. I found the drop by measuring the track's loudness at 50ms resolution, then built the timeline backwards from that frame.

**Why it matters for the video:** "Edit to the music, not the other way round": a title card that slams in on the beat feels produced, and finding the beat was a measurement, not trial and error by ear.

---

## 2026-10-09 — "Is my extension in the cloud?": dev build vs. real build

**Decision:** Switched the loaded extension from the dev build to a production build (`npm run build`). The extension stays loaded unpacked from the local `dist` folder for now; no Chrome Web Store publishing yet.

**Why:** The popup showed "Cannot connect to localhost:5173" once the dev server was off. In dev mode, the `dist` folder is only a shell that loads the code live from Vite on the laptop. The production build puts all the code into `dist`, so Chrome reads plain files from disk and nothing has to be running. Publishing to the Web Store ($5, a few days of review) would only matter for using it on other computers or sharing it, and Oriol is fine without that.

**Why it matters for the video:** A very common beginner confusion when vibe-coding: "where does this thing actually run?" Answer: nowhere in the cloud, just in your browser, reading files from a folder on your laptop. The error screen makes a good before/after moment.

---

## 2026-10-15 — Jev remembers its answers

**Decision:** Every Jev score now gets cached per video, so scrolling up and down the homepage (or opening a video you already saw on the feed) no longer pays for a fresh API call. The cache stores Jev's raw 0–1 score rather than the allowed/blocked verdict, so moving the threshold slider costs nothing; only editing the topic text wipes it. Also fixed a quieter bug: the "already checked" marker was stuck to the page element, but YouTube recycles those elements as you scroll and swaps a different video into the same card.

**Why:** Oriol noticed the Jev usage was too high. The cause: nothing remembered previous answers, and YouTube rebuilds the feed constantly, so the same video got judged over and over. Storing the score instead of the verdict splits the work cleanly: Jev does the judgment once (latent), and the "is it above the bar?" comparison is plain arithmetic redone locally every time (deterministic). The cache lives in the browser's local storage, because Chrome kills the extension's background script after ~30 seconds idle and would otherwise forget everything.

**Why it matters for the video:** A classic "the AI bill is too high" moment, where the fix isn't a cheaper model but not asking the same question twice. And the score-vs-verdict split is a nice example of the latent/deterministic principle: ask the AI for the judgment, keep the rule that acts on it in code.

---

## 2026-10-15 — Jev vs. Claude Haiku 5.5: is the "cheap" AI the right one?

**Decision:** Stay on Jev. Before deciding, a separate Claude agent compared what one video check costs on Jev against Anthropic's new Haiku 5.5, a small model built for this kind of quick classification.

| | Jev | Haiku 5.5 (thinking off) | Haiku 5.5 (default thinking on) |
|---|---|---|---|
| Price | $0.042 per million input tokens, output free | $0.10 in / $0.50 out per million tokens | same |
| Per 1,000 videos | ~$0.003–$0.008 | ~$0.02–$0.05 | ~$0.15 |
| 200-video scroll session | ~$0.002 | ~$0.01 | ~$0.03 |
| Speed | 70–500 ms (third-party claim) | ~0.4–1.5 s (estimate) | slower |
| What you get back | a calibrated probability | a number the model writes out | same |

**Why:** Both cost fractions of a cent per session, so price wasn't the deciding factor. Jev wins on two other things. First, its score is a real probability: things it scores 0.73 should turn out on-topic about 73% of the time, which is what makes the threshold slider meaningful. A "0.73" from Haiku is just text it generated. Second, speed: homepage cards stay blurred until the answer arrives, so a sub-second reply matters. The one reason to reconsider later is quality. Jev is strongest in English, so if Spanish or Catalan videos keep getting misjudged, the move is to label ~50 real homepage videos and test both models on them, not to switch on gut feeling.

**Why it matters for the video:** The punchline: the usage spike wasn't about the model's price at all. It was the extension asking the same question over and over, which the cache fixed earlier the same day. Swapping models would have hidden the real bug. And "which AI is cheaper?" turned out to be the wrong question; "what does my feature actually need from the answer?" (a trustworthy probability, fast) was the right one. Also a nice workflow moment: the research ran in a parallel Claude agent while the main session kept building.

Sources: docs.typesafe.ai/models.md, typesafe.ai, platform.claude.com/docs/en/about-claude/pricing.md (all checked 2026-10-15). Not verified: Jev's speed (only third-party sites claim it), Haiku's speed (estimate), any Jev free tier.

---

## 2026-10-15 — Getting it ready to publish: two reviews, one rewrite

**Decision:** Before publishing, ran two reviews side by side: I did security, and a parallel Claude agent reviewed bugs, speed and code quality. Then fixed almost everything in one pass and renamed the extension to "Tube Focus Mode with Jev" (v0.2.0).

What changed, in plain words:
- **It asks before sending anything.** Topic checks stay off until you click "Allow topic checks", which explains exactly what goes to TypeSafe (title, channel, description) and nothing else. There's a written privacy policy to go with it.
- **A spending cap.** At most 1,000 Jev checks a day, 60 a minute, 4 at a time, with a "checks today" counter in the popup. Every check is paid from the user's own key, so a bug can't drain it.
- **Four real bugs fixed:** videos judged by the *previous* video's title after clicking through; weak homepage guesses being reused on the full video page; a "checking" card that could get stuck forever; pinned playlists that never worked.
- **Smoother homepage:** scans batched to once per frame instead of once per page change, and any card not yet checked stays blurred, so nothing slips through for a split second.
- **Smaller attack surface:** two permissions instead of three, a strict content security policy, fonts bundled instead of loaded from Google, no debug logs in the shipped build, and every message from the page checked before use.

**Why:** Publishing changes who you're protecting. For a personal tool, "it works for me" is enough; for strangers, you're handling their API key, their money and their viewing data. The biggest real risk wasn't a hacker: it was not being upfront about what leaves the browser, which is also one of the most common reasons the Chrome Web Store rejects extensions.

**Why it matters for the video:** The code-quality agent found the scariest bug, and it was in the cache I'd written that same morning: after clicking from one video to the next, the extension could judge the new video by the old one's title, *and then remember that wrong answer forever*. Good honest beat: AI-written code reviewed by another AI agent caught a mistake the first one made. Also: "the spending cap would have caught this morning's bug" ties the whole day together.

---

## 2026-10-15 — The hardening broke things, and the browser showed why

**Decision:** Oriol tested the hardened version and hit three problems: allowed videos stuck behind "checking", homepage cards getting blurred after scrolling back, and a usage counter stuck at 0. Instead of guessing from the code, Claude drove a real YouTube tab and measured.

What the measurements showed:
- **YouTube had quietly changed its page.** The selector for a video's title found nothing, so every check waited out a 4-second timeout before giving up. That was the "stuck" overlay.
- **The exact timing of YouTube's navigation.** When you click into a video, YouTube shows the *old* video's title and channel for about 0.6 to 0.9 seconds, then switches the player, title and channel together. The extension now waits for that switch instead of a timer. Allowed videos now clear in under a second.
- **The safety cap I added that morning was blocking good videos.** A fast scroll loads ~140 cards in 15 seconds; my "max 60 checks a minute" rule marked everything after 60 as blocked, which looked exactly like Jev saying no. Now checks wait in line (4 at a time) instead of being refused, and the video you just opened skips the queue.
- **A ghost of the old version.** Reloading an extension doesn't reload open tabs, so the old copy kept running beside the new one, showing an overlay it could never clear. New versions now shut themselves down when that happens.

After the fixes, the same test: 138 cards, every one with a real Jev or channel verdict, zero changes after scrolling back up, blocked videos refuse to play.

**Why:** Each fix came from a measurement, not a theory. Two of the three bugs (the selector and the "ghost" copy) can't be seen by reading the code at all; they only exist in the live page.

**Why it matters for the video:** Strong honest beat: "the safety feature caused the bug." A rate limit meant to protect users silently blocked good videos, and it looked identical to the AI making bad calls. Lesson for anyone building with AI: when the AI seems wrong, check the plumbing around it first. Good screen-recording moment: the overlay timing log (old video's title still on screen for ~0.8s after the click).

---

## 2026-10-15 — Allowing a channel by its @handle, not its name

**Decision:** Allowed channels can now be entered as an @handle (like `@mfreihaendig`), which matches only that exact channel. Plain names still work the old way.

**Why:** Matching by name had a loophole: allowing "Lofi Girl" also let in "Lofi Girl Fans", and a short entry like "AI" matched half of YouTube. Anyone can copy a channel's display name; nobody can copy its handle. Checking the live page showed the handle is already there on every homepage card and video page (in the link behind the channel's avatar), so no extra lookups were needed. Names stay as a fallback because collab videos credit several channels in one line.

**Why it matters for the video:** Small but relatable security idea: names are what people see, IDs are what you trust. Same reason you check the email address, not just the sender's name.

---

## 2026-10-15 — One saved handle is enough for a collab

**Decision:** Saving a channel's @handle now covers every video it's credited on, including collabs. When you add a handle, the extension looks up that channel's page once to learn its permanent ID and display name, and shows the result next to the handle in the popup ("@lofigirl · Lofi Girl", or "not found" for a typo).

**Why:** Oriol tested handles and found collabs still got blocked. Inspecting the live page showed why: a collab's video page lists "Fred again.. and LATIN MAFIA" as plain text with no channel links at all, and its homepage card links only the first channel, by its ID rather than its handle. So the handle never appeared anywhere to match against. That also exposed a quieter gap: some ordinary homepage cards link channels by ID, not handle, so a saved handle could miss them too. Knowing each handle's ID fixes the cards; knowing its name fixes collabs, where the credits get split on "and", "y", "x", "&" or commas.

To keep the copycat protection, the name fallback only applies to collabs or videos with no channel links. A single-channel video with its own (different) channel ID can't get in by borrowing a name.

**Why it matters for the video:** Nice example of "the data you need isn't where you'd expect." The fix wasn't smarter matching; it was looking up one missing fact (handle → ID and name) once and remembering it.

---

## 2026-10-15 — Jev 1.14 came out mid-build: pin it, don't follow it

**Decision:** Switched from `jev-latest` to an explicit `jev-1.14.0`, and made the score cache start fresh whenever the model version changes.

**Why:** TypeSafe released Jev 1.14 the day before, with the biggest gains in non-English text (exactly the weak spot for Oriol's Spanish and Catalan feed), at the same price. The extension asked for `jev-latest`, which TypeSafe moves to the new version about a week later, silently. That would have mixed old and new scores in the cache, and the threshold Oriol tuned (0.55) was tuned on the old model's scores. TypeSafe's own docs say the same: if you've tuned a threshold, name the version. Skipped the other announcements (image input, a bounding-box answer type, long context): they're labelled "danger zone" experimental, and a title plus channel already carries the signal.

**Why it matters for the video:** A real-world AI habit worth showing: model updates are like dependency updates. "Latest" feels convenient until your app's behaviour changes overnight and you can't tell why. Pin the version, upgrade on purpose, and re-check your numbers after.

---
