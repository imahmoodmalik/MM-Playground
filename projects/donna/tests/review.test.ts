import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleSession } from "../shared/demo.js";
import {
  containsQuote,
  exportReview,
  mapReferences,
  parseDocument,
  removeSourceFromSession,
  safeSourceUrl,
  localReview,
  isReviewItem,
  validateEvidence,
} from "../shared/review.js";
import { aiOutputSchema, analysisInputSchema, sessionSchema } from "../shared/schema.js";
import { runAnalysis } from "../server/analysis.js";
import type { Finding, LegalSource } from "../shared/types.js";

test("numbered sections retain multiple paragraphs and subclause labels", () => {
  const clauses = parseDocument(
    "Agreement\n\n1. Services\nWe provide support.\n\nService hours are agreed separately.\n\n1.1 Hours\nSupport is available daily.\n\n2. Liability\nSee clause 1.1.",
  );
  assert.deepEqual(
    clauses.map((c) => c.label),
    ["P1", "1", "1.1", "2"],
  );
  assert.match(clauses[1].text, /Service hours/);
  assert.equal(mapReferences(clauses)[0].related[0].targetId, clauses[2].id);
});

test("unstructured text uses paragraph labels without inventing clause numbers", () => {
  const clauses = parseDocument(
    "A title\n\nAn ordinary paragraph that has no section label.\n\nAnother paragraph.",
  );
  assert.deepEqual(
    clauses.map((c) => c.label),
    ["P1", "P2", "P3"],
  );
});

test("external law references are not reported as missing contract clauses", () => {
  const clauses = parseDocument(
    "1. Processing\nSubject to Article 24 of the Data Protection Law and clause 9.",
  );
  const findings = mapReferences(clauses);
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /9/);
});

test("duplicate numbering is ambiguous rather than an arbitrary jump", () => {
  const findings = mapReferences(
    parseDocument(
      "1. First\nOne provision.\n2. Review\nSee clause 1.\n1. Schedule\nA second provision.",
    ),
  );
  assert.equal(findings[0].kind, "missing-reference");
  assert.match(findings[0].title, /Ambiguous/);
  assert.equal(findings[0].related.length, 2);
});

test("shared vocabulary alone creates no review finding", () => {
  const findings = localReview(parseDocument(
    "1. Retention\nRetain data for 30 days.\n2. Backups\nDelete backups in 30 days.",
  ));
  assert.equal(findings.length, 0);
});

test("explicit references remain navigable without inflating the review queue", () => {
  const findings = localReview(parseDocument(
    "1. Services\nSee clause 2 and clause 99.\n2. Backups\nKeep daily backups.",
  ));
  assert.equal(findings.length, 2);
  assert.equal(findings[0].related[0].targetId, "clause-2");
  assert.deepEqual(findings.filter(isReviewItem).map((f) => f.kind), ["missing-reference"]);
  assert.equal(isReviewItem({ ...findings[0], kind: "connection", origin: "topic-match" }), false);
});

const clauses = parseDocument(
  "1. Retention\nDelete all customer data within 30 days.\n2. Backups\nRetain backup data for 180 days.",
);
const source: LegalSource = {
  id: "source-1",
  title: "Test authority",
  jurisdiction: "Test",
  version: "Test fixture",
  kind: "law",
  url: "https://example.com",
  text: "Personal data must be handled according to the applicable retention requirement.",
};
const finding: Finding = {
  id: "ai-test",
  kind: "connection",
  origin: "ai",
  title: "Check the timelines",
  explanation: "Compare these timelines.",
  clauseId: clauses[0].id,
  quote: "Delete all customer data within 30 days.",
  related: [
    {
      targetId: clauses[1].id,
      quote: "Retain backup data for 180 days.",
      reason: "Another retention period.",
    },
  ],
  sources: [],
  uncertainty: "Verify the context.",
  status: "open",
};

