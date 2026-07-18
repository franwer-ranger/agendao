# Anti-patterns — bad → better

Common failure modes when prompting current Claude models. Check generated prompts (and prompts submitted for patching) against this list.

## Vague task framing

Bad:
> Take a look at this and let me know what you think.

Better:
> Review this change for correctness and regression risks. Output: findings ordered by severity, each with evidence.

## Aggressive instruction language

Bad:
> CRITICAL: You MUST use the search tool. If in doubt, ALWAYS search.

Better:
> For questions where current information would change the answer, search before answering rather than answering from memory.

Current models follow prompts closely — shouty imperatives overtrigger the behavior.

## Step-by-step scaffolding when the goal suffices

Bad:
> First open the file, then find the function, then check its callers, then write the fix, then run the tests, then...

Better:
> Fix [issue] in [file]. Done means [tests] pass. Keep the change scoped to the failing path.

On Fable 5, step scaffolding actively *reduces* quality; on Opus 4.8 / Sonnet 5 it's followed literally, removing the model's judgment. Enumerate steps only when order is a genuine constraint.

## Vague done criteria

Bad:
> Make sure it works properly.

Better:
> Done means: `swift test` passes, the profile screen loads with a cold cache, and no `NetworkingKit` references remain (verify with a repo-wide search).

## Mixing unrelated jobs in one prompt

Bad:
> Review this diff, fix whatever you find, update the docs, and propose a roadmap for the module.

Better: one prompt per job — review first; a separate fix prompt with the confirmed findings; docs/roadmap as their own runs. Unrelated asks dilute each other and make the output unusable as a unit.

## Unsupported certainty demanded

Bad:
> Tell me exactly why production failed.

Better:
> Identify the most likely root cause. Ground every claim in the logs or code you inspected; if a point is an inference, label it clearly, and state exactly what remains unknown.

## Missing output contract

Bad:
> Investigate and report back.

Better:
> Output: 1. root cause · 2. evidence · 3. smallest safe next step.

Choose the smallest contract that makes the answer easy to use — a short numbered list beats an open-ended "report".

## Implicit scope

Bad:
> Format the dates as ISO-8601.

Better:
> Format the dates as ISO-8601 in every section of the report, not just the first one.

These models interpret literally and don't generalize an instruction from one item to the rest — state the scope.

## Asking for "more thinking" instead of fixing the prompt or the effort

Bad:
> Think really hard and be very thorough.

Better: give a verification requirement ("before finishing, verify the result against [done criteria]; if a check fails, revise") — and if reasoning is genuinely shallow, raise the **effort level**; that's what the dial is for on Claude.
