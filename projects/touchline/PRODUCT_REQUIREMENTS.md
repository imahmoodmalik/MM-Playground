Touchline

An open football tactics and starting XI studio.

Touchline is a football planning application for building formations, selecting players, experimenting with tactical systems, and explaining why an XI makes sense.

The goal is not to find a mathematically “best” eleven.

The goal is to give someone a canvas for answering a much more interesting question:

Given these players, this opponent, and the way I want my team to play — what should my team look like, and why?

Touchline should work first as a public football sandbox anyone can use. Over time, it can become a deeper workspace for coaches, analysts and clubs using their own squads and, where licensing permits, real current and historical football data.

Current status: Experimental / active development
Specification: v2.0
Updated: 25 September 2026

⸻

1. Product principles

Touchline should be built around six principles.

1.1 The formation belongs to the user

Football cannot be reduced to a predefined list of formations.

Presets such as:

* 4–3–3
* 4–2–3–1
* 4–4–2
* 3–5–2
* 3–4–3
* 5–3–2
* 4–1–4–1
* 3–2–4–1

are useful starting points, but they are templates rather than constraints.

Users should ultimately be able to place eleven players freely, define their own roles and describe how those positions change through different phases of play.

A nominal 4–3–3 might therefore become:

3–2–5 in possession

and:

4–5–1 out of possession

without Touchline treating these as contradictory formations.

⸻

1.2 Players are more than ratings

Touchline should never reduce a player to one universal number.

Player information may eventually include:

Identity

* Name
* Date of birth
* Nationality
* Team
* Shirt number
* Preferred foot

Roles

* Primary position
* Secondary positions
* Custom roles

Observed performance

* Minutes
* Passing
* Carries
* Pressures
* Duels
* Shots
* Other licensed event or tracking data

Coach assessments

* Technical
* Tactical
* Physical
* Mental
* Custom attributes

Context

* Season
* Competition
* Team
* Assessment date
* Source
* Confidence
* Sample size

Missing information must remain missing.

Unknown ≠ 0

⸻

1.3 The system explains; the user decides

Touchline can:

* identify positional gaps;
* compare alternatives;
* identify role mismatches;
* surface constraints;
* suggest formations;
* identify trade-offs;
* generate tactical questions;
* explain why an alternative might work.

Touchline should not pretend that football can be solved deterministically.

Recommendations must expose:

Inputs → assumptions → reasoning → recommendation → uncertainty

The final decision belongs to the user.

⸻

1.4 Football is dynamic

The pitch is not eleven dots.

Touchline should eventually represent at least:

1. Base shape
2. In possession
3. Out of possession
4. Transition

A player’s identity remains constant while their position and responsibility may change between phases.

⸻

1.5 Historical context matters

If real football data is introduced, Touchline must understand time.

A user should eventually be able to ask:

What would this team have looked like in the 2020/21 season?

without today’s transfers, roles or statistics contaminating that historical view.

Player data therefore needs to be associated with:

Player + team + competition + season + date + source

rather than simply:

Player

⸻

1.6 Real football data is optional infrastructure

Touchline must remain useful without commercial football data.

The core application should work with:

* fictional players;
* manually entered players;
* imported private squads.

Real player data can later be added through licensed providers.

Potential providers include Opta/Stats Perform, Hudl StatsBomb/Wyscout and Sportradar.

Provider integrations should use an adapter architecture so the product is not structurally dependent on one vendor.

⸻

2. Who Touchline is for

Public explorer

Someone interested in football tactics who wants to:

* build an XI;
* experiment with formations;
* create custom systems;
* compare players;
* understand tactical trade-offs;
* share a tactical board.

No coaching organization should be required.

⸻

Coach

Someone preparing a real team who wants to:

* maintain their squad;
* track availability;
* define roles;
* assess players;
* prepare for an opponent;
* create a match plan;
* compare alternatives;
* communicate responsibilities.

⸻

Analyst / staff

A future collaborative user who may:

* contribute observations;
* import data;
* compare players;
* review tactical alternatives;
* collaborate on match plans.

