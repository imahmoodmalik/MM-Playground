# Touchline Product Requirements

> A coach’s workspace for choosing a starting eleven and explaining the reasoning behind it.

**Status:** Discussion draft for product and coaching review  
**Scope:** Next product release after the private prototype  
**Date:** 25 September 2026

## Product decision

Touchline should help a coach build a defensible match plan from the squad they actually have: available players, roles, opponent, style of play and the risks of each choice. It should expose the logic behind a formation and starting eleven so a coach can change the decision when new information arrives. The coach remains accountable for the selection.

**Recommendation.** Build a focused planning workflow for academy and amateur coaches first. Their data can be entered manually and their decisions are frequent enough to test the product without a costly performance data integration. Treat tactical suggestions as transparent prompts, not automated predictions.

## Who it serves

Primary user: a head coach or assistant preparing one team for its next match with a roster of roughly 18–30 players. They know football and need a faster, clearer way to test and communicate choices. Secondary users in a later phase: analysts and assistants contributing evidence or reviewing the plan. Spectators, fantasy players and live match management are outside the first release.

## The decision the coach is making

The job is not to maximize eleven individual ratings. It is to assemble a team that can execute a particular plan against a particular opponent, while accounting for availability, positional coverage and relationships between players. The output is a coherent starting XI, a shape in and out of possession, named responsibilities and a short account of the alternatives rejected.

## Planning workflow

| Stage | Coach provides | Touchline returns |
|---|---|---|
| 1 — Set the match | Opponent, fixture, objective and what is known or uncertain | A dated plan; unknown opponent information stays explicitly unknown. |
| 2 — Confirm availability | Available, doubtful or unavailable; minutes limits and selection notes | Eligible pool and warnings when a role has too few credible options. |
| 3 — Choose how to play | Press, build-up, transition, width, defensive approach and priorities | Two or three plausible shapes and the reasons each may help. |
| 4 — Choose the shape | A starting formation and possible phase changes | Pitch view for both phases, responsibilities and gaps in coverage. |
| 5 — Select the XI | Players for each role, partnerships, captain and set-piece assignments if relevant | A valid eleven, bench, positional fit and visible trade-offs. |
| 6 — Compare and commit | An alternative shape or player; coach’s final judgment | What changes, what risk remains and a saved rationale for the selected plan. |
| 7 — Revisit | Injury, late opponent information, or post-match observations | A revised plan with the changed assumption and previous decision retained. |

## Core product requirements

- **FR1 — Match plans.** Create, reopen, duplicate and revise a plan for one fixture. Store opponent, kickoff, selected XI, shape, rationale and version history.
- **FR2 — Roster.** Maintain name, shirt number, preferred foot, primary and secondary positions, availability, recent workload note and configurable attributes.
- **FR3 — Formation board.** Offer all football formations with role labels and separate example shapes in and out of possession. Role instructions can change without changing the formation label.
- **FR4 — Explainable suggestions.** Every suggestion identifies inputs and assumptions. The coach can accept, modify or reject it and record why.
- **FR5 — Comparisons.** Comparing candidate players or shapes shows role coverage, declared evidence and resulting team responsibilities rather than one unexplained score.
- **FR6 — Coach override.** The coach can finish with an unconventional XI after acknowledging material warnings. The product never silently repairs an override.

## Player information and validation

Attributes are coach assessments. A rating such as “passing 84” has no meaning without a scale, date, source and context. A rating can be left unassessed instead of forcing a guess.

- **Identity and roles:** stable player ID; display name and shirt number; at least one declared position with one marked primary; multiple secondary roles allowed.
- **Availability:** available, doubtful or unavailable; optional reason and minutes cap. Unavailable players cannot silently enter the XI.
- **Attributes:** shared core by position plus custom attributes. Assessed values are whole numbers 0–100 with plain-language anchors; unassessed is distinct from zero.
- **Evidence and freshness:** optional observation/match note, assessor, observation date and confidence. Surface stale or low-confidence data.
- **Data validation:** block duplicate shirt numbers, duplicate attribute names, unsupported roles, impossible numeric entries, missing required fields and duplicate XI assignments.
- **Football warnings:** warn rather than block on limited role cover, doubtful starter, high workload, missing evidence, unbalanced attack/defence or insufficient players for a shape.