test("quotes tolerate layout whitespace while rejecting changed facts", () => {
  assert.equal(
    containsQuote("Data must\n be deleted.", "Data must be deleted."),
    true,
  );
  assert.equal(
    containsQuote("Delete in 30 days.", "Delete in 90 days."),
    false,
  );
  assert.equal(containsQuote("A paragraph", ""), false);
});

test("AI evidence must exist at both the anchor and every related passage", () => {
  assert.equal(validateEvidence([finding], clauses, []).accepted.length, 1);
  assert.equal(
    validateEvidence(
      [{ ...finding, quote: "An invented obligation" }],
      clauses,
      [],
    ).rejected,
    1,
  );
  assert.equal(
    validateEvidence(
      [
        {
          ...finding,
          related: [{ ...finding.related[0], targetId: "missing" }],
        },
      ],
      clauses,
      [],
    ).rejected,
    1,
  );
  assert.equal(
    validateEvidence(
      [
        {
          ...finding,
          related: [
            {
              ...finding.related[0],
              quote: "Retain backup data for 365 days.",
            },
          ],
        },
      ],
      clauses,
      [],
    ).rejected,
    1,
  );
});

test("a valid anchor alone is insufficient for a connection", () => {
  assert.equal(validateEvidence([{ ...finding, related: [] }], clauses, []).rejected, 1);
  assert.equal(validateEvidence([{ ...finding, explanation: " " }], clauses, []).rejected, 1);
  assert.equal(validateEvidence([{ ...finding, related: [{ ...finding.related[0], reason: " " }] }], clauses, []).rejected, 1);
});

test("the same evidence is shown once even when the relationship is reversed", () => {
  const reversed = {
    ...finding, id: "reversed", title: "A differently worded title",
    clauseId: clauses[1].id, quote: finding.related[0].quote,
    related: [{ targetId: clauses[0].id, quote: finding.quote, reason: "Sets the shorter deadline." }],
  };
  const result = validateEvidence([finding, { ...finding, id: "copy" }, reversed], clauses, []);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected, 2);
});

test("new AI output has a concise writing budget while older saved notes still load", () => {
  const verbose = { ...finding, explanation: "x".repeat(401) };
  assert.equal(aiOutputSchema.safeParse({ findings: [verbose] }).success, false);
  assert.equal(aiOutputSchema.safeParse({ findings: [{ ...finding, explanation: " " }] }).success, false);
  assert.equal(aiOutputSchema.safeParse({ findings: [{ ...finding, uncertainty: "" }] }).success, true);
  const session = exampleSession();
  session.findings.push({ ...verbose, clauseId: session.document.clauses[0].id, related: [] });
  assert.equal(sessionSchema.safeParse(session).success, true);
});

test("legal findings require valid supplied authority", () => {
  assert.equal(
    validateEvidence([{ ...finding, kind: "legal" }], clauses, []).rejected,
    1,
  );
  assert.equal(
    validateEvidence(
      [
        {
          ...finding,
          kind: "legal",
          sources: [
            {
              targetId: source.id,
              quote: source.text,
              reason: "Check application.",
            },
          ],
        },
      ],
      clauses,
      [source],
    ).accepted.length,
    1,
  );
  assert.equal(
    validateEvidence(
      [
        {
          ...finding,
          sources: [
            {
              targetId: source.id,
              quote: "A rule that is not in the authority.",
              reason: "False.",
            },
          ],
        },
      ],
      clauses,
      [source],
    ).rejected,
    1,
  );
});

test("unsafe source URLs cannot become clickable links", () => {
  assert.equal(safeSourceUrl("javascript:alert(1)"), undefined);
  assert.equal(safeSourceUrl("data:text/html,hello"), undefined);
  assert.equal(
    safeSourceUrl("https://example.com/source"),
    "https://example.com/source",
  );
});

test("saved reviews reject dangling links and retain review state", () => {
  const session = exampleSession();
  session.findings[0].status = "reviewed";
  const restored = sessionSchema.parse(JSON.parse(JSON.stringify(session)));
  assert.equal(restored.findings[0].status, "reviewed");
  session.findings[0].related[0].targetId = "does-not-exist";
  assert.equal(sessionSchema.safeParse(session).success, false);
});

