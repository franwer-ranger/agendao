# Claude Fable 5 — prompting profile

Anthropic's most capable widely released model. Built for the most demanding reasoning and long-horizon agentic work: overnight coding runs, complex refactors completed without human correction, deep research, sustained sub-agent orchestration.

## Behavioral profile

- **Long turns by default** — single requests on hard tasks can run many minutes. The user should expect an async working style: check in on runs rather than watch every step.
- **Biggest gains are above prior models' ceiling** — first-shot implementations of well-specified systems, end-to-end deliverables, navigating ambiguity, parallel sub-agent delegation. Don't reserve it for tasks Opus already handles.
- **Very responsive to explicit instructions** — invest in communication-style and boundary sections in the prompt rather than fixing output downstream.
- Safety classifiers may decline research-biology and most cybersecurity content — don't route security-focused analysis here.

## Prompting rules

1. **Full task specification up front, in one well-specified turn.** State the goal, constraints, and what "done" looks like. Fable 5's long-horizon coherence comes from a clear up-front goal; ambiguous prompts revealed progressively reduce efficiency and quality.
2. **De-prescribe.** Step-by-step scaffolding written for prior models *reduces* Fable 5's output quality. State the goal and constraints; let it choose the steps. Remove "first do X, then Y, then Z" unless order is a genuine constraint.
3. **Give the reason, not just the request.** Template: *"I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request]."*

## Snippets (include only when the task warrants)

**Anti-overplanning** — for ambiguous tasks where it might deliberate too long:
> When you have enough information to act, act. Do not re-derive facts already established, re-litigate a decision already made, or narrate options you will not pursue. If you are weighing a choice, give a recommendation, not an exhaustive survey.

**Anti-overengineering** — for coding at higher effort:
> Don't add features, refactor, or introduce abstractions beyond what the task requires. Do the simplest thing that works well. Don't add error handling, fallbacks, or validation for scenarios that cannot happen; only validate at system boundaries.

**Grounded progress reports** — for long autonomous runs:
> Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. If tests fail, say so with the output; if a step was skipped, say that.

**Explicit boundaries** — when the deliverable is analysis, not changes:
> When I'm describing a problem or asking a question, the deliverable is your assessment. Report your findings and stop — don't apply a fix until asked. Before running a state-changing command, check the evidence actually supports that specific action.

**Autonomy** — for unattended/fire-and-forget runs:
> You are operating autonomously; I cannot answer questions mid-task. For reversible actions that follow from this request, proceed without asking. Before ending your turn, check your last paragraph: if it is a plan, a question, or a promise about work not yet done, do that work now. End only when the task is complete or you are blocked on input only I can provide.

**Async sub-agent delegation** — for parallelizable work (Fable 5's delegation is dependable; don't suppress it):
> Delegate independent subtasks to sub-agents and keep working while they run. Intervene if a sub-agent goes off track or is missing relevant context.

**Memory surface** — for multi-session work:
> Store lessons learned in [path], one lesson per file with a one-line summary at the top. Record corrections and confirmed approaches alike. Consult it at the start of the session; update existing notes rather than duplicating; delete notes that turn out wrong.

**Self-verification** — for long builds:
> Establish a method for checking your own work as you build; run it periodically, verifying against the specification with fresh-context sub-agents.

**Readable final summary** — for long agentic sessions:
> When you write the final summary, drop the working shorthand. Open with the outcome in one sentence, then supporting detail in complete sentences with terms spelled out. The reader didn't watch you work — don't use labels or abbreviations you invented along the way.
