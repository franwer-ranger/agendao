---
name: claude-prompting
description: Transform a user's intent into an optimized prompt for a Claude model (Fable 5, Opus 4.8, Sonnet 5, or Haiku 4.5), recommending the best model and reasoning effort for the task. Use when the user asks to "write a prompt for X", "promptéame esto", "convierte esta tarea en un prompt", "qué modelo/effort uso para X", "optimiza este prompt", or describes a task they want to hand off to another Claude Code session or agent as a prompt. The output prompt targets Claude Code / chat sessions. NOT for API system prompts with request parameters (thinking, max_tokens...), and NOT for non-Claude models (for Codex/GPT prompts use the codex plugin skills).
---

# Claude Prompting — model + effort recommendation and prompt crafting

Turn what the user wants to do into (a) a model + reasoning-effort recommendation and (b) a ready-to-paste prompt in English that follows that model's documented best practices.

Scope: exactly four models — **Claude Fable 5**, **Claude Opus 4.8**, **Claude Sonnet 5**, and **Claude Haiku 4.5** — and the Claude Code effort levels `low` / `medium` / `high` / `xhigh` / `max`. The first three take the effort dial; **Haiku 4.5 does not** (effort errors on it — it uses classic extended thinking, off by default), so it gets a model-only recommendation.

Language rule: talk to the user in **their language** (usually Spanish). The generated prompt is **always in English**.

## Execution model (the model running THIS skill)

Run this skill on **Sonnet 5 · `medium`** (skills inherit the session's model — this one doesn't pin it). Higher tiers also work but add nothing; don't run it on Haiku 4.5.

## Workflow

### 0. Check the executing model

First thing, before anything else: check which model you are running on (stated in your system prompt). If it is **not** Sonnet 5, open your response with a one-line notice — e.g. *"⚠️ Esta skill está pensada para Sonnet 5 · medium y la sesión corre en [model]; funciona igual pero gastas de más"* — then continue normally. Warn only; never block.

### 1. Understand the intent

Extract from the user's request:
- **Goal** — what they want, and why / for whom (the motivation improves model performance; ask for it if absent).
- **Context** — repo, files, current state, prior attempts the target model can't infer on its own.
- **Constraints** — what must not change, conventions, tech limits.
- **Done criteria** — how success is verified (tests, observable behavior, deliverable shape).
- **Autonomy** — will the user watch the session, or is it fire-and-forget?

If something decisive is missing, ask at most 2–3 questions with `AskUserQuestion`. If the task is clear enough to prompt well, do not ask — proceed.

**Two special cases at this step:**
- **Prompt-patching**: if the input is an *existing prompt* to improve ("optimiza este prompt", "este prompt no me funciona"), follow the Prompt-patching procedure in [references/recipes.md](references/recipes.md) instead of drafting from scratch — steps 2–5 below still apply (recommend model + effort, deliver in the standard format, plus the failure-mode diagnosis).
- **Multiple unrelated jobs**: if the request bundles unrelated asks, split them — one prompt per job, each with its own model/effort recommendation. Tell the user why.

### 2. Recommend model + effort

Read [references/model-selection.md](references/model-selection.md) and apply the decision matrix. **Always** present the recommendation explicitly with a 1–2 sentence justification — recommending model and effort is a hard requirement of this skill, even if the user already named a model (in that case validate or gently push back).

### 3. Load the model profile

Read the reference file for the chosen model plus the shared anatomy:
- [references/fable-5.md](references/fable-5.md)
- [references/opus-4-8.md](references/opus-4-8.md)
- [references/sonnet-5.md](references/sonnet-5.md)
- [references/haiku-4-5.md](references/haiku-4-5.md)
- [references/prompt-anatomy.md](references/prompt-anatomy.md)

### 4. Write the prompt

If the task matches an archetype in [references/recipes.md](references/recipes.md) (diagnosis, narrow fix, code review, research/recommendation), start from that recipe; otherwise draft from the anatomy skeleton. Apply the model-specific rules on top. Include **only** the model snippets that the task actually warrants — a short mechanical task does not need autonomy, memory, or delegation blocks. Prefer goal + constraints over step-by-step instructions.

Before delivering, check the draft against [references/antipatterns.md](references/antipatterns.md).

### 5. Deliver

Fixed output format (in the user's language, prompt in English):

1. **Recomendación**: `Modelo: <id> · Effort: <level>` + why, in 1–2 sentences. For **Haiku 4.5** drop the effort part — write `Modelo: claude-haiku-4-5` (no effort dial).
2. **El prompt**, in a fenced code block, ready to copy.
3. Optional single line: what to tweak if the user prefers another model.

## Maintenance note

The `references/` content is distilled from Anthropic's official model guides (behavioral shifts + effort guidance) as of 2026-07. When a new Claude model ships, add a new `references/<model>.md` and update `model-selection.md` — source the content from the `claude-api` skill / platform.claude.com migration guide, never from memory.
