import type {
  Clause,
  Finding,
  LegalSource,
  ReviewContext,
  ReviewFocus,
  ReviewSession,
} from "./types.js";
import { normalizeDigits, normalizeTermText } from "./terms.js";

export function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsQuote(text: string, quote: string): boolean {
  return (
    normalize(quote).length >= 8 && normalize(text).includes(normalize(quote))
  );
}

// Preserve each source paragraph. A section label is never guessed from body text.
export function parseDocument(text: string): Clause[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: Clause[] = [];
  let buffer: string[] = [];
  let label = "";
  let heading = "";
  const flush = () => {
    const body = buffer.join("\n").trim();
    if (!body) return;
    const index = result.length + 1;
    result.push({
      id: `clause-${index}`,
      label: label || `P${index}`,
      title: heading || body.split("\n")[0].slice(0, 90),
      text: body,
    });
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // Numbered clauses may contain several paragraphs; keep them together.
      if (!label) flush();
      else if (buffer.length && buffer.at(-1) !== "") buffer.push("");
      continue;
    }
    const headingLine = normalizeDigits(line).replace(
      /[\u200e\u200f\u061c]/g,
      "",
    );
    const match = headingLine.match(
      /^(?:(?:section|article|clause|المادة|مادة|البند|بند|القسم)\s+)?(\d+(?:[.٫]\d+)*)(?:[.):：\-–،]\s*|\s+)(\p{L}[^\n]{0,180})$/iu,
    );
    const explicit =
      /^(?:section|article|clause|المادة|مادة|البند|بند|القسم)\s+/iu.test(
        headingLine,
      );
    const isHeading =
      match &&
      (explicit || line.length < 160) &&
      !/^(?:\d{4})\s/.test(headingLine);
    if (isHeading && match) {
      flush();
      label = match[1].replace(/٫/g, ".");
      heading = match[2];
    }
    buffer.push(line);
  }
  flush();
  return result;
}

export function mapReferences(clauses: Clause[]): Finding[] {
  const findings: Finding[] = [];
  const labelMap = new Map<string, Clause[]>();
  for (const clause of clauses)
    labelMap.set(clause.label, [...(labelMap.get(clause.label) || []), clause]);
  for (const clause of clauses) {
    const seen = new Set<string>();
    for (const match of clause.text.matchAll(
      /(?:\b(?:section|clause|article)s?|(?<![\p{L}\p{N}])(?:[وبف]?ل?(?:المادة|مادة|البند|بند)|[وبف]?لل(?:مادة|بند)))\s+([0-9٠-٩۰-۹]+(?:[.٫][0-9٠-٩۰-۹]+)*)(?![\p{L}\p{N}])/giu,
    )) {
      const label = normalizeDigits(match[1]).replace(/٫/g, ".");
      if (label === clause.label || seen.has(label)) continue;
      seen.add(label);
      // References to external legislation are not missing sections of this contract.
      const tail = clause.text.slice(
        (match.index || 0) + match[0].length,
        (match.index || 0) + match[0].length + 100,
      );
      if (
        /^\s+(?:of|under)\s+(?:the\s+)?[^.;\n]*(?:law|act|regulation|GDPR|PDPA|PDPL)/i.test(
          tail,
        ) ||
        /^\s+من\s+(?:القانون|قانون|نظام|النظام|لائحة|اللائحة)/u.test(
          normalizeTermText(tail),
        )
      )
        continue;
      const targets = labelMap.get(label) || [];
      const exact = targets.length === 1;
      findings.push({
        id: `ref-${clause.id}-${label}`,
        kind: exact ? "reference" : "missing-reference",
        origin: "reference-check",
        title: exact
          ? `Read with clause ${label}`
          : targets.length
            ? `Ambiguous reference to ${label}`
            : `Check reference to clause ${label}`,
        explanation: exact
          ? `Refers to clause ${label}.`
          : targets.length
            ? `More than one extracted section has this number. Verify which section the reference points to.`
            : `No extracted section is numbered ${label}. Check the original document and any missing attachments.`,
        clauseId: clause.id,
        quote: match[0],
        related: targets.map((target) => ({
          targetId: target.id,
          quote: target.text.slice(0, 400),
          reason: exact
            ? "Explicit reference in this clause"
            : "Possible reference target",
        })),
        sources: [],
        uncertainty: "",
        status: "open",
      });
    }
  }
  return findings;
}

export function localReview(clauses: Clause[]): Finding[] {
  return mapReferences(clauses);
}

// References belong in navigation. Legacy keyword matches remain readable in
// saved reviews, but neither should inflate the comment queue or its counts.
export function isReviewItem(finding: Finding): boolean {
  return finding.kind !== "reference" && finding.origin !== "topic-match";
}

