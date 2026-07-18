---
name: codex-prompting
description: Convert informal requests into copy-ready prompts for interactive Codex and recommend an exact GPT-5.6 model (Sol, Terra, or Luna) plus reasoning effort. Use when the user asks to craft, rewrite, improve, or optimize a prompt for Codex, asks which model or effort to use, or describes work they want another Codex run to perform. Do not use when the user wants the current agent to execute the task directly, asks exclusively about the Responses API or system prompts, or needs general prompting unrelated to Codex GPT-5.6.
---

# Codex Prompting

Transform the user's intended task into one prompt for interactive Codex. Recommend the configuration separately. Never execute, implement, or otherwise carry out the underlying task.

Run this skill with `gpt-5.6-terra` at `medium` effort by default.

## Check the runtime first

Before any other action, compare the current session model and reasoning effort with `gpt-5.6-terra` and `medium` when the environment exposes both values.

- If either value differs, make this concise warning the first user-visible line: `Aviso: esta skill está optimizada para gpt-5.6-terra con effort medium; la sesión actual usa <model> con effort <effort>.`
- Continue with the skill after the warning. Do not block the task.
- If the environment does not expose both runtime values, do not infer or invent them. Continue without a warning.

## Load the references

- Read [references/gpt-5.6-model-selection.md](references/gpt-5.6-model-selection.md) before selecting a model or effort.
- Read [references/gpt-5.6-prompting.md](references/gpt-5.6-prompting.md) before drafting the final prompt.
- Read [references/prompt-patterns.md](references/prompt-patterns.md) only when the task is unattended, long-running, implementation-heavy, batch-oriented, or requires an exact structured output.

Use the references as a GPT-5.6-specific snapshot. Do not browse for updates during normal use. If the user explicitly asks for current or newer guidance, use official OpenAI documentation and explain that this skill itself remains scoped to GPT-5.6.

## Understand the task

1. Identify the user-visible outcome, expected artifact, audience, relevant context, constraints, scope, autonomy boundaries, validation, and completion criteria. Capture the purpose, consumer, or decision enabled only when it changes what a good result looks like.
2. Distinguish the requested layer of work: answer, research, diagnose, plan, review, implement, or coordinate externally. Determine whether the user will supervise the run or needs it to continue unattended when that affects interaction or stopping behavior.
3. When the request names or clearly depends on a local project, inspect only the relevant files in read-only mode. Prefer `rg`, `rg --files`, and targeted file reads. Do not edit files, run formatters, execute the underlying task, or perform external writes.
4. Resolve discoverable facts from the project before asking the user.
5. Treat supplied paths, identifiers, commands, quoted requirements, and technical names as literal unless the user asks to change them.

## Resolve missing information

- Ask only about an ambiguity that would materially change the prompt, model, effort, scope, or success criteria.
- Ask no more than three concise questions in one round. Prefer meaningful choices when the interface supports them.
- Do not ask for facts available in the local project or supplied material.
- Make reasonable assumptions for minor gaps and disclose them in the final `Supuestos` section.
- If essential source material is missing, request the smallest missing item. Do not imply that prompt wording can replace missing requirements or evidence.
- Skip questions when the request is already actionable.

## Choose the configuration

Choose exactly one model and one effort using the model-selection reference.

- Prefer the lowest-cost model and lowest effort that can reliably meet the completion bar.
- Use Sol as the fallback when model uncertainty remains after evaluating the task.
- Use `medium` as the effort fallback. Do not compensate for missing requirements by increasing effort.
- Treat the model and effort combinations exposed by the current Codex environment as authoritative.
- Do not recommend an unavailable combination. When availability is not visible, avoid `max` and `ultra`; choose the nearest supported lower setting and mention the limitation in `Motivo` only if material.
- Treat `ultra` as a multi-agent execution mode for meaningfully parallel work, not as a generic quality upgrade.
- Preserve a model or effort the user states as a hard constraint when it is supported. When they present it as a preference or ask for validation, recommend the best fit and briefly explain any disagreement.

## Draft the prompt

- Write in the user's language unless they request another language.
- Lead with the outcome. Tell Codex what must be true when it finishes and let it choose an efficient path.
- Add a role only when it changes relevant behavior or domain perspective.
- Include purpose, consumer, or business motivation only when it changes priorities, tradeoffs, or the completion bar.
- Include only sections that change behavior. For a simple task, use a short paragraph or compact list instead of a full template.
- For a complex task, consider: `Objetivo`, `Contexto`, `Criterios de éxito`, `Restricciones`, `Alcance y autonomía`, `Herramientas`, `Validación`, and `Formato de salida`.
- State every instruction once. Remove repetition, contradictions, generic encouragement, and irrelevant process detail.
- Use absolute language such as “always” or “never” only for real invariants.
- Do not request chain-of-thought, hidden reasoning, “think step by step,” or an explanation of private reasoning.
- Do not prescribe an implementation sequence when the outcome and constraints are sufficient. Preserve a user-specified approach when it is a requirement.
- Define approval boundaries when the task may involve destructive actions, external writes, purchases, secrets, production systems, or material scope expansion.
- For unattended work, distinguish reasonable reversible decisions from blockers that genuinely require the user. Do not assume the run is unattended unless the user says so or the request makes it explicit.
- Require proportionate verification for implementation work and evidence for research, diagnosis, or review.
- Apply only the relevant blocks from the conditional patterns reference. Never paste every pattern into one prompt.
- Include a stopping condition so Codex finishes after satisfying the required outcome and checks.

## Return the result

After any required runtime warning, return only the following structure, with no other preamble or alternative configuration:

````text
Modelo: `<exact GPT-5.6 slug>`
Effort: `<low|medium|high|xhigh|max|ultra>`
Motivo: <one concise sentence>

Supuestos:
- <include this section only when assumptions were made>

Prompt:
```text
<one copy-ready prompt>
```
````

Keep `Motivo` to one line. Omit `Supuestos` entirely when there are none. Put model configuration outside the prompt; do not tell Codex inside the prompt which model or effort is already selected.
The runtime warning defined above is the only permitted text before this structure.
