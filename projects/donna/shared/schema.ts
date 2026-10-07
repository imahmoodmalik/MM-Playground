import { z } from "zod";
import { containsQuote } from "./review.js";

export const clauseSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().max(100),
  title: z.string().max(1000),
  text: z.string().min(1).max(100000),
  page: z.number().int().positive().optional(),
});
export const sourceSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  jurisdiction: z.string().max(300),
  version: z.string().max(200),
  url: z.string().max(2000),
  kind: z.enum(["law", "guidance", "policy"]),
  text: z.string().min(20).max(60000),
});
export const contextSchema = z.object({
  jurisdiction: z.string().max(300),
  party: z.string().max(300),
  instructions: z.string().max(4000),
});
const evidenceSchema = z.object({
  targetId: z.string().min(1).max(100),
  quote: z.string().min(1).max(5000),
  reason: z.string().max(2000),
});
export const findingSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum([
    "reference",
    "missing-reference",
    "connection",
    "legal",
    "comment",
  ]),
  origin: z.enum([
    "reference-check",
    "topic-match",
    "reviewer",
    "ai",
    "example",
  ]),
  title: z.string().min(1).max(300),
  explanation: z.string().max(6000),
  clauseId: z.string().min(1).max(100),
  quote: z.string().max(5000),
  related: z.array(evidenceSchema).max(100),
  sources: z.array(evidenceSchema).max(30),
  uncertainty: z.string().max(3000),
  status: z.enum(["open", "reviewed"]),
  respondsTo: z.string().min(1).max(100).optional(),
  author: z.string().max(300).optional(),
  imported: z.boolean().optional(),
});
const reviewRunSchema = z.object({
  completedAt: z.iso.datetime(),
  clauseCount: z.number().int().min(1).max(300),
  sourceCount: z.number().int().min(0).max(10),
  accepted: z.number().int().min(0).max(20),
  rejected: z.number().int().min(0).max(20),
});
export const reviewFocusSchema = z.object({
  commentId: z.string().min(1).max(100),
  clauseId: z.string().min(1).max(100),
  quote: z.string().min(8).max(5000),
  comment: z.string().trim().min(1).max(6000),
});
export const sessionSchema = z
  .object({
    version: z.literal(1),
    document: z.object({
      name: z.string().min(1).max(500),
      clauses: z.array(clauseSchema).min(1).max(1000),
      warnings: z.array(z.string().max(2000)).max(30),
      isExample: z.boolean(),
    }),
    findings: z.array(findingSchema).max(2000),
    sources: z.array(sourceSchema).max(20),
    context: contextSchema,
    analysis: reviewRunSchema.optional(),
    commentReviews: z
      .array(
        reviewRunSchema.extend({
          commentId: z.string().min(1).max(100),
        }),
      )
      .max(1000)
      .optional(),
  })
  .superRefine((session, ctx) => {
    const clauseIds = new Set(
      session.document.clauses.map((clause) => clause.id),
    );
    const sourceIds = new Set(session.sources.map((source) => source.id));
    if (
      clauseIds.size !== session.document.clauses.length ||
      sourceIds.size !== session.sources.length ||
      new Set(session.findings.map((f) => f.id)).size !==
        session.findings.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate identifiers in review file.",
      });
    for (const finding of session.findings) {
      if (
        finding.respondsTo &&
        (finding.origin !== "ai" ||
          !session.findings.some(
            (parent) =>
              parent.id === finding.respondsTo &&
              parent.origin === "reviewer" &&
              parent.clauseId === finding.clauseId,
          ))
      )
        ctx.addIssue({
          code: "custom",
          message: "A comment response has no matching reviewer comment.",
        });
      if (
        !clauseIds.has(finding.clauseId) ||
        finding.related.some((e) => !clauseIds.has(e.targetId)) ||
        finding.sources.some((e) => !sourceIds.has(e.targetId))
      )
        ctx.addIssue({
          code: "custom",
          message: "A saved finding points to a missing passage.",
        });
    }
    if (
      session.commentReviews?.some(
        (run) =>
          !session.findings.some(
            (finding) =>
              finding.id === run.commentId && finding.origin === "reviewer",
          ),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "A comment review has no matching comment.",
      });
  });
export const analysisInputSchema = z
  .object({
    clauses: z.array(clauseSchema).min(1).max(300),
    sources: z.array(sourceSchema).max(10),
    context: contextSchema,
    focus: reviewFocusSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (input.focus) {
      const anchor = input.clauses.find(
        (clause) => clause.id === input.focus!.clauseId,
      );
      if (!anchor || !containsQuote(anchor.text, input.focus.quote))
        ctx.addIssue({
          code: "custom",
          message:
            "The comment must be anchored to a passage in this agreement.",
        });
    }
    const size =
      input.clauses.reduce((sum, item) => sum + item.text.length, 0) +
      input.sources.reduce((sum, item) => sum + item.text.length, 0);
    if (size > 120000)
      ctx.addIssue({
        code: "custom",
        message:
          "Live review supports up to 120,000 characters including sources. Review a smaller document or source set.",
      });
    if (
      new Set(input.clauses.map((c) => c.id)).size !== input.clauses.length ||
      new Set(input.sources.map((s) => s.id)).size !== input.sources.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate passage identifiers.",
      });
    if (!input.context.party.trim())
      ctx.addIssue({
        code: "custom",
        message: "Add the party you represent before review.",
      });
    if (
      input.sources.some((source) => source.kind !== "policy") &&
      !input.context.jurisdiction.trim()
    )
      ctx.addIssue({
        code: "custom",
        message: "Add jurisdiction to review against legal sources.",
      });
  });

// Keep the saved-file schema permissive for older reviews. New AI output has a
// deliberately small writing budget, enforced by both server and browser.
export const aiFindingSchema = z.object({
  kind: z.enum(["connection", "legal"]),
  title: z.string().trim().min(1).max(100),
  explanation: z.string().trim().min(1).max(400),
  clauseId: z.string().min(1).max(100),
  quote: z.string().min(8).max(5000),
  related: z
    .array(
      evidenceSchema.extend({
        reason: z.string().trim().min(1).max(180),
      }),
    )
    .max(10),
  sources: z
    .array(
      evidenceSchema.extend({
        reason: z.string().trim().min(1).max(180),
      }),
    )
    .max(10),
  uncertainty: z.string().trim().max(240),
});

export const aiOutputSchema = z.object({
  findings: z.array(aiFindingSchema).max(20),
});