export function validateEvidence(
  findings: Finding[],
  clauses: Clause[],
  sources: LegalSource[],
) {
  const clauseMap = new Map(clauses.map((clause) => [clause.id, clause]));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const accepted: Finding[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (const finding of findings) {
    const anchor = clauseMap.get(finding.clauseId);
    const valid =
      anchor &&
      finding.title.trim().length > 0 &&
      finding.explanation.trim().length > 0 &&
      containsQuote(anchor.text, finding.quote) &&
      (finding.kind !== "connection" || finding.related.length > 0) &&
      finding.related.every((item) => {
        const target = clauseMap.get(item.targetId);
        return (
          target &&
          target.id !== anchor.id &&
          item.reason.trim().length > 0 &&
          containsQuote(target.text, item.quote)
        );
      }) &&
      finding.sources.every((item) => {
        const target = sourceMap.get(item.targetId);
        return (
          target &&
          item.reason.trim().length > 0 &&
          containsQuote(target.text, item.quote)
        );
      }) &&
      (finding.kind !== "legal" ||
        finding.sources.some(
          (item) => sourceMap.get(item.targetId)?.kind !== "policy",
        ));
    // The same quoted relationship should appear once, even if the model
    // reverses the anchor and linked clause or rephrases the title.
    const key = JSON.stringify([
      finding.kind,
      [
        [finding.clauseId, normalize(finding.quote)],
        ...finding.related.map((item) => [
          item.targetId,
          normalize(item.quote),
        ]),
      ].sort(),
      finding.sources
        .map((item) => [item.targetId, normalize(item.quote)])
        .sort(),
    ]);
    if (valid && !seen.has(key)) {
      accepted.push(finding);
      seen.add(key);
    } else rejected++;
  }
  return { accepted, rejected };
}

export function safeSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function applyReviewResult(
  session: ReviewSession,
  result: { findings: Finding[]; rejected: number },
  context: ReviewContext,
  focus?: ReviewFocus,
): ReviewSession {
  const run = {
    completedAt: new Date().toISOString(),
    clauseCount: session.document.clauses.length,
    sourceCount: session.sources.length,
    accepted: result.findings.length,
    rejected: result.rejected,
  };
  return {
    ...session,
    context,
    findings: [
      ...session.findings.filter(
        (finding) =>
          finding.origin !== "ai" ||
          (focus
            ? finding.respondsTo !== focus.commentId
            : Boolean(finding.respondsTo)),
      ),
      ...result.findings,
    ],
    ...(focus
      ? {
          commentReviews: [
            ...(session.commentReviews || []).filter(
              (item) => item.commentId !== focus.commentId,
            ),
            { ...run, commentId: focus.commentId },
          ],
        }
      : { analysis: run }),
  };
}

export function removeSourceFromSession(
  session: ReviewSession,
  sourceId: string,
): ReviewSession {
  return {
    ...session,
    sources: session.sources.filter((source) => source.id !== sourceId),
    analysis: undefined,
    commentReviews: undefined,
    findings: session.findings.flatMap((finding) => {
      if (!finding.sources.some((evidence) => evidence.targetId === sourceId))
        return [finding];
      if (finding.origin === "ai") return [];
      return [
        {
          ...finding,
          sources: finding.sources.filter(
            (evidence) => evidence.targetId !== sourceId,
          ),
          status: "open" as const,
          uncertainty:
            `${finding.uncertainty} A linked source was removed; recheck this comment.`.trim(),
        },
      ];
    }),
  };
}

export function exportReview(session: ReviewSession): string {
  const lines = [
    `# ${session.document.name}`,
    "",
    `Review exported: ${new Date().toISOString()}`,
    `Context: ${session.context.jurisdiction || "Not supplied"} · ${session.context.party || "Party not supplied"}`,
    "",
    "Findings are review aids, not a completeness or compliance certification. Source excerpts are supplied references; legal applicability and currency require verification.",
    "",
    ...session.document.warnings.map((warning) => `Import note: ${warning}`),
    "",
  ];
  for (const finding of session.findings) {
    const clause = session.document.clauses.find(
      (item) => item.id === finding.clauseId,
    );
    lines.push(
      `## ${finding.title}`,
      `Status: ${finding.status} | Basis: ${finding.origin} | Clause: ${clause?.label || finding.clauseId}`,
      "",
      finding.explanation,
      "",
      `Anchor: ${finding.quote}`,
      "",
    );
    for (const evidence of finding.related) {
      const related = session.document.clauses.find(
        (item) => item.id === evidence.targetId,
      );
      lines.push(
        `Related clause ${related?.label}: ${evidence.reason}`,
        evidence.quote,
        "",
      );
    }
    for (const evidence of finding.sources) {
      const source = session.sources.find(
        (item) => item.id === evidence.targetId,
      );
      lines.push(
        `Source: ${source?.title} (${source?.kind}; ${source?.jurisdiction}; ${source?.version || "version unspecified"})`,
        source?.url || "",
        evidence.quote,
        evidence.reason,
        "",
      );
    }
    if (finding.uncertainty)
      lines.push(`To verify: ${finding.uncertainty}`, "");
  }
  return lines.join("\n");
}
