import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { readWordTree, anchorWordComments } from "../src/word-import.js";
import { applyReviewResult, parseDocument } from "../shared/review.js";
import { analysisInputSchema, sessionSchema } from "../shared/schema.js";
import { runAnalysis } from "../server/analysis.js";
import { reviewAgreement } from "../src/review-client.js";
import type { Finding, ReviewSession } from "../shared/types.js";

async function fixture() {
  const bytes = await readFile(
    new URL("./fixtures/commented-agreement.docx", import.meta.url),
  );
  // Node Mammoth reads a Buffer; the browser build reads an ArrayBuffer.
  const mammoth = createRequire(import.meta.url)(
    "mammoth",
  ) as typeof import("mammoth");
  let extracted: ReturnType<typeof readWordTree> | undefined;
  await mammoth.convertToHtml(
    { buffer: bytes },
    {
      transformDocument: (document) => {
        extracted = readWordTree(document);
        return document;
      },
    },
  );
  assert.ok(extracted);
  return extracted;
}

test("a real DOCX preserves a Word comment, its author and unique paragraph anchor", async () => {
  const extracted = await fixture();
  const clauses = parseDocument(extracted.text);
  const result = anchorWordComments(extracted.comments, clauses);
  assert.equal(result.findings.length, 1);
  assert.equal(result.unplaced, 0);
  assert.equal(result.findings[0].author, "Test reviewer");
  assert.equal(result.findings[0].imported, true);
  assert.equal(
    result.findings[0].clauseId,
    clauses.find((c) => c.label === "1")!.id,
  );
  assert.match(result.findings[0].explanation, /backups remain/);
  assert.match(result.findings[0].quote, /including backups/);
  assert.doesNotMatch(extracted.text, /Can we promise/);
});

test("ambiguous and missing Word comment anchors are counted instead of guessed", async () => {
  const extracted = await fixture();
  const clauses = parseDocument(extracted.text);
  const duplicate = { ...clauses[1], id: "duplicate" };
  assert.equal(
    anchorWordComments(extracted.comments, [...clauses, duplicate]).unplaced,
    1,
  );
  assert.equal(
    anchorWordComments([{ ...extracted.comments[0], paragraph: "" }], clauses)
      .unplaced,
    1,
  );
});

const clauses = parseDocument(
  "1. Deletion\nDelete all data in 30 days.\n2. Backups\nKeep all backup data for 180 days.",
);
const comment: Finding = {
  id: "reviewer-1",
  kind: "comment",
  origin: "reviewer",
  status: "open",
  title: "Does this include backups?",
  explanation: "Does this include backups?",
  clauseId: clauses[0].id,
  quote: "Delete all data in 30 days.",
  related: [],
  sources: [],
  uncertainty: "",
};
const focus = {
  commentId: comment.id,
  clauseId: comment.clauseId,
  quote: comment.quote,
  comment: comment.explanation,
};
const input = {
  clauses,
  sources: [],
  context: { party: "Customer", jurisdiction: "", instructions: "" },
  focus,
};
const raw = {
  kind: "connection",
  title: "Backups have a longer retention period",
  explanation:
    "§1 requires deletion in 30 days; §2 retains backups for 180 days.",
  clauseId: clauses[0].id,
  quote: "Delete all data in 30 days.",
  related: [
    {
      targetId: clauses[1].id,
      quote: "Keep all backup data for 180 days.",
      reason: "Sets the backup retention period.",
    },
  ],
  sources: [],
  uncertainty: "",
};
const response = (body: unknown) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(body) }],
        },
      ],
    }),
  );

test("comment review sends the concern with the agreement and rejects a different anchor", async () => {
  let sent: typeof input | undefined;
  const result = await runAnalysis(input, "test", "test", (async (
    _url,
    options,
  ) => {
    sent = JSON.parse(JSON.parse(options!.body as string).input);
    return response({
      findings: [
        raw,
        {
          ...raw,
          clauseId: clauses[1].id,
          quote: raw.related[0].quote,
          related: [
            {
              targetId: clauses[0].id,
              quote: raw.quote,
              reason: "Another deadline.",
            },
          ],
        },
      ],
    });
  }) as typeof fetch);
  assert.deepEqual(sent?.focus, focus);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].respondsTo, comment.id);
  assert.equal(result.rejected, 1);
});

test("focused review requires an existing quote, but internal clause review does not require a jurisdiction", () => {
  assert.equal(analysisInputSchema.safeParse(input).success, true);
  assert.equal(
    analysisInputSchema.safeParse({
      ...input,
      focus: { ...focus, quote: "Invented contract wording." },
    }).success,
    false,
  );
  assert.equal(
    analysisInputSchema.safeParse({
      ...input,
      sources: [
        {
          id: "law",
          title: "Law",
          kind: "law",
          jurisdiction: "",
          version: "",
          url: "",
          text: "A supplied legal excerpt with sufficient text.",
        },
      ],
    }).success,
    false,
  );
});

test("a comment rerun preserves other reviews and records a successful empty response", () => {
  const ai: Finding = {
    ...raw,
    kind: "connection",
    id: "ai-1",
    origin: "ai",
    status: "open",
    respondsTo: comment.id,
  };
  const whole = { ...ai, id: "whole", respondsTo: undefined };
  const otherComment = { ...comment, id: "reviewer-2" };
  const otherAi = { ...ai, id: "other", respondsTo: otherComment.id };
  const session: ReviewSession = {
    version: 1,
    document: { name: "Test", clauses, warnings: [], isExample: false },
    sources: [],
    context: input.context,
    findings: [comment, otherComment, ai, whole, otherAi],
  };
  const next = applyReviewResult(
    session,
    { findings: [], rejected: 0 },
    input.context,
    focus,
  );
  assert.deepEqual(
    next.findings.map((f) => f.id),
    [comment.id, otherComment.id, whole.id, otherAi.id],
  );
  assert.equal(next.commentReviews?.[0].accepted, 0);
  assert.equal(next.analysis, undefined);
  assert.equal(sessionSchema.safeParse(next).success, true);
  const full = applyReviewResult(
    session,
    { findings: [], rejected: 0 },
    input.context,
  );
  assert.ok(full.findings.some((f) => f.id === ai.id));
  assert.ok(!full.findings.some((f) => f.id === whole.id));
  assert.equal(
    sessionSchema.safeParse({ ...session, findings: [ai] }).success,
    false,
  );
});

test("the client refuses a result attributed to the wrong comment", async () => {
  const fetcher = (async () =>
    new Response(
      JSON.stringify({
        findings: [
          {
            ...raw,
            id: "ai",
            origin: "ai",
            status: "open",
            respondsTo: "wrong-comment",
          },
        ],
        rejected: 0,
      }),
    )) as typeof fetch;
  await assert.rejects(
    reviewAgreement(input, undefined, fetcher),
    /could not be traced/,
  );
});
