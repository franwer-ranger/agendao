# Prompting guidance for interactive Codex GPT-5.6

Use this reference to turn understood intent into a lean, outcome-focused prompt. It summarizes the official GPT-5.6 prompting guidance verified on 2026-07-13 and adapts it to interactive Codex.

Official source: https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6

## Core contract

Describe the destination rather than every step. A strong prompt provides:

- the user-visible outcome;
- the purpose, consumer, or decision enabled when it changes the desired result;
- the context and evidence that materially affect the work;
- success criteria and a stopping condition;
- safety, business, scope, evidence, and permission constraints;
- tool-routing rules only when the route matters;
- the required validation and output shape.

Keep each instruction once. Contradictory or repeated rules can be more harmful than missing low-value detail.

## Scale the structure to the task

For a simple, well-scoped task, prefer one paragraph or a short list:

```text
<action and outcome>. Preserve <important constraint>. Verify <specific check> and return <required result>.
```

For complex work, use only the relevant parts of this structure:

```text
Objetivo
<user-visible outcome>

Contexto
<purpose when relevant, facts, files, current behavior, and evidence that affect the task>

Criterios de éxito
- <observable completion condition>

Restricciones
- <scope, safety, compatibility, evidence, or side-effect limit>

Alcance y autonomía
<what Codex may inspect or change, whether the run is attended, and what requires confirmation>

Herramientas
<required retrieval, relevant tools, routing, and meaningful fallback behavior>

Validación
<tests, checks, citations, visual review, or other evidence required before finishing>

Formato de salida
<only when the response needs a specific shape>
```

Do not include empty sections or a role that adds no useful perspective.

## Preserve intent and authority

Map the user's verb to the authorized layer of work:

- Answer, explain, review, diagnose, or plan: inspect relevant material and report the result; do not implement unless requested.
- Change, build, implement, or fix: make the requested in-scope local changes and run relevant non-destructive validation.
- Monitor or wait: define the condition, cadence, duration, and reporting behavior without expanding authority.
- Require confirmation before destructive actions, external writes, purchases, production changes, secret access, or material scope expansion.
- For an explicitly unattended run, authorize reasonable reversible choices and define the user-only blockers that justify stopping.

State this compactly and only when the boundary could otherwise be ambiguous.

## Tools and grounding

- Require prerequisite retrieval when correctness depends on current files, logs, documentation, or external facts.
- Name particular tools only when the route matters; otherwise describe the needed evidence.
- Parallelize independent reads when useful and keep dependent exploration sequential.
- Ask for one or two meaningful fallbacks when results are empty or suspiciously narrow.
- Do not request broad browsing, every available tool, or exhaustive exploration without a completion reason.
- For long tasks, request a short preamble and sparse updates only when user visibility matters.

## Verification and completion

Make validation observable and proportionate:

- Coding: targeted tests, type or build checks, linting when relevant, and inspection of the final diff.
- UI or visual work: render or run the interface and inspect important states at relevant sizes.
- Research or review: cite evidence, distinguish findings from inference, and cover the requested scope.
- Plans: include decisions, affected interfaces or data flow, failure behavior, validation, and only genuinely open questions.

End when the outcome and required checks are satisfied. Do not optimize for fewer tool calls at the expense of correctness or evidence.

## Avoid common regressions

- Do not ask the model to think step by step, reveal chain-of-thought, or explain hidden reasoning.
- Do not add generic instructions such as “be careful,” “be thorough,” or “use tools efficiently” without a concrete completion effect.
- Do not repeat tone, safety, approval, or formatting rules in multiple sections.
- Do not convert every preference into an absolute invariant.
- Do not add examples unless they encode a real output requirement or correct a demonstrated failure.
- For exact schemas or repeated batch work, a compact positive example may encode a real output requirement; keep it minimal and consistent with the instructions.
- Do not make a simple task look complex by forcing the full template.
- Do not include the chosen model or effort inside the generated task prompt; return them as separate configuration.