This is not required for the initial release.

⸻

3. Core experience

A complete Touchline workflow should eventually look like:

MATCH / EXPERIMENT
        ↓
CONTEXT
        ↓
SQUAD
        ↓
PLAYING IDEA
        ↓
FORMATION
        ↓
ROLES
        ↓
STARTING XI
        ↓
ALTERNATIVES
        ↓
WARNINGS / TRADE-OFFS
        ↓
RATIONALE
        ↓
SAVE / SHARE

The user should be able to move backwards at any point.

Changing an assumption should update the consequences without silently destroying previous decisions.

⸻

4. Formation Studio

The Formation Studio is the core Touchline interface.

4.1 Free canvas

Users should eventually be able to:

* create eleven positional slots;
* drag them anywhere on the pitch;
* position using touch;
* position using keyboard;
* rename roles;
* define width and depth;
* save a system;
* duplicate a system.

Exactly one position must be designated goalkeeper for a committed 11v11 system.

⸻

4.2 Formation templates

Templates provide fast starting points.

Initial template families should include common systems such as:

* 4–4–2
* 4–3–3
* 4–2–3–1
* 3–5–2
* 3–4–3
* 5–3–2
* 4–1–4–1
* 3–2–4–1

Templates must be data/content rather than application logic.

Adding a formation should therefore not require changing the core application.

⸻

5. Tactical phases

A formation can contain multiple snapshots.

BASE
      ST
LW            RW
    CM    CM
       DM
LB   CB   CB   RB
       GK

might become:

IN POSSESSION
LW   ST   10   RW
   8         8
LB     DM     RB
    CB    CB
       GK

The same players remain assigned.

Only their tactical positions and responsibilities change.

⸻

6. Roles and instructions

Positions and roles are different concepts.

A player positioned at right-back might have the role:

Inverted Fullback

with instructions such as:

* invert during build-up;
* join midfield;
* protect central transition;
* press opposition winger;
* recover into back four.

Touchline should support predefined instructions and free-text instructions.

Potential instructions include:

* invert;
* overlap;
* underlap;
* hold width;
* occupy half-space;
* drop between centre-backs;
* stay high;
* attack box;
* cover centre;
* trigger press.

⸻

7. Squad and player model

A player should have a stable internal identity.

Example:

Player
├── Identity
├── Team memberships
├── Positions
├── Attributes
├── Assessments
├── Observed statistics
├── Availability
└── Evidence

Shirt number, club and position are properties of the player in context — not permanent identifiers.

⸻

8. Player creation and editing

Users should be able to:

* create a player;
* edit a player;
* duplicate a private player;
* import players;
* assign primary position;
* assign multiple secondary positions;
* define preferred foot;
* define attributes;
* mark attributes unknown;
* attach assessment context.

A player may have custom attributes.

Example:

Passing          84
Press resistance 76
Acceleration     81
Defensive IQ     73
Leadership       Unknown

Unknown must never silently become 0.

⸻

9. Validation model

Touchline should distinguish:

Error

The state is structurally invalid.

Examples:

* same player assigned twice;
* eleven-player plan contains ten players;
* no goalkeeper;
* invalid attribute value;
* duplicate player identity;
* malformed import.

Errors may prevent final commitment.

Warning

The decision may be unusual or risky but remains valid.

Examples:

* player outside preferred position;
* doubtful player starting;
* high workload;
* weak defensive coverage;
* limited evidence;
* insufficient role familiarity;
* asymmetrical shape.

Warnings should not automatically change the user’s decision.

The user can acknowledge or override them.

⸻

10. Selection engine

Touchline should eventually help assemble an XI.

The engine should evaluate:

1. Availability
2. Eligibility
3. Formation requirements
4. Role compatibility
5. Coach priorities
6. Available evidence
7. Existing locked selections

It should then produce alternatives rather than one supposedly correct answer.

For example:

Option A — strongest role fit

Prioritizes player-role compatibility.

Option B — lower-risk structure

Prioritizes positional coverage and balance.

