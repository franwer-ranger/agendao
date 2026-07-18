# GPT-5.6 model and effort selection

Use this reference to return one actionable Codex configuration. It summarizes the official Codex model guidance verified on 2026-07-13.

Official source: https://learn.chatgpt.com/docs/models

## Selection order

1. Check which models and efforts the current Codex environment exposes.
2. Determine whether a user-named model or effort is a hard constraint, a preference, or a request for validation.
3. Classify the task by ambiguity, complexity, stakes, required polish, repeatability, throughput, tool use, verification depth, and useful parallelism.
4. Choose the model first, then the lowest sufficient effort.
5. Prefer a clear usable recommendation over a theoretical maximum.

## Choose a model

### `gpt-5.6-sol`

Choose Sol for ambiguous, open-ended, difficult, high-value, or high-risk work that needs extra judgment, analysis, research, security awareness, computer use, or polished output. Examples include cross-cutting architecture changes, unfamiliar-system diagnosis, security reviews, deep research, critical migrations, and polished documents.

Use Sol when uncertain whether Terra can reliably meet the completion bar.

### `gpt-5.6-terra`

Choose Terra for everyday work that still needs strong reasoning and tools but has a reasonably understood outcome. Examples include routine feature implementation, ordinary debugging, focused refactors, test additions, code review, and well-scoped research.

Terra is the pragmatic default only when the task is understood and does not require Sol's depth or polish.

### `gpt-5.6-luna`

Choose Luna for clear, repeatable, well-specified, latency-sensitive, or high-volume work with an obvious success condition. Examples include extraction, classification, mechanical transformations, structured summaries, simple edits, and repetitive checks.

Do not choose Luna when the work depends on substantial ambiguity resolution, high-stakes judgment, architectural tradeoffs, or deep investigation.

## Choose an effort

Use the lowest level likely to pass the stated validation.

| Effort | UI label | Use when |
| --- | --- | --- |
| `low` | Light | The task is quick, reversible, narrowly scoped, and has an obvious answer or check. |
| `medium` | Medium | The task needs ordinary planning or tool use and balances speed with depth. This is the default. |
| `high` | High | The task spans several steps, components, sources, edge cases, or verification checks. |
| `xhigh` | Extra High | The task has material ambiguity, risk, cross-system tradeoffs, or requires deep synthesis and checking. |
| `max` | Max | A single exceptionally difficult problem needs maximum depth and latency or usage is secondary. |
| `ultra` | Ultra | Multiple independent workstreams can run in parallel and benefit from subagent synthesis. |

Apply these boundaries:

- Do not raise effort merely because the input is vague. Clarify the important gap first.
- Use `max` for hard, mostly singular reasoning such as a difficult algorithm, subtle root-cause investigation, or critical design decision that does not divide cleanly.
- Use `ultra` only when there are at least two meaningful independent workstreams and a synthesis step. Do not use it for sequential work, small tasks, or a single deep question.
- Prefer `xhigh` over `max` unless the task is genuinely exceptional and Max is available.
- Prefer `high` or `xhigh` over `ultra` when parallelism would only create coordination overhead.

## Compatibility

Use current environment capabilities when they are available. The verified fallback matrix for this skill version is:

| Model | Supported recommendations |
| --- | --- |
| `gpt-5.6-sol` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| `gpt-5.6-terra` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| `gpt-5.6-luna` | `low`, `medium`, `high`, `xhigh`, `max` |

Never recommend `gpt-5.6-luna` with `ultra`. Max and Ultra may require app settings, account eligibility, or model support. When the current environment does not establish their availability, fall back to `xhigh` rather than producing an unusable recommendation.

## Tie-breakers

- Preserve an explicit hard model or effort constraint when the combination is supported. If it is unavailable, recommend the nearest valid configuration and state why.
- Treat a proposed model or effort as a preference, not a constraint, when the user asks whether it is suitable. Recommend a better fit when the mismatch is material.
- Quality, ambiguity, or stakes dominate: move toward Sol.
- Cost, speed, and ordinary agentic work dominate: move toward Terra.
- Volume, repeatability, and deterministic output dominate: move toward Luna.
- If two efforts appear sufficient, choose the lower one.
- If the model choice remains uncertain, choose Sol with `medium`, then adjust effort only from the task's actual reasoning needs.
