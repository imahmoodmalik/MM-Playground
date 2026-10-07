import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewAgreement } from "../src/review-client.js";
import { parseDocument } from "../shared/review.js";
import { sessionSchema } from "../shared/schema.js";
import { exampleSession } from "../shared/demo.js";

const input = {
  clauses: parseDocument(
    "1. Deletion\nDelete the customer data within thirty days.\n2. Backup copies\nBackup copies are retained for one hundred and eighty days.",
  ),
  sources: [],
  context: {
    party: "Customer",
    jurisdiction: "Test jurisdiction",
    instructions: "Compare retention obligations.",
  },
};
const finding = {
  id: "ai-fixture",
  kind: "connection",
  origin: "ai",
  status: "open",
  title: "Check the retention periods",
  explanation: "Read the deletion and backup obligations together.",
  clauseId: input.clauses[0].id,
  quote: "Delete the customer data within thirty days.",
  related: [
    {
      targetId: input.clauses[1].id,
      quote: "Backup copies are retained for one hundred and eighty days.",
      reason: "Specifies a different retention period.",
    },
  ],
  sources: [],
  uncertainty: "Check the scope of customer data and backup copies.",
};
const response = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

test("review client refuses to transmit without the required review context", async () => {
  let sent = false;
  const fetcher = (async () => {
    sent = true;
    return new Response();
  }) as typeof fetch;
  await assert.rejects(
    reviewAgreement(
      { ...input, context: { ...input.context, party: "" } },
      undefined,
      fetcher,
    ),
    /party/,
  );
  assert.equal(sent, false);
});

test("review client accepts evidence-backed results and keeps a successful zero-finding response", async () => {
  const result = await reviewAgreement(
    input,
    undefined,
    response({ findings: [finding], rejected: 0 }),
  );
  assert.equal(result.findings[0].related[0].targetId, input.clauses[1].id);
  const empty = await reviewAgreement(
    input,
    undefined,
    response({ findings: [], rejected: 2 }),
  );
  assert.equal(empty.findings.length, 0);
  assert.equal(empty.rejected, 2);
});

test("review client rejects invented evidence instead of displaying it as an AI finding", async () => {
  await assert.rejects(
    reviewAgreement(
      input,
      undefined,
      response({
        findings: [
          { ...finding, quote: "Customer data may be retained forever." },
        ],
        rejected: 0,
      }),
    ),
    /could not be traced/,
  );
});

test("missing credentials and malformed success responses cannot become empty successful reviews", async () => {
  await assert.rejects(
    reviewAgreement(
      input,
      undefined,
      response({ error: "Analysis is not connected." }, 503),
    ),
    /not connected/,
  );
  await assert.rejects(
    reviewAgreement(input, undefined, response({ findings: "invalid" })),
    /could not be validated/,
  );
});

test("saved review records a completed zero-finding analysis without breaking older files", () => {
  const session = exampleSession();
  assert.equal(sessionSchema.safeParse(session).success, true);
  const record = {
    completedAt: new Date().toISOString(),
    clauseCount: session.document.clauses.length,
    sourceCount: 0,
    accepted: 0,
    rejected: 0,
  };
  const parsed = sessionSchema.parse({ ...session, analysis: record });
  assert.deepEqual(parsed.analysis, record);
});


test("review client also blocks unlinked and verbose AI findings", async () => {
  for (const invalid of [
    { ...finding, related: [] },
    { ...finding, explanation: "x".repeat(401) },
  ]) {
    await assert.rejects(reviewAgreement(input, undefined, response({ findings: [invalid], rejected: 0 })));
  }
});