Option C — tactical alternative

Changes one or more assumptions to create a meaningfully different approach.

Every recommendation should explain itself.

⸻

11. Explainability

A recommendation should resemble:

This 3–2–4–1 provides an additional central build-up player against the opponent’s two-player press.

Player A remains at centre-back because of his declared ball-playing role and available passing evidence.

Player B moves into midfield during possession.

The main trade-off is reduced natural width on the right.

If width becomes a higher priority, consider Player C or restore the right wing-back role.

Not:

Formation suitability: 92%

unless a clearly defined calculation justifies exactly what that number means.

⸻

12. Comparison

Users should be able to compare:

Player vs player

Show:

* relevant shared attributes;
* missing data;
* role suitability evidence;
* season/context;
* availability;
* source.

Formation vs formation

Show:

* roles added;
* roles removed;
* player displacement;
* width;
* central coverage;
* defensive structure;
* bench impact.

The comparison should explain differences rather than merely produce a winner.

⸻

13. Historical mode

Future versions may support:

Player
   ↓
Season
   ↓
Competition
   ↓
Team
   ↓
Snapshot date

Example:

Mohamed Salah — Liverpool — Premier League — 2018/19

should be treated as a contextual player record rather than automatically using current information.

Historical plans should remain reproducible.

⸻

14. Real football data

Commercial football data is a future enhancement, not a prerequisite.

Potential providers:

* Opta / Stats Perform
* Hudl StatsBomb
* Wyscout
* Sportradar
* specialist tracking providers

Touchline should implement provider adapters:

                 TOUCHLINE
                     │
              Canonical model
                     │
          ┌──────────┼──────────┐
          │          │          │
        Opta     StatsBomb   Sportradar

The application should know exactly:

* provider;
* competition;
* season;
* metric definition;
* coverage;
* source timestamp;
* ingestion timestamp.

Provider data must only be exposed where the relevant license permits the intended use.

When coverage is unavailable:

show missing data.

Do not fabricate it or silently substitute another source.

⸻

15. Sharing

Users should eventually be able to generate a shareable tactical board.

Public boards should contain only information permitted for public display.

Private information such as:

* injury notes;
* workload;
* private assessments;
* staff comments;
* restricted provider fields

must not automatically appear in public views.

⸻

16. Accessibility

The pitch cannot depend entirely on drag-and-drop.

Every important action should eventually have:

* mouse;
* touch;
* keyboard;
* list-based alternative.

Touchline should target WCAG 2.2 AA for critical workflows.

⸻

17. Functional acceptance scenarios

FR01 — Custom formation

A user creates an asymmetric eleven-player system without selecting a preset, names its roles and saves it as a reusable template.

FR02 — Tactical phases

A user moves roles across base, possession, defensive and transition phases while player identity remains attached.

FR03 — Invalid XI

A lineup containing:

* duplicate player;
* ten starters;
* no goalkeeper

cannot be committed.

The draft remains intact.

FR04 — Custom attributes

A coach creates a custom attribute with a defined range and description.

The same validation applies during manual editing and import.

FR05 — Attribute boundaries

For an integer 0–100 attribute:

Blank → Unknown ✓
0     → Valid ✓
100   → Valid ✓
101   → Invalid ✗
74.5  → Invalid ✗

FR06 — Historical player

Two seasons belonging to the same player remain distinct.

Historical plans remain reproducible.

FR07 — Missing provider coverage

Unsupported competition/season data is shown as unavailable.

Nothing is fabricated.

Manual player creation remains available.

FR08 — Availability

A doubtful starter or minutes restriction generates a warning.

The user can select an alternative or explicitly override it.

FR09 — Public sharing

Private information and provider fields without sharing rights are excluded from public boards.

FR10 — Concurrent editing

Two editors cannot silently overwrite one another’s fixture changes.

⸻

18. Non-functional requirements

Touchline should eventually support:

Performance

* responsive pitch interactions;
* reasonable search latency;
* fast plan loading.

Accessibility