test("export carries origin and limitations rather than a clearance claim", () => {
  const text = exportReview(exampleSession());
  assert.match(text, /Basis: example/);
  assert.match(text, /not a completeness or compliance certification/);
  assert.match(text, /Related clause 6/);
});

test("analysis validates context and the entire text budget", () => {
  assert.equal(
    analysisInputSchema.safeParse({
      clauses,
      sources: [],
      context: { jurisdiction: "", party: "", instructions: "" },
    }).success,
    false,
  );
  assert.equal(
    analysisInputSchema.safeParse({
      clauses: [
        { ...clauses[0], text: "x".repeat(90000) },
        { ...clauses[1], text: "y".repeat(90000) },
      ],
      sources: [],
      context: { jurisdiction: "Test", party: "Customer", instructions: "" },
    }).success,
    false,
  );
});

const input = {
  clauses,
  sources: [source],
  context: { jurisdiction: "Test", party: "Customer", instructions: "" },
};
function providerResponse(output: unknown, status = "completed"): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        status,
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(output) }],
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
}

test("provider integration sends structured output and verifies returned evidence", async () => {
  const { id: _id, origin: _origin, status: _status, ...rawFinding } = finding;
  let request: Record<string, unknown> = {};
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    request = JSON.parse(options.body as string);
    return providerResponse({
      findings: [
        rawFinding,
        { ...rawFinding, quote: "A fabricated anchor passage" },
      ],
    })("https://test");
  }) as typeof fetch;
  const result = await runAnalysis(
    input,
    "test-placeholder",
    "test-model",
    fetcher,
  );
  assert.equal(request.store, false);
  assert.equal(result.findings.length, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.findings[0].origin, "ai");
});

test("incomplete provider output never becomes a partial review", async () => {
  await assert.rejects(
    runAnalysis(
      input,
      "test",
      "test-model",
      providerResponse({ findings: [] }, "incomplete"),
    ),
    /did not finish/,
  );
});

test("internal policies cannot be the sole authority for legal findings", async () => {
  const { id: _id, origin: _origin, status: _status, ...raw } = finding;
  const result = await runAnalysis(
    { ...input, sources: [{ ...source, kind: "policy" }] },
    "test",
    "test-model",
    providerResponse({
      findings: [
        {
          ...raw,
          kind: "legal",
          sources: [
            { targetId: source.id, quote: source.text, reason: "Policy" },
          ],
        },
      ],
    }),
  );
  assert.equal(result.findings.length, 0);
  assert.equal(result.rejected, 1);
});

test("provider errors do not disclose provider response bodies", async () => {
  const fetcher = (async () =>
    new Response("sensitive body should never be displayed", {
      status: 401,
    })) as typeof fetch;
  await assert.rejects(
    runAnalysis(input, "test", "test-model", fetcher),
    (error) =>
      error instanceof Error &&
      /authenticate/.test(error.message) &&
      !/sensitive/.test(error.message),
  );
});

test("removing a source preserves reviewer notes and withdraws dependent AI findings", () => {
  const session = exampleSession();
  session.sources = [source];
  const note = {
    ...session.findings[0],
    id: "note",
    origin: "reviewer" as const,
    status: "reviewed" as const,
    sources: [
      { targetId: source.id, quote: source.text, reason: "My reference" },
    ],
  };
  session.findings = [note, { ...note, id: "ai-note", origin: "ai" }];
  const next = removeSourceFromSession(session, source.id);
  assert.equal(next.sources.length, 0);
  assert.equal(next.findings.length, 1);
  assert.equal(next.findings[0].id, "note");
  assert.equal(next.findings[0].sources.length, 0);
  assert.equal(next.findings[0].status, "open");
  assert.match(next.findings[0].uncertainty, /source was removed/);
  assert.equal(sessionSchema.safeParse(next).success, true);
});
