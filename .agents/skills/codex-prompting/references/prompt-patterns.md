# Conditional prompt patterns for Codex GPT-5.6

Use these patterns only when the task shape warrants them. Adapt them to the user's language and context instead of copying every block verbatim. Keep the final prompt lean and state each rule once.

Official alignment: https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6

## Purpose and consumer

Use when the larger objective, audience, or downstream decision changes priorities or the completion bar. Omit it when it would only add background.

```text
This work supports [larger objective] for [consumer]. They need the result to [decision or outcome enabled]. With that in mind, [requested outcome].
```

Do not ask for motivation merely to make the prompt sound richer. Ask only when different answers would materially change the result.

## Unattended autonomy and minor decisions

Use only when the user explicitly wants a fire-and-forget or unattended run.

```text
Continue autonomously through reversible, in-scope work. For minor choices among equivalent options, choose a reasonable default and record it instead of stopping. Ask or stop only when required input is unavailable, an action is destructive or external, or the decision would materially expand scope. Finish the requested work and validation before ending.
```

For an attended run, omit this block. Keep the ordinary approval boundaries and ask only about material decisions.

## Scope discipline

Use for focused implementation, bug fixes, and high-effort coding where incidental refactors or abstractions would create risk.

```text
Make the smallest coherent change that satisfies the requested behavior. Do not add unrelated features, refactor unaffected areas, or introduce abstractions without a concrete need from this task. Preserve existing conventions and compatibility outside the stated scope.
```

Do not use this block when the user explicitly requests broad redesign, cleanup, or exploration.

## Grounded progress and final reporting

Use for long-running or tool-heavy work where the user needs trustworthy progress and a useful handoff.

```text
Before the first tool call, state the immediate objective briefly. Update only at major phase changes, when evidence changes the approach, or when blocked. Tie claims about completed work, tests, and validation to results from this run; label anything unverified. In the final response, lead with the outcome, then give the validation evidence, material caveats, and next action if one remains.
```

Do not request silence between tool calls. Codex should provide sparse, outcome-based updates rather than narrating routine operations.

## Exact structured output and batch consistency

Use when a schema, parser, pipeline, or repeated transformation requires an exact result shape.

```text
Apply the same documented rule independently to every item and return exactly one result per input item. Follow this schema or positive example: [schema/example]. Do not add keys, wrappers, commentary, or formatting outside the required structure. Validate the item count, required fields, allowed values, and parseability before finishing.
```

Include a positive example only when it defines a real requirement. Keep it short and ensure it does not conflict with the written rules.

## Match prompt weight to the selected task shape

- When Luna is selected for a bounded task, keep the prompt tight. Prefer exact scope, a compact schema or example when required, and a direct completion check. Avoid long autonomy, memory, or delegation blocks.
- When Terra is selected for everyday agentic work, use the shared prompt anatomy and add only the task-relevant patterns above.
- When Sol is selected because the task is long, ambiguous, or high-stakes, consider purpose, autonomy, grounded progress, and stronger verification only when those needs are present.

These are task-shape adaptations, not claims that the three models have undocumented personalities.
