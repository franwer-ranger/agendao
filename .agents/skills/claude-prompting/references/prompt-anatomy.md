# Prompt anatomy — shared skeleton

Every generated prompt is written in **English** and built from these sections, in this order. Omit a section when it genuinely doesn't apply (a 3-line mechanical task needs Goal + Done criteria and little else) — never pad.

## Skeleton

1. **Goal** — what is wanted and *why* / for whom. The motivation measurably improves performance across all four models: *"I'm working on [larger task] for [who]. They need [what the output enables]. With that in mind: [request]."*
2. **Context** — repo, files, current state, prior attempts, domain facts the target session cannot infer. Point at paths rather than pasting large content when the target session can read them.
3. **Constraints** — what must not change, conventions to follow, tech limits, scope boundaries ("only touch X; don't refactor Y").
4. **Done criteria** — verifiable: which tests pass, what behavior is observable, what the deliverable looks like. All four models benefit from a checkable definition of done.
5. **Autonomy & interaction** — whether the user is watching or the run is unattended; when to ask vs decide; what's reversible vs needs confirmation.
6. **Output expectations** — format of the final summary/deliverable, verbosity, language of the deliverable if it differs from English. Choose the **smallest output contract** that makes the answer easy to use — a short numbered list ("Output: 1. root cause · 2. evidence · 3. next step") beats an open-ended "report back".

## Shared blocks (model-agnostic, opt-in)

Include when the task type warrants them — the recipes in [recipes.md](recipes.md) pre-wire them:

**Missing-context gating** — when the target session might otherwise guess repo facts:
> Do not guess missing repository facts. Retrieve them with tools, or state exactly what remains unknown.

**Grounding** — for review, research, or root-cause analysis:
> Ground every claim in the code, logs, or tool outputs you inspected. Do not present inferences as facts — if a point is a hypothesis, label it clearly.

**Dig deeper** — for reviews and adversarial inspection:
> After the first plausible issue, also check second-order failures: empty-state handling, retries, stale state, concurrency, and rollback paths.

**Verification** — when correctness matters:
> Before finishing, verify the result against the done criteria. If a check fails, revise instead of reporting the first draft.

## Style rules

- **Goal + constraints over step lists.** Don't enumerate steps unless order is a genuine constraint — on Fable 5 step scaffolding actively reduces quality; on Opus 4.8 / Sonnet 5 it's followed literally, which removes the model's judgment.
- **Explicit scope.** These models don't generalize instructions on their own — if a rule applies everywhere, say "everywhere".
- **No aggressive language.** Never "CRITICAL: YOU MUST…", "If in doubt, use X" — current models follow prompts closely and these overtrigger. Plain "Use X when…" is enough.
- **Concise but complete.** One well-specified turn beats a short prompt plus five follow-ups.
- **One job per prompt.** Split unrelated asks ("review this AND update the docs AND propose a roadmap") into separate prompts — mixed jobs dilute each other and the output stops being usable as a unit.
- **Model snippets are opt-in.** Pull snippets from the model profile only when the task warrants them (autonomy → unattended runs; coverage-first → code review; propose-directions → open-ended design; etc.).
- **Markdown structure** — use short headed sections or bolded labels matching the skeleton above; skip headers for prompts under ~10 lines.
