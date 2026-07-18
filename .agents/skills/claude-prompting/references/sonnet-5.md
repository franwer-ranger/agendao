# Claude Sonnet 5 — prompting profile

Best speed/intelligence combination in the Sonnet tier — near-Opus quality on coding and agentic work at Sonnet cost. The right choice for well-specified implementation, fast turnaround, and cost-sensitive or high-volume tasks.

## Behavioral profile

- **Literal and explicit instruction interpretation**, especially at lower effort. It does not silently generalize one instruction to other items, and does not infer requests you didn't make. Great for tuned prompts and predictable pipelines.
- **More agentic than prior Sonnets** — reaches for tools and self-verification loops readily by default. (Exception: with thinking effectively off / very low effort it's less tool-eager — nudge explicitly if the task depends on tool calls.)
- **Response length calibrated to task complexity** — short on simple lookups, long on open-ended analysis.
- **Respects effort strictly at the low end** — at `low`/`medium` it scopes work to exactly what was asked. If reasoning comes out shallow on a complex task, raise effort rather than prompting around it.
- Provides good in-progress updates by default — don't add "summarize every N tool calls" scaffolding.

## Prompting rules

1. **State the scope explicitly.** Because of the literalism, an instruction meant to apply broadly must say so: *"Apply this formatting to every section, not just the first one."*
2. **Positive examples beat negative instructions.** Showing the desired concision/format works better than listing what not to do.
3. **Re-baseline inherited style directives.** "Be concise"-type lines carried over from prompts tuned for older models may now over-apply — include them only deliberately.
4. **Well-specified beats progressive.** Put task, intent, and constraints in the first turn; ambiguity revealed over multiple turns costs tokens and quality.

## Snippets (include only when the task warrants)

**Verbosity control** — when output must stay tight:
> Provide concise, focused responses. Skip non-essential context and keep examples minimal.

**Tool-use nudge** — if running at low effort and the task depends on tools/search:
> When the answer depends on information not present in the conversation, use the [tool] before answering — do not answer from prior knowledge.

**Complex reasoning at forced-low effort** — only if effort must stay low for latency:
> This task involves multi-step reasoning. Think carefully through the problem before responding.

**Code review, coverage-first** — same literalism issue as Opus: conservative-reporting filters depress recall:
> Report every issue you find, including ones you are uncertain about or consider low-severity. Do not filter for importance or confidence — your goal is coverage; a downstream step will rank findings. For each finding, include confidence and estimated severity.

**Design/frontend variety** — propose-then-pick is the recommended substitute for temperature-driven variety:
> Before building, propose 4 distinct visual directions tailored to this brief (bg hex / accent hex / typeface + one-line rationale). Ask me to pick one, then implement only that direction.

**Warmer tone** — if the default voice reads too dry for the deliverable:
> Use a warm, collaborative tone. Acknowledge the user's framing before answering.
