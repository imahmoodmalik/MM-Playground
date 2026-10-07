# Donna

Named after Donna Paulsen from *Suits*.

A working local document-review app: upload an agreement, read comments in context, follow connections to other clauses, and attach legal sources. Independent of `projects/touchline`.

## Run

Requires Node.js 22.12 or newer.

```sh
cd projects/donna
npm ci
npm run dev
```

Open **http://localhost:4173**. The welcome screen includes a clearly labelled fictional agreement with two editorial example comments. Real document import and reference mapping work without an API key.

### Connected workspace preview

Open **http://localhost:4173/?view=connected** for the light, Obsidian-inspired workspace. It starts with a fictional agreement. Use **Upload agreement** for your own file. Word reviewer comments are imported where their marker paragraph maps to one clause. Open a comment and choose **Find affected clauses** to review its concern against the whole agreement and supplied sources. You can also add a comment to any clause. **Review agreement** runs an agreement-wide review; governing law is required only when law or guidance excerpts are included. The **Review** panel collects findings across the document and shows AI suggestions, reference issues and comments. Explicit references stay in Links and do not count as review items. Click any result to see its clause and linked evidence. Search (`Cmd/Ctrl+K`), comments, source entry, document import and saved-review import/export work locally.

The workspace uses extracted text, not original PDF/Word page layout. Full AI review needs a server API key and explicit consent for each transmission. Until configured, the interface clearly reports that full analysis is not connected; no demo findings are substituted for AI output. Legal sources must be supplied by the reviewer. Changes remain in memory until downloaded with **Save**. The original review flow remains at the root URL.

## Available now

- Import searchable PDF, DOCX, TXT and Markdown, or paste document text.
- Preserve Word reviewer comments and author names at a uniquely matched paragraph; unplaceable comments are counted in import notes.
- Run a review from a specific comment, keep the result linked to that comment, and rerun it without replacing other comment reviews.
- Three-panel workspace: review queue, document and evidence.
- Follow explicit numbered references; flag missing and ambiguous targets.
- Shared keywords do not generate findings; explicit references remain navigable in Links.
- Add comments anchored to clauses, link another passage, and attach a supplied legal or policy reference.
- Import or paste source text with jurisdiction, version, type and original URL.
- Mark findings reviewed, search/filter comments, and browse the outline.
- Save a `.donna.json` review, reopen it through the upload control (older `.rooted.json` reviews remain supported), and export notes as Markdown.
- Optional AI review through server-side OpenAI Responses with structured output and quotation validation.

## Enable live analysis

Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and restart the server. `OPENAI_MODEL` defaults to `gpt-6-astra` and can be changed to an available model supporting structured outputs. Never place the key in client code or commit `.env`.

Choose **Review agreement** in the connected workspace (or **Review with AI** in the original flow), supply the represented party (and jurisdiction for legal sources), and authorize that review's transmission. Only then does the app send extracted document text, context and supplied source text to OpenAI. The server uses `store: false`; this alone does not guarantee zero provider retention.

New AI output is limited to a short title, 400-character explanation, 180-character evidence reasons and a 240-character specific uncertainty (or an empty string). The prompt asks for concrete interactions, no generic advice or process narration, no minimum count, and accurate treatment of exceptions. The server rejects unknown passage IDs, unsupported quotations, connections without another clause, empty explanations or link reasons, duplicate quoted relationships, incomplete responses, legal findings without sources, and legal findings supported only by an internal policy. Evidence validation checks textual support, not correctness of legal interpretation. No custom foundation model is required.

Without legal excerpts, AI review can assess internal relationships but must not return legal findings. The library links to official DIFC and Singapore PDPC starting points; **automatic legal database search and currency monitoring are not implemented**. Users supply relevant provisions and verify applicability.

Implementation reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Data and runtime

Document extraction and non-AI review run in the browser. Reviews live in memory, not browser storage or a database: save a review before closing the tab. Saved review files contain document and source text. The server does not persist uploaded material or log review content.

The server binds to loopback and checks Host/Origin headers. This local development build has no account system, multi-user authorization or production hosting configuration; do not expose it publicly as-is.

## Current limits

- Extracted text view, not original Word/PDF page layout. Tables and columns can lose structure.
- DOCX comments use their marker paragraph, not their original highlighted range. Ambiguous, unanchored or oversized comments are reported and not imported. Automatic numbering and tracked-change history are not preserved reliably. PDF annotations are not imported.
- No OCR. Low-text PDF pages are reported as incomplete input.
- Simple numbered references only; ranges, nested schedules and complex drafting need richer parsing.
- Older saved keyword matches remain available as links but are excluded from the connected workspace’s review queue.
- Supplied sources may be incomplete or outdated. Jurisdiction context alone does not establish applicability.
- No automatic redrafting, editing of the original file, or review-completeness certification.
- One document per review. Include related schedules in the same input; cross-document review is a next increment.
- Imports: 12 MB / 250,000 extracted characters, PDFs up to 150 pages. Live review: 300 passages, 10 sources and 120,000 characters total.

## Verification

```sh
npm test
npm run build
```

Tests cover parsing, explicit/missing/ambiguous references, external-law reference handling, suppression of keyword-only findings, navigation versus review counts, duplicate relationships and concise AI output limits, evidence validation, source URL safety, saved-review integrity, export provenance, input limits, incomplete model output, and provider errors. Model integration tests mock HTTP responses. A live model call requires an operator-supplied API key and has not been validated in this environment.

Browser checks: a real DOCX fixture containing a Word comment imports with the correct author, anchored clause and focused-review setup; missing credentials keep the submit action disabled. The fixture contains fictional data. Also checked: example review, related-clause navigation, review state, source entry, a comment with both clause and source evidence, missing-provider state, Word/PDF import, and restoration of a saved review.

## Layout

- `src/`: React interface and browser extraction.
- `shared/`: types, schemas, parser, reference mapping and export.
- `server/`: Express server and optional model integration.
- `tests/`: behavior and evidence-validation tests.

For a production bundle run `npm run build` then `npm start`. The same local-only networking boundary applies.

### Bilingual agreement terms

In the connected workspace, uploading a text-based English or Arabic agreement opens **Terms** automatically. Sections are grouped into payment, termination, liability, confidentiality and other topics using explicit bilingual vocabulary. A section can appear in multiple categories; clicking its passage jumps to the original section. Unmatched sections remain available under Other. Arabic text reads right to left and Arabic-Indic numbered headings and internal references are supported. This local grouping needs no AI key and does not establish legal risk or semantic impact between clauses.