* WCAG 2.2 AA target;
* keyboard navigation;
* screen reader support;
* reduced motion;
* appropriate touch targets.

Internationalization

* football/soccer terminology;
* localized dates;
* metric units;
* names with diacritics;
* RTL readiness.

Reliability

* autosave;
* draft recovery;
* failed-request recovery;
* version history.

Security

* scoped authorization;
* encrypted transport/storage;
* audit logging;
* export/deletion controls;
* rate/abuse limits.

⸻

19. Development roadmap

Stage 0 — Prototype

Existing capabilities:

* preset formations;
* fictional squad;
* account-saved player editing;
* configurable attributes;
* basic structural validation;
* basic suggestions.

Purpose:

Understand the existing implementation before replacing or extending it.

⸻

Stage 1 — Touchline Foundation

Build:

* free tactical canvas;
* formation templates;
* player management;
* starting XI;
* bench;
* custom attributes;
* validation;
* local/private plans.

Exit condition

A user can create a squad and construct, save and reopen a valid starting XI using a custom tactical system.

⸻

Stage 2 — Tactical Model

Build:

* multiple phases;
* role instructions;
* tactical warnings;
* formation comparison;
* player comparison;
* coach rationale.

Exit condition

A user can explain not only who is selected but how the team is intended to operate.

⸻

Stage 3 — Match Planning

Build:

* fixtures;
* opponents;
* availability;
* match objectives;
* versioned plans;
* tactical alternatives.

Exit condition

A coach can use Touchline repeatedly as part of real match preparation.

⸻

Stage 4 — Football Data Pilot

Integrate one licensed provider for explicitly supported competitions and seasons.

Build:

* provider adapter;
* canonical player identity;
* coverage registry;
* historical snapshots;
* provenance;
* rights-aware rendering.

Exit condition

No unsupported, incorrectly contextualized or unlicensed provider field appears publicly.

⸻

Stage 5 — Collaboration and Intelligence

Explore:

* staff collaboration;
* comments;
* tactical assistant;
* video;
* set pieces;
* post-match reflection;
* learning from coach overrides.

These should only be prioritized after repeated usage of the core planning workflow.

⸻

20. Success signals

Early success should focus on whether Touchline helps people construct and reason about football systems.

Track:

* completed XIs;
* custom formations created;
* plans saved;
* plans revisited;
* player comparisons;
* formation comparisons;
* warnings resolved or overridden;
* plans shared;
* repeat users;
* time to first completed XI.

For coaching users:

Can the coach explain the selected XI, tactical structure and rejected alternative from the saved plan?

That matters more than whether the team won its next match.

⸻

21. Open product questions

1. Should Touchline begin primarily as a public football sandbox or a coach planning tool?
2. At what point does account creation become necessary?
3. What should remain usable without commercial football data?
4. Which provider, leagues and seasons would justify the first licensed data experiment?
5. How sophisticated should tactical heuristics become before they create false confidence?
6. How should custom roles interact with standardized football positions?
7. Which parts of a tactical board should be shareable without an account?
8. Should formations be stored as normalized tactical objects so community-created templates can eventually be shared?
9. Should the first Touchline release support mobile editing or prioritize desktop planning with mobile viewing?
10. How should AI participate: tactical questioning, explanation, alternative generation, or eventually all three?

⸻

22. Out of scope for the initial build

Unless required by the foundational architecture, do not prioritize:

* match-result prediction;
* universal player ratings;
* live match management;
* fantasy football;
* transfer valuation;
* betting;
* automated scouting claims;
* video analysis;
* tracking-data visualization;
* social network functionality;
* broad multi-provider integration.

Build the planning experience first.

⸻

23. Repository philosophy

This repository is an experimental build environment.

Changes should preferably follow:

PRODUCT IDEA
     ↓
SPECIFICATION
     ↓
GITHUB ISSUE
     ↓
BRANCH
     ↓
IMPLEMENTATION
     ↓
TEST
     ↓
PULL REQUEST
     ↓
REVIEW
     ↓
MERGE

Large product requirements should be decomposed into small, independently review
