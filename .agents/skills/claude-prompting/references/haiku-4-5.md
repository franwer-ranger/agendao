# Claude Haiku 4.5 — prompting profile

Anthropic's fastest and most cost-effective model. The right choice for **simple, well-scoped, high-volume, and latency-critical** work — classification, extraction, format conversion, quick factual lookups, short explanations of standard concepts, and cheap sub-agents/workers. It sits **below** the Sonnet tier: reach for it when the task genuinely doesn't need Sonnet-or-better reasoning.

## Behavioral profile

- **Built for speed and cost, not deep reasoning.** It handles bounded tasks well; it is not the model for hard multi-step reasoning, long-horizon autonomy, or ambiguous problems. If the work needs more depth than it delivers, **step up to Sonnet 5** rather than trying to prompt around it.
- **Smaller envelope than the rest.** 200K context window (vs. 1M) and 64K max output (vs. 128K) — keep inputs and expected outputs modest, and stream when output is large.
- **Different thinking model.** Haiku 4.5 does **not** support the `low`/`medium`/`high`/`xhigh`/`max` effort dial — that parameter errors on it. It uses **classic extended thinking** (a thinking budget), which is **off by default**. Treat it as "thinking off unless explicitly enabled"; for anything that needs sustained reasoning, that's a signal to move up a tier.
- **Separate rate-limit pool** from older Haiku models — relevant only if you're ramping high-volume traffic.

## Prompting rules

1. **Scope tight and concrete.** Haiku rewards narrow, unambiguous tasks. State exactly what to do and what "done" looks like; don't leave it to infer intent.
2. **Show the shape you want.** For structured or formatted output, a short positive example of the desired result works better than prose describing it.
3. **Don't over-prompt.** Long autonomy / memory / delegation blocks are wasted here — this tier is for one-shot, bounded work, not orchestration.
4. **Escalate instead of pushing.** If a task starts needing multi-step reasoning, verification loops, or judgment calls, that's the cue to recommend Sonnet 5, not to pile on instructions.

## Snippets (include only when the task warrants)

**Verbosity control** — keep short-task output tight:
> Provide a concise, direct answer. Skip preamble and non-essential context.

**Format lock** — when the output must follow an exact shape:
> Return only the result in this exact format: [example]. Do not add explanation or commentary.

**Batch/consistency** — when applying the same operation across many items:
> Apply the same rule to every item, not just the first. Process each independently and return one result per item.