## How the board should choose players

A role match is a starting constraint, not proof that a player should start. The selector first checks availability and minimum position cover for the shape. It preserves explicit coach choices where possible and presents alternatives based on chosen role responsibilities.

When the squad cannot fill all eleven roles, the board leaves those positions open and explains the gap. It must not silently assign a player to an unlisted role.

**Example:** if a coach chooses a back three but has only two eligible centre-backs, Touchline shows the third position as open. It may offer a player whose secondary role is centre-back or suggest a back four, while stating which assumption changed. The coach may override, but the plan records the override and rationale.

## Recommendations with limits

Use transparent rules in the first release. Suggestions may explain tactical logic and point to selected players, but cannot infer that the team will win or promise a numeric success probability. An unknown opponent profile produces a neutral starting point and a question for the coach, not invented scouting.

## Detailed interaction requirements

### Formation and team view
- Show base shape plus plausible in-possession and out-of-possession examples; make clear these are not fixed dots.
- When formation changes, preserve players in compatible roles where possible and explain vacancies/displaced starters.
- Bench contains only available squad members; doubtful players are visibly marked.

### Player editing
- Add/edit players from squad view and selected role. Validate while saving and offer a deliberate Validate action.
- If a starting player's only compatible position is removed, flag it, suggest alternatives and require resolution or explicit override before finalizing.
- Never convert blank attributes to zero. Avoid silently merging similarly named attributes.

### Explanation and comparison
- Summarize why the formation fits the objective, why selected players fit duties, weak coverage and what assumption would change the choice.
- Player comparisons compare like attributes and show missing data. Shape comparisons identify roles added/removed, width/central-cover changes and bench impact.
- Save free-text override reasons and final decisions with their inputs so later edits do not rewrite historical explanations.

## Acceptance scenarios

| Scenario | Expected result |
|---|---|
| Duplicate shirt number | Save blocked; conflicting number identified; draft intact. |
| Rating blank, 0, 100, 101 or 74.5 | Blank = unassessed; 0/100 save; 101/74.5 rejected. |
| Change 4–3–3 to 3–4–3 | Compatible choices remain; unfilled roles visible; alternative comparable before commitment. |
| Late injury makes starter unavailable | Plan flagged; compatible replacements shown; previous version retained. |
| Another editor saves first | Later save does not overwrite newer plan; coach can compare and resolve conflict. |

## Release sequence

**Current prototype:** formation exploration, account-saved squad editing, structural validation and basic suggestions.

**First product release:** fixture plans, availability, primary roles, meaningful warnings, evidence attached to assessments, comparisons, saved rationale and plan revisions.

**Later experiments:** assistant collaboration, opponent clips/data imports, set-piece responsibilities, post-match reflection and learning from overrides.

## What success means

- **Activation:** coach enters at least 15 usable players and completes one match plan without facilitator help.
- **Repeat use:** same coach prepares at least three separate fixtures within six weeks.
- **Decision clarity:** coaches explain chosen XI and one alternative using the saved plan; reviewers identify assumptions without a live walkthrough.
- **Trust and friction:** track warnings acknowledged, recommendations overridden with reasons, erroneous role suggestions, stale assessments and time to complete.
- **Data quality:** track missing availability, unassessed core attributes and plans with open roles at commitment.

## Risks and design responses

- **False precision:** show source, date and confidence; allow unassessed values; avoid universal player scores.
- **Formation determinism:** label phase shapes as examples and explain movement/cover through role instructions.
- **Recommendation bias:** present assumptions and plausible alternatives; invite overrides and review errors with coaches.
- **Incomplete squads:** keep manual entry fast, leave gaps visible and allow draft plans.

## Questions for product review

- Is the first user an academy head coach, amateur coach, or assistant analyst?
- What evidence can coaches enter in under ten minutes?
- When should an out-of-position choice warn versus block?
- Should staff sharing be in the first release, or is export sufficient?
- Which two or three real coaching decisions should we observe end-to-end before setting success targets?

---

**DISCUSSION DRAFT · 25 SEPTEMBER 2026**
