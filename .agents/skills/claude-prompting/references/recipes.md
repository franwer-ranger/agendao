# Prompt recipes — end-to-end templates by task archetype

Start from the smallest recipe that fits, then trim what the task doesn't need and apply the chosen model's profile on top. These are skeletons, not final prompts — fill the brackets with the user's real context. Shared blocks (grounding, missing-context gating, dig-deeper) live in [prompt-anatomy.md](prompt-anatomy.md).

Typical pairings are a starting point; `model-selection.md` always wins.

## Diagnosis (bug/failure root-causing)

Typical pairing: Opus 4.8 · `high`–`xhigh` (Fable 5 for the ones nobody can crack).

```
Diagnose why [failing test / command / behavior] is breaking in [repo].

**Context:** [error output, when it started, what was tried, relevant paths]

**Approach:** I'm describing a problem, not requesting a fix — the deliverable is your diagnosis. Report your findings and stop; don't apply changes until asked. Don't guess missing repository facts: retrieve them with tools, or state exactly what remains unknown.

**Done criteria:** a root cause that matches the observed evidence — verify the match before finalizing.

**Output:** 1. most likely root cause · 2. evidence · 3. smallest safe next step. Label hypotheses as hypotheses.
```

## Narrow fix (scoped implementation)

Typical pairing: Sonnet 5 · `high` (Opus 4.8 if the fix touches subtle code).

```
Implement the smallest safe fix for [issue] in [repo/files]. Preserve existing behavior outside the failing path.

**Context:** [root cause if known, relevant paths]

**Constraints:** keep changes tightly scoped to this task — no unrelated refactors, renames, or cleanup. Apply the fix fully: don't stop after identifying the issue without fixing it.

**Done criteria:** [tests that must pass / behavior to verify]. Verify before finishing; if a check fails, revise instead of reporting the first draft.

**Output:** summary of the fix · touched files · verification performed · residual risks.
```

## Code review

Typical pairing: Opus 4.8 · `high`. Uses the coverage-first snippet from the model profiles.

```
Review [PR/diff/branch] for correctness and regression risks.

**Grounding:** ground every finding in the code or tool outputs; if a point is an inference, label it clearly.

**Depth:** after the first plausible issue, also check second-order failures: empty-state handling, retries, stale state, concurrency, and rollback paths.

**Coverage:** report every issue you find, including ones you are uncertain about or consider low-severity — do not filter for importance; I will rank findings downstream. Include confidence and estimated severity per finding.

**Output:** findings ordered by severity, each with evidence and a suggested fix direction.
```

## Research / recommendation

Typical pairing: Opus 4.8 · `high` (Fable 5 · `high` for deep multi-source research; add the search-first snippet on Opus).

```
Research [question/options] and recommend the best path for [context: what it's for, who decides].

**Method:** breadth first, then go deeper only where the evidence changes the recommendation. Separate observed facts, reasoned inferences, and open questions. Back important claims with explicit references to the sources you inspected; prefer primary sources.

**Output:** 1. observed facts · 2. recommendation with reasoning · 3. trade-offs · 4. open questions. Give a recommendation, not an exhaustive survey.
```

## Prompt-patching (improve an existing underperforming prompt)

This is the recipe for the "optimiza este prompt" trigger. Run it **yourself** inside the skill (don't hand it off): diagnose against the model profiles and anti-patterns, then deliver the revised prompt in the standard output format.

Procedure:
1. Identify the target model (ask if unstated) and read its profile plus [antipatterns.md](antipatterns.md).
2. Diagnose failure modes **from the prompt text and any failure examples the user provided** — don't invent failures the evidence doesn't support.
3. Rewrite applying the anatomy skeleton and the model profile; make the smallest high-leverage changes, not a gratuitous full rewrite.
4. Deliver: failure modes found → what changed and why → the revised prompt in a code block. Check the revision doesn't introduce contradictory instructions.
