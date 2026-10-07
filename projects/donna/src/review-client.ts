import { z } from "zod";
import {
  aiFindingSchema,
  analysisInputSchema,
  findingSchema,
} from "../shared/schema";
import { validateEvidence } from "../shared/review";

const resultSchema = z.object({
  findings: z
    .array(
      findingSchema.extend({
        ...aiFindingSchema.shape,
        origin: z.literal("ai"),
        status: z.literal("open"),
        kind: z.enum(["connection", "legal"]),
      }),
    )
    .max(20),
  rejected: z.number().int().nonnegative(),
});

export async function reviewAgreement(
  input: z.infer<typeof analysisInputSchema>,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const parsed = analysisInputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const response = await fetcher("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    signal,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "The review service returned an unreadable response. Your existing review is unchanged.",
    );
  }
  if (!response.ok) {
    const error = z.object({ error: z.string().max(2000) }).safeParse(body);
    throw new Error(
      error.success
        ? error.data.error
        : "The review could not finish. Your existing review is unchanged.",
    );
  }
  const result = resultSchema.safeParse(body);
  if (!result.success)
    throw new Error(
      "The review response could not be validated. No findings were added.",
    );
  const evidence = validateEvidence(
    result.data.findings,
    input.clauses,
    input.sources,
  );
  if (
    evidence.rejected ||
    result.data.findings.some(
      (finding) =>
        (input.focus
          ? finding.respondsTo !== input.focus.commentId ||
            finding.clauseId !== input.focus.clauseId
          : Boolean(finding.respondsTo)) ||
        (finding.kind === "legal" &&
          !finding.sources.some((evidence) =>
            input.sources.some(
              (source) =>
                source.id === evidence.targetId && source.kind !== "policy",
            ),
          )),
    )
  ) {
    throw new Error(
      "A returned finding could not be traced to your document and sources. No findings were added.",
    );
  }
  return result.data;
}
