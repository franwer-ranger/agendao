# Claude Opus 4.8 — prompting profile

The most capable Opus-tier model and the sensible **default** for day-to-day serious work: coding, agentic tasks, code review, debugging, knowledge work, memory-heavy agents. State-of-the-art long-horizon execution at half Fable's price.

## Behavioral profile

- **Literal instruction following** — it won't silently generalize an instruction or infer requests you didn't make. Precision is the upside; state scope explicitly when an instruction should apply broadly.
- **Narrates more than 4.7** — more text between tool calls, longer wrap-ups.
- **More deliberate** — tends to ask about minor decisions (naming, defaults) and close with "Want me to also…?" instead of acting or stopping.
- **Conservative tool triggering** — high-precision/low-recall on search; under-reaches for sub-agents, file-based memory, and custom tools unless told when to use them.
- **Warmer, less hedged prose** than 4.7 — re-check style instructions written to counter 4.7's terseness; they may overcorrect.
- For long-horizon agentic work: full task spec up front in one well-specified turn, run at `high`/`xhigh`.

## Prompting rules

1. **Say when, not just what, for every capability.** Prescriptive trigger conditions ("call this when…", "search before answering when…") give measurable lift over descriptions of what a tool does.
2. **State the goal up front** for agentic runs; effort `high` default, `xhigh` for the hardest coding/agentic work.
3. **Grant autonomy on small decisions explicitly** if the run should be low-touch.

## Snippets (include only when the task warrants)

**Search-first** — for research/current-information tasks (recovers should-search rate):
> For questions where current information would change the answer (recent events, current roles or prices, version-specific behavior), search before answering rather than answering from memory. For open-ended research requests, begin searching immediately; don't ask a scoping question first unless genuinely ambiguous.

**Capability triggering** — when the session should use memory/sub-agents/specific tools:
> Before any task longer than a few turns, check your memory file for relevant prior context and write new findings to it as you go. When a task fans out across independent items (many files to read, many tests to run), delegate to sub-agents rather than iterating serially.

**Autonomy on minor decisions** — cuts ask-rate without increasing over-reach:
> For minor choices (naming, formatting, default values, which approach among equivalents), pick a reasonable option and note it rather than asking. For scope changes or destructive actions, still ask first.

**Silence default** — if narration would be too chatty for the use case:
> Default to silence between tool calls. Only write text when you find something, change direction, or hit a blocker — one sentence each. When done: one or two sentences on the outcome; don't recap every file or test.

**Code review, coverage-first** — Opus 4.8 follows "only high-severity" filters literally, which depresses recall:
> Report every issue you find, including ones you are uncertain about or consider low-severity. Do not filter for importance or confidence — your goal is coverage; a downstream step will rank findings. For each finding, include confidence and estimated severity.

**Design/frontend variety** — the default house style is persistent; generic "make it clean" just shifts to another fixed palette:
> Before building, propose 4 distinct visual directions tailored to this brief (each as: bg hex / accent hex / typeface — one-line rationale). Ask me to pick one, then implement only that direction.

(Alternative: give a concrete spec — exact hex values, typefaces, layout constraints — which it follows precisely.)

**Final-answer-only** — if reasoning leaks into visible responses on quick tasks:
> Respond only with your final answer. Do not include exploratory reasoning, intermediate drafts, or meta-commentary about your process.
