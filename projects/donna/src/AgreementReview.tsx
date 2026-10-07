import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileCheck2,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { isReviewItem } from "../shared/review";
import type {
  Finding,
  ReviewContext,
  ReviewFocus,
  ReviewSession,
} from "../shared/types";

export type ReviewService =
  "checking" | "available" | "unavailable" | "offline";
const originNames: Record<Finding["origin"], string> = {
  ai: "AI suggestion",
  "reference-check": "Reference check",
  "topic-match": "Keyword match",
  reviewer: "Your comment",
  example: "Example comment",
};
type Filter = "all" | "ai" | "issues" | "reviewer" | "example";

export function AgreementReview({
  session,
  running,
  onPick,
}: {
  session: ReviewSession;
  running: boolean;
  onPick: (finding: Finding) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const count = (test: (finding: Finding) => boolean) =>
    session.findings.filter(test).length;
  const aiCount = count((f) => f.origin === "ai");
  const issues = count((f) => f.kind === "missing-reference");
  const findings = session.findings
    .filter(
      (f) =>
        isReviewItem(f) &&
        (!openOnly || f.status === "open") &&
        (filter === "all" ||
          (filter === "issues" && f.kind === "missing-reference") ||
          f.origin === filter),
    )
    .sort((a, b) => {
      const rank = (f: Finding) =>
        f.origin === "ai"
          ? 0
          : f.kind === "missing-reference"
            ? 1
            : f.origin === "reviewer"
              ? 2
              : 3;
      return rank(a) - rank(b);
    });
  return (
    <div className="cw-review-overview">
      <span className="cw-overline">WHOLE AGREEMENT</span>
      <h2>Review items</h2>
      <p className="cw-review-intro" role="status">
        {running
          ? "Reviewing…"
          : session.analysis
            ? `${aiCount} AI suggestions${session.analysis.rejected ? ` · ${session.analysis.rejected} withheld` : ""}`
            : session.commentReviews?.length
              ? "Comment reviews completed"
              : aiCount
                ? "Saved AI suggestions"
                : "AI review not run"}
      </p>
      {session.analysis && (
        <details className="cw-review-warnings">
          <summary>Review details</summary>
          <p>
            {session.analysis.clauseCount} sections ·{" "}
            {session.analysis.sourceCount} sources ·{" "}
            {new Date(session.analysis.completedAt).toLocaleString()}
          </p>
          <p>
            Quotations are checked against the supplied text; interpretations
            still need review. Withheld items failed validation or repeated the
            same quoted relationship.
          </p>
        </details>
      )}
      <div className="cw-findings-filters">
        <label htmlFor="cw-finding-filter">Show findings</label>
        <select
          id="cw-finding-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
        >
          <option value="all">
            All review items ({session.findings.filter(isReviewItem).length})
          </option>
          <option value="ai">AI suggestions ({aiCount})</option>
          <option value="issues">Reference issues ({issues})</option>
          <option value="reviewer">Reviewer comments</option>
          {session.document.isExample && (
            <option value="example">Example comments</option>
          )}
        </select>
        <label className="cw-check">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
          />{" "}
          Open items only
        </label>
      </div>
      <div className="cw-findings-list">
        {findings.map((finding) => {
          const clause = session.document.clauses.find(
            (c) => c.id === finding.clauseId,
          );
          return (
            <button
              key={finding.id}
              className="cw-finding-result"
              onClick={() => onPick(finding)}
            >
              <span className="cw-finding-meta">
                <span>
                  {finding.imported
                    ? "Word comment"
                    : originNames[finding.origin]}{" "}
                  · § {clause?.label}
                </span>
                {finding.status === "reviewed" ? (
                  <Check size={13} />
                ) : (
                  <ArrowUpRight size={13} />
                )}
              </span>
              <strong>{finding.title}</strong>
              {finding.explanation !== finding.title && (
                <span className="cw-finding-excerpt">
                  {finding.explanation}
                </span>
              )}
            </button>
          );
        })}
        {!findings.length && (
          <div className="cw-empty">
            <p>
              {filter === "ai" &&
              !session.analysis &&
              !session.commentReviews?.length
                ? "AI review has not run for this agreement."
                : filter === "all" && !session.findings.some(isReviewItem)
                  ? "No review comments yet. Select a clause and add your concern, then choose Find affected clauses."
                  : "No findings match this filter."}
            </p>
          </div>
        )}
      </div>
      {session.document.warnings.length > 0 && (
        <details className="cw-review-warnings">
          <summary>Import notes ({session.document.warnings.length})</summary>
          {session.document.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </details>
      )}
    </div>
  );
}

export function ReviewSetup({
  session,
  focus,
  context,
  setContext,
  service,
  running,
  consent,
  setConsent,
  onRun,
  onRefresh,
  onSources,
}: {
  session: ReviewSession;
  focus?: ReviewFocus;
  context: ReviewContext;
  setContext: (context: ReviewContext) => void;
  service: ReviewService;
  running: boolean;
  consent: boolean;
  setConsent: (consent: boolean) => void;
  onRun: (event: FormEvent) => void;
  onRefresh: () => void;
  onSources: () => void;
}) {
  return (
    <form className="cw-review-setup" onSubmit={onRun}>
      {focus && (
        <div className="cw-review-focus">
          <strong>
            Your comment · §{" "}
            {
              session.document.clauses.find(
                (clause) => clause.id === focus.clauseId,
              )?.label
            }
          </strong>
          <p>{focus.comment}</p>
          <details>
            <summary>Anchored passage</summary>
            <blockquote>{focus.quote}</blockquote>
          </details>
        </div>
      )}
      <div className="cw-review-scope">
        <FileCheck2 size={19} />
        <div>
          <strong>{session.document.name}</strong>
          <p>
            {session.document.clauses.length} sections ·{" "}
            {session.sources.length} sources included
          </p>
        </div>
      </div>
      <div className="cw-review-state">
        <span className={`cw-service-dot ${service}`} />
        <div>
          <strong>
            {service === "available"
              ? "Review service connected"
              : service === "checking"
                ? "Checking review service…"
                : service === "offline"
                  ? "Review service unavailable"
                  : "Analysis isn’t connected yet"}
          </strong>
          <p>
            {service === "available"
              ? "This review uses OpenAI. Document upload alone does not send it for analysis."
              : service === "offline"
                ? "Start the local server, then check the connection again."
                : service === "unavailable"
                  ? "Add the server API key to enable AI review."
                  : "Checking whether full analysis is available."}
          </p>
        </div>
      </div>
      {service !== "available" && (
        <button
          type="button"
          className="cw-text-action"
          onClick={onRefresh}
          disabled={service === "checking"}
        >
          Check connection again
        </button>
      )}
      <label>
        Party you represent
        <input
          required
          maxLength={300}
          value={context.party}
          onChange={(event) =>
            setContext({ ...context, party: event.target.value })
          }
          placeholder="e.g. customer, supplier, employer, tenant"
        />
      </label>
      <label>
        Governing law{" "}
        {session.sources.some((source) => source.kind !== "policy")
          ? ""
          : "(optional)"}
        <input
          required={session.sources.some((source) => source.kind !== "policy")}
          maxLength={300}
          value={context.jurisdiction}
          onChange={(event) =>
            setContext({ ...context, jurisdiction: event.target.value })
          }
          placeholder="Use the agreement’s governing-law provision"
        />
      </label>
      <label>
        Focus (optional)
        <textarea
          rows={3}
          maxLength={4000}
          value={context.instructions}
          onChange={(event) =>
            setContext({ ...context, instructions: event.target.value })
          }
          placeholder="e.g. termination rights, liability exceptions, renewal dates and obligations that survive termination"
        />
      </label>
      <div className="cw-review-sources">
        <BookOpen size={16} />
        <div>
          <strong>
            {session.sources.length
              ? `${session.sources.length} source${session.sources.length === 1 ? "" : "s"} included`
              : "Contract relationships only"}
          </strong>
          <p>
            {session.sources.length
              ? "Legal checks can use only the excerpts you supplied. Currency and applicability still need verification."
              : "Add law or guidance excerpts for legal checks. Laws are not loaded automatically."}
          </p>
          <button type="button" className="cw-text-action" onClick={onSources}>
            Add a source <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
      {session.document.isExample && (
        <p className="cw-dialog-footnote">Fictional sample agreement.</p>
      )}
      <label className="cw-check cw-review-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={running}
        />
        <span>
          {focus
            ? "Send this agreement, supplied sources, review instructions and this comment to OpenAI for this review."
            : "Send this agreement, supplied sources and review instructions to OpenAI for this review."}
        </span>
      </label>
      <button
        className="cw-primary cw-review-cta"
        type="submit"
        disabled={
          service !== "available" ||
          !consent ||
          running ||
          !context.party.trim() ||
          (session.sources.some((source) => source.kind !== "policy") &&
            !context.jurisdiction.trim())
        }
      >
        {running ? (
          <LoaderCircle size={15} className="cw-spin" />
        ) : (
          <Sparkles size={15} />
        )}
        {running
          ? "Reviewing…"
          : focus
            ? "Find affected clauses"
            : "Start full review"}
      </button>
    </form>
  );
}
