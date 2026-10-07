import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  GitBranch,
  Highlighter,
  Link2,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { exampleSession } from "../shared/demo";
import {
  exportReview,
  localReview,
  parseDocument,
  removeSourceFromSession,
  safeSourceUrl,
} from "../shared/review";
import { sessionSchema, sourceSchema } from "../shared/schema";
import type {
  Finding,
  LegalSource,
  ReviewContext,
  ReviewSession,
} from "../shared/types";
import { extractText, importDocument } from "./import";

const labels: Record<Finding["origin"], string> = {
  "reference-check": "Explicit reference",
  "topic-match": "Reading suggestion",
  reviewer: "Your comment",
  ai: "AI suggestion",
  example: "Example comment",
};
const emptyContext: ReviewContext = {
  jurisdiction: "",
  party: "",
  instructions: "",
};
type ModalName = "sources" | "context" | "paste" | null;

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        D
      </span>
      Donna<span className="brand-dot">.</span>
    </span>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      "button, input, textarea, select",
    );
    first?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]",
        ) || []),
      ];
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <div>
            <span className="eyebrow">YOUR REVIEW WORKSPACE</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function download(filename: string, value: string, mime: string) {
  const url = URL.createObjectURL(new Blob([value], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function App() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [activeClauseId, setActiveClauseId] = useState("");
  const [tab, setTab] = useState<"review" | "outline">("review");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "reviewed">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalName>(null);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analysisAvailable, setAnalysisAvailable] = useState(false);
  const [serverChecked, setServerChecked] = useState(false);
  const [context, setContext] = useState<ReviewContext>(emptyContext);
  const [consent, setConsent] = useState(false);
  const [comment, setComment] = useState("");
  const [commentRelated, setCommentRelated] = useState("");
  const [commentSource, setCommentSource] = useState("");
  const [sourceDraft, setSourceDraft] = useState<Omit<LegalSource, "id">>({
    title: "",
    jurisdiction: "",
    version: "",
    url: "",
    kind: "law",
    text: "",
  });
  const [pastedText, setPastedText] = useState("");
  const [pastedName, setPastedName] = useState("Untitled agreement");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sourceFileInput = useRef<HTMLInputElement>(null);
  const docScroll = useRef<HTMLDivElement>(null);
  const revision = useRef(0);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data) => setAnalysisAvailable(Boolean(data.analysisAvailable)))
      .catch(() => setAnalysisAvailable(false))
      .finally(() => setServerChecked(true));
  }, []);
  useEffect(() => {
    if (!activeClauseId) return;
    const element = document.getElementById(activeClauseId);
    if (element && docScroll.current)
      docScroll.current.scrollTo({
        top: element.offsetTop - docScroll.current.offsetTop - 34,
        behavior: "smooth",
      });
  }, [activeClauseId, session?.document.name]);
  useEffect(() => {
    if (!session || session.document.isExample) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session]);

  const selected = session?.findings.find(
    (finding) => finding.id === selectedId,
  );
  const activeClause = session?.document.clauses.find(
    (clause) => clause.id === activeClauseId,
  );
  const reviewedCount =
    session?.findings.filter((finding) => finding.status === "reviewed")
      .length || 0;
  const visibleFindings = useMemo(
    () =>
      session?.findings.filter(
        (finding) =>
          (statusFilter === "all" || finding.status === statusFilter) &&
          `${finding.title} ${finding.explanation}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ) || [],
    [session, statusFilter, query],
  );

  function openSession(next: ReviewSession) {
    revision.current++;
    setSession(next);
    setSelectedId(next.findings[0]?.id || "");
    setActiveClauseId(
      next.findings[0]?.clauseId || next.document.clauses[0]?.id || "",
    );
    setContext(next.context);
    setStatusFilter("all");
    setQuery("");
    setComment("");
    setCommentRelated("");
    setCommentSource("");
    setError("");
    setNotice("");
    setTab("review");
  }
  function pickFinding(finding: Finding) {
    setSelectedId(finding.id);
    setActiveClauseId(finding.clauseId);
    setCommentRelated("");
  }
  function pickClause(id: string) {
    setActiveClauseId(id);
    setCommentRelated("");
  }

  async function handleUpload(file?: File) {
    if (!file || busy || analyzing) return;
    setBusy(true);
    setError("");
    try {
      if (
        file.name.endsWith(".donna.json") ||
        file.name.endsWith(".rooted.json")
      ) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("This saved review is too large.");
        const result = sessionSchema.safeParse(JSON.parse(await file.text()));
        if (!result.success)
          throw new Error("This is not a valid Donna review file.");
        openSession(result.data);
      } else {
        const { document, comments } = await importDocument(file);
        openSession({
          version: 1,
          document,
          findings: [...comments, ...localReview(document.clauses)],
          sources: session?.sources || [],
          context: session?.context || emptyContext,
        });
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The document could not be opened.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addPastedDocument(event: FormEvent) {
    event.preventDefault();
    if (pastedText.trim().length < 30) {
      setError("Paste at least 30 characters of document text.");
      return;
    }
    const clauses = parseDocument(pastedText);
    openSession({
      version: 1,
      document: {
        name: pastedName || "Untitled agreement",
        clauses,
        warnings: [
          "Pasted text only. Refer to the original for formatting and omitted attachments.",
        ],
        isExample: false,
      },
      findings: localReview(clauses),
      sources: session?.sources || [],
      context: session?.context || emptyContext,
    });
    setModal(null);
    setPastedText("");
  }

  function addSource(event: FormEvent) {
    event.preventDefault();
    const result = sourceSchema.safeParse({
      ...sourceDraft,
      title: sourceDraft.title.trim(),
      id: `source-${crypto.randomUUID()}`,
    });
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    if (result.data.url && !safeSourceUrl(result.data.url)) {
      setError("Use an http or https source address.");
      return;
    }
    if (!session || session.sources.length >= 10) {
      setError("Keep this review to 10 sources or fewer.");
      return;
    }
    revision.current++;
    setSession({
      ...session,
      sources: [...session.sources, result.data],
      analysis: undefined,
    });
    setSourceDraft({
      title: "",
      jurisdiction: "",
      version: "",
      url: "",
      kind: "law",
      text: "",
    });
    setError("");
    setNotice(
      "Source added. You can attach it to a comment or include it in live analysis.",
    );
  }

  async function uploadSource(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const extracted = await extractText(file);
      if (extracted.text.length > 60000)
        throw new Error(
          "Use a relevant source excerpt of up to 60,000 characters.",
        );
      setSourceDraft((previous) => ({
        ...previous,
        title: previous.title || file.name.replace(/\.[^.]+$/, ""),
        text: extracted.text,
      }));
      setNotice(
        extracted.warnings.join(" ") ||
          "Source text imported. Add its jurisdiction and version before saving.",
      );
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not import source.",
      );
    } finally {
      setBusy(false);
      if (sourceFileInput.current) sourceFileInput.current.value = "";
    }
  }

  function addComment(event: FormEvent) {
    event.preventDefault();
    if (!session || !activeClause || !comment.trim()) return;
    const related = session.document.clauses.find(
      (clause) => clause.id === commentRelated,
    );
    const source = session.sources.find((item) => item.id === commentSource);
    const finding: Finding = {
      id: `comment-${crypto.randomUUID()}`,
      kind: "comment",
      origin: "reviewer",
      title: comment.trim().split("\n")[0].slice(0, 80),
      explanation: comment.trim(),
      clauseId: activeClause.id,
      quote: activeClause.text.slice(0, 1000),
      related: related
        ? [
            {
              targetId: related.id,
              quote: related.text.slice(0, 1000),
              reason: "Linked by you",
            },
          ]
        : [],
      sources: source
        ? [
            {
              targetId: source.id,
              quote: source.text.slice(0, 1500),
              reason:
                "Attached by you; verify the relevant provision and applicability",
            },
          ]
        : [],
      uncertainty: "",
      status: "open",
    };
    setSession({ ...session, findings: [finding, ...session.findings] });
    setSelectedId(finding.id);
    setComment("");
    setCommentRelated("");
    setCommentSource("");
    setTab("review");
    setStatusFilter("all");
    setQuery("");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!session || !consent || analyzing || !analysisAvailable) return;
    const currentRevision = revision.current;
    const snapshot = { ...session, context };
    setSession(snapshot);
    setAnalyzing(true);
    setError("");
    setNotice("");
    setModal(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauses: snapshot.document.clauses,
          sources: snapshot.sources,
          context,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Analysis could not finish.");
      if (revision.current !== currentRevision) return;
      const findings = result.findings as Finding[];
      setSession((current) =>
        current
          ? {
              ...current,
              context,
              analysis: {
                completedAt: new Date().toISOString(),
                clauseCount: snapshot.document.clauses.length,
                sourceCount: snapshot.sources.length,
                accepted: findings.length,
                rejected: result.rejected || 0,
              },
              findings: [
                ...current.findings.filter((f) => f.origin !== "ai"),
                ...findings,
              ],
            }
          : current,
      );
      if (findings.length) {
        setSelectedId(findings[0].id);
        setActiveClauseId(findings[0].clauseId);
        setStatusFilter("all");
        setQuery("");
      }
      setNotice(
        `${findings.length} evidence-checked suggestion${findings.length === 1 ? "" : "s"} added.${result.rejected ? ` ${result.rejected} finding(s) were withheld because their evidence could not be verified.` : ""} This does not establish review completeness or legal accuracy.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Analysis failed. Your review is unchanged.",
      );
    } finally {
      setAnalyzing(false);
      setConsent(false);
    }
  }

  const closeModal = useMemo(
    () => () => {
      setModal(null);
      setError("");
      setNotice("");
    },
    [],
  );
  const downloadName =
    (session?.document.name || "review")
      .replace(/[^a-z0-9 -]/gi, "")
      .slice(0, 80) || "review";

  return (
    <div className={`app ${session ? "has-document" : ""}`}>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        aria-label="Upload document"
        accept=".pdf,.docx,.txt,.md,.donna.json,.rooted.json"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />
      <input
        ref={sourceFileInput}
        className="sr-only"
        type="file"
        aria-label="Import legal source text"
        accept=".pdf,.docx,.txt,.md"
        onChange={(event) => void uploadSource(event.target.files?.[0])}
      />
      <header className="app-header">
        <a
          className="brand-home"
          href="#"
          aria-label="Donna home"
          onClick={(event) => {
            event.preventDefault();
            if (!session) return;
            setNotice(
              "Your review is open. Save a copy before replacing it with another document.",
            );
          }}
        >
          <Brand />
        </a>
        <div className="header-divider" />
        <span className="header-location">
          Document workspace <ChevronDown size={13} />
        </span>
        <span className="version-tag">EARLY BUILD</span>
        <div className="header-actions">
          {session && (
            <>
              <button
                className="button ghost"
                onClick={() => setModal("sources")}
                disabled={analyzing}
              >
                <BookOpen size={16} /> Sources{" "}
                <span className="count small">{session.sources.length}</span>
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    `${downloadName}.donna.json`,
                    JSON.stringify(session, null, 2),
                    "application/json",
                  )
                }
              >
                <ArrowDownToLine size={15} /> Save review
              </button>
            </>
          )}
          <span className="avatar" title="Local workspace">
            M
          </span>
        </div>
      </header>
      {(error || notice) && !modal && (
        <div
          className={`banner ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <CircleAlert size={16} />
          <span>{error || notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {!session ? (
        <main className="welcome">
          <div className="welcome-top">
            <span className="eyebrow">
              <span className="status-dot" /> A CLEARER WAY TO REVIEW
            </span>
            <h1>
              Every clause has
              <br />a <em>connection.</em>
            </h1>
            <p>
              Read the document. Follow the evidence.
              <br />
              See what you might have missed.
            </p>
          </div>
          <div className="welcome-grid">
            <section
              className={`upload-card ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleUpload(event.dataTransfer.files[0]);
              }}
            >
              <div className="upload-symbol">
                <Upload size={25} strokeWidth={1.5} />
              </div>
              <h2>Start with your document</h2>
              <p>Drop an agreement here, or choose a file.</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Plus size={17} />
                )}{" "}
                {busy ? "Opening document…" : "Upload a document"}
              </button>
              <span className="file-types">PDF, DOCX, TXT · up to 12 MB</span>
              <button className="text-button" onClick={() => setModal("paste")}>
                Or paste document text <ArrowRight size={14} />
              </button>
              <div className="privacy-note">
                <ShieldCheck size={15} /> Import and reference checks stay in
                your browser.
              </div>
            </section>
            <section className="example-card">
              <div className="example-top">
                <span className="eyebrow">TAKE A LOOK AROUND</span>
                <span className="example-chip">Fictional example</span>
              </div>
              <div className="example-paper">
                <FileText size={22} />
                <span>
                  Master services agreement
                  <small>Northstar Studio × Acme Cloud</small>
                </span>
                <span className="tiny-dot" />
              </div>
              <div className="example-connection">
                <span className="connection-dot" />
                <div>
                  <span className="mini-label">
                    CLAUSE 5 · RETENTION AND DELETION
                  </span>
                  <p>
                    “Delete all Customer Data,
                    <br />
                    <mark>including backup copies</mark>…”
                  </p>
                </div>
              </div>
              <div className="example-comment">
                <GitBranch size={18} />
                <div>
                  <strong>There’s another side to this.</strong>
                  <p>
                    Clause 6 keeps backups for 180 days.
                    <br />
                    Read the two commitments together.
                  </p>
                </div>
              </div>
              <button
                className="button example-button"
                onClick={() => openSession(exampleSession())}
              >
                Explore the example <ArrowRight size={17} />
              </button>
            </section>
          </div>
          <footer className="welcome-footer">
            <span>
              <Link2 size={16} /> Connected clauses
            </span>
            <span>
              <BookOpen size={16} /> Source-backed reading
            </span>
            <span>
              <Highlighter size={16} /> Your judgment, in context
            </span>
          </footer>
        </main>
      ) : (
        <>
          <section className="workspace-heading">
            <div>
              <div className="breadcrumb">
                WORKSPACE <ChevronRight size={12} />{" "}
                {session.document.isExample
                  ? "EXAMPLE REVIEW"
                  : "DOCUMENT REVIEW"}
              </div>
              <h1>{session.document.name}</h1>
              <div className="document-meta">
                <FileText size={13} />
                <span>{session.document.clauses.length} passages</span>
                <span>·</span>
                <span>
                  {session.context.jurisdiction || "Jurisdiction not specified"}
                </span>
                <span>·</span>
                <span
                  className={session.document.isExample ? "example-text" : ""}
                >
                  {session.document.isExample
                    ? "Fictional document"
                    : "Kept in this session"}
                </span>
              </div>
            </div>
            <div className="workspace-actions">
              <button
                className="button secondary"
                disabled={busy || analyzing}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} /> {busy ? "Opening…" : "Open document"}
              </button>
              <button
                className="button primary"
                disabled={analyzing || busy}
                onClick={() => setModal("context")}
              >
                {analyzing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {analyzing ? "Reviewing…" : "Review with AI"}
              </button>
            </div>
          </section>
          <div className="workspace">
            <aside className="review-sidebar">
              <div className="sidebar-tabs">
                <button
                  className={tab === "review" ? "active" : ""}
                  onClick={() => setTab("review")}
                >
                  <MessageSquare size={15} /> Review{" "}
                  <span className="count">{session.findings.length}</span>
                </button>
                <button
                  className={tab === "outline" ? "active" : ""}
                  onClick={() => setTab("outline")}
                >
                  Outline
                </button>
              </div>
              <div className="sidebar-body">
                <label className="search-box">
                  <Search size={15} />
                  <input
                    placeholder={
                      tab === "review" ? "Find a comment…" : "Find a clause…"
                    }
                    aria-label="Search review"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {tab === "review" ? (
                  <>
                    <div className="filter-row">
                      {(["all", "open", "reviewed"] as const).map((filter) => (
                        <button
                          key={filter}
                          className={statusFilter === filter ? "active" : ""}
                          onClick={() => setStatusFilter(filter)}
                        >
                          {filter === "all"
                            ? "All"
                            : filter === "open"
                              ? "Open"
                              : "Reviewed"}
                        </button>
                      ))}
                    </div>
                    <div className="finding-list">
                      {visibleFindings.map((finding) => (
                        <button
                          key={finding.id}
                          className={`finding-card ${selectedId === finding.id ? "selected" : ""}`}
                          onClick={() => pickFinding(finding)}
                        >
                          <div className="finding-meta">
                            <span className={`kind-dot ${finding.kind}`} />
                            <span>
                              {finding.kind === "missing-reference"
                                ? "Check reference"
                                : labels[finding.origin]}
                            </span>
                            {finding.status === "reviewed" && (
                              <Check size={13} />
                            )}
                          </div>
                          <strong>{finding.title}</strong>
                          <span className="finding-footer">
                            Clause{" "}
                            {
                              session.document.clauses.find(
                                (clause) => clause.id === finding.clauseId,
                              )?.label
                            }
                            <span>
                              {finding.related.length > 0 && (
                                <>
                                  <GitBranch size={12} />{" "}
                                  {finding.related.length}
                                </>
                              )}
                            </span>
                          </span>
                        </button>
                      ))}
                      {!visibleFindings.length && (
                        <div className="empty-panel">
                          <MessageSquare size={22} />
                          <strong>
                            {query || statusFilter !== "all"
                              ? "No matching comments"
                              : "Your review starts here"}
                          </strong>
                          <p>
                            {query || statusFilter !== "all"
                              ? "Try another search or filter."
                              : "Select a clause to add a comment, or run a live review."}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <nav className="outline-list" aria-label="Document outline">
                    {session.document.clauses
                      .filter((clause) =>
                        `${clause.title} ${clause.text}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((clause) => (
                        <button
                          key={clause.id}
                          className={
                            activeClauseId === clause.id ? "active" : ""
                          }
                          onClick={() => pickClause(clause.id)}
                        >
                          <span>{clause.label}</span>
                          {clause.title
                            .replace(/^\d+[.)]?\s*/, "")
                            .slice(0, 65)}
                        </button>
                      ))}
                  </nav>
                )}
              </div>
              <footer className="review-progress">
                <span>
                  <CheckCheck size={15} /> {reviewedCount} of{" "}
                  {session.findings.length} reviewed
                </span>
                <div>
                  <i
                    style={{
                      width: `${session.findings.length ? (reviewedCount / session.findings.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  Reviewed marks your progress, not legal clearance.
                </small>
              </footer>
            </aside>
            <main className="document-pane">
              <div className="document-toolbar">
                <span>
                  <FileText size={15} /> DOCUMENT{" "}
                  <span className="muted">/ TEXT VIEW</span>
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      `${downloadName}-review.md`,
                      exportReview(session),
                      "text/markdown",
                    )
                  }
                >
                  <ArrowDownToLine size={14} /> Export notes
                </button>
              </div>
              <div className="document-scroll" ref={docScroll}>
                <div className="document-paper">
                  <div className="paper-heading">
                    <span className="eyebrow">
                      {session.document.isExample
                        ? "FICTIONAL EXAMPLE AGREEMENT"
                        : "UPLOADED DOCUMENT"}
                    </span>
                    <span className="paper-rule" />
                  </div>
                  {session.document.clauses.map((clause) => {
                    const anchored = session.findings.filter(
                      (finding) => finding.clauseId === clause.id,
                    );
                    const isRelated = selected?.related.some(
                      (evidence) => evidence.targetId === clause.id,
                    );
                    return (
                      <section
                        id={clause.id}
                        key={clause.id}
                        className={`clause ${activeClauseId === clause.id ? "active" : ""} ${selected?.clauseId === clause.id ? "anchor" : ""}`}
                        onClick={() => pickClause(clause.id)}
                      >
                        <div className="clause-head">
                          <button
                            className="clause-select"
                            onClick={() => pickClause(clause.id)}
                            aria-label={`Select clause ${clause.label}`}
                          >
                            <span>{clause.label}</span>
                            <strong>{clause.title}</strong>
                          </button>
                          {anchored.length > 0 && (
                            <button
                              className="comment-count"
                              aria-label={`${anchored.length} comments on clause ${clause.label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                pickFinding(anchored[0]);
                              }}
                            >
                              <MessageSquare size={12} />
                              {anchored.length}
                            </button>
                          )}
                        </div>
                        <p>
                          {clause.text.startsWith(clause.title)
                            ? clause.text.slice(clause.title.length).trim() ||
                              clause.text
                            : clause.text.replace(
                                new RegExp(
                                  `^(?:(?:Section|Article|Clause)\\s+)?${clause.label.replace(/\./g, "\\.")}[.)]?\\s+${clause.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
                                  "i",
                                ),
                                "",
                              ) || clause.text}
                        </p>
                        {isRelated && (
                          <span className="related-label">
                            <GitBranch size={12} /> Connected to the selected
                            comment
                          </span>
                        )}
                      </section>
                    );
                  })}
                  <div className="end-document">
                    <span />
                    END OF EXTRACTED DOCUMENT
                    <span />
                  </div>
                  <details className="import-notes">
                    <summary>
                      <CircleAlert size={14} /> About this text view
                    </summary>
                    {session.document.warnings.map((warning, index) => (
                      <p key={index}>{warning}</p>
                    ))}
                    <p>
                      Review progress lives in this browser tab. Save the review
                      to keep your comments and sources.
                    </p>
                  </details>
                </div>
              </div>
            </main>
            <aside className="evidence-pane">
              <div className="evidence-heading">
                <GitBranch size={17} />
                <span>Follow the connection</span>
              </div>
              <div className="evidence-scroll">
                {selected ? (
                  <>
                    <div className="evidence-topline">
                      <span className={`finding-origin ${selected.origin}`}>
                        {labels[selected.origin]}
                      </span>
                      <span className="clause-chip">
                        §{" "}
                        {
                          session.document.clauses.find(
                            (clause) => clause.id === selected.clauseId,
                          )?.label
                        }
                      </span>
                    </div>
                    <h2>{selected.title}</h2>
                    <p className="explanation">{selected.explanation}</p>
                    {activeClauseId !== selected.clauseId && (
                      <button
                        className="return-button"
                        onClick={() => pickClause(selected.clauseId)}
                      >
                        <ArrowLeft size={14} /> Return to commented clause
                      </button>
                    )}
                    <div className="evidence-section">
                      <span className="section-label">
                        IN THIS DOCUMENT <span>{selected.related.length}</span>
                      </span>
                      {selected.related.length ? (
                        selected.related.map((evidence) => {
                          const target = session.document.clauses.find(
                            (clause) => clause.id === evidence.targetId,
                          );
                          return (
                            <button
                              key={evidence.targetId}
                              className={`evidence-card ${activeClauseId === evidence.targetId ? "viewing" : ""}`}
                              onClick={() => pickClause(evidence.targetId)}
                            >
                              <span className="evidence-card-title">
                                <span>CLAUSE {target?.label}</span>
                                <ArrowUpRight size={15} />
                              </span>
                              <strong>{target?.title}</strong>
                              <p>{evidence.reason}</p>
                              <blockquote>
                                {evidence.quote.length > 220
                                  ? `${evidence.quote.slice(0, 220)}…`
                                  : evidence.quote}
                              </blockquote>
                            </button>
                          );
                        })
                      ) : (
                        <p className="small-note">
                          No other passage is linked to this comment.
                        </p>
                      )}
                    </div>
                    <div className="evidence-section">
                      <span className="section-label">
                        LEGAL & REFERENCE SOURCES{" "}
                        <span>{selected.sources.length}</span>
                      </span>
                      {selected.sources.map((evidence, index) => {
                        const source = session.sources.find(
                          (item) => item.id === evidence.targetId,
                        );
                        if (!source) return null;
                        const url = safeSourceUrl(source.url);
                        return (
                          <div
                            key={`${source.id}-${index}`}
                            className="source-evidence"
                          >
                            <span className="source-kind">
                              {source.kind} · Supplied reference
                            </span>
                            <strong>{source.title}</strong>
                            <small>
                              {source.jurisdiction ||
                                "Jurisdiction unspecified"}{" "}
                              · {source.version || "Version not supplied"}
                            </small>
                            <blockquote>{evidence.quote}</blockquote>
                            <p>{evidence.reason}</p>
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer">
                                Open original source <ArrowUpRight size={13} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                      {!selected.sources.length && (
                        <div className="source-empty">
                          <BookOpen size={18} />
                          <p>
                            No legal authority attached.
                            <br />
                            Add a reference to support your review.
                          </p>
                          <button
                            className="text-button"
                            onClick={() => setModal("sources")}
                            disabled={analyzing}
                          >
                            Manage sources <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {selected.uncertainty && (
                      <div className="uncertainty">
                        <CircleAlert size={16} />
                        <div>
                          <strong>Still needs your judgment</strong>
                          <p>{selected.uncertainty}</p>
                        </div>
                      </div>
                    )}
                    <button
                      className={`button review-button ${selected.status === "reviewed" ? "reviewed" : ""}`}
                      onClick={() =>
                        setSession({
                          ...session,
                          findings: session.findings.map((finding) =>
                            finding.id === selected.id
                              ? {
                                  ...finding,
                                  status:
                                    finding.status === "open"
                                      ? "reviewed"
                                      : "open",
                                }
                              : finding,
                          ),
                        })
                      }
                    >
                      <Check size={16} />
                      {selected.status === "reviewed"
                        ? "Reviewed · reopen"
                        : "Mark as reviewed"}
                    </button>
                  </>
                ) : (
                  <div className="empty-panel">
                    <GitBranch size={24} />
                    <strong>Select a comment</strong>
                    <p>
                      Follow its connections to other clauses and source
                      material.
                    </p>
                  </div>
                )}
                {activeClause && (
                  <form className="comment-form" onSubmit={addComment}>
                    <label htmlFor="comment">
                      YOUR NOTE ON CLAUSE {activeClause.label}
                    </label>
                    <textarea
                      id="comment"
                      placeholder="What needs a closer look?"
                      value={comment}
                      maxLength={5000}
                      onChange={(event) => setComment(event.target.value)}
                      rows={3}
                    />
                    <label className="sr-only" htmlFor="comment-related">
                      Link another clause
                    </label>
                    <select
                      id="comment-related"
                      value={commentRelated}
                      onChange={(event) =>
                        setCommentRelated(event.target.value)
                      }
                    >
                      <option value="">Link another clause (optional)</option>
                      {session.document.clauses
                        .filter((clause) => clause.id !== activeClause.id)
                        .map((clause) => (
                          <option key={clause.id} value={clause.id}>
                            {clause.label} · {clause.title.slice(0, 55)}
                          </option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="comment-source">
                      Attach a source
                    </label>
                    <select
                      id="comment-source"
                      value={commentSource}
                      onChange={(event) => setCommentSource(event.target.value)}
                    >
                      <option value="">Attach a source (optional)</option>
                      {session.sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.title}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button secondary"
                      disabled={!comment.trim()}
                    >
                      <Plus size={14} /> Add comment
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
      {modal && (
        <Modal
          title={
            modal === "sources"
              ? "Your source library"
              : modal === "context"
                ? "Set the review context"
                : "Paste a document"
          }
          onClose={closeModal}
        >
          {error && (
            <div className="modal-alert" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="modal-notice" role="status">
              {notice}
            </div>
          )}
          {modal === "sources" && (
            <>
              <p className="modal-intro">
                Add the exact legal provisions, guidance or policies you want to
                review against. Source text is supplied by you; currency and
                applicability are not automatically verified.
              </p>
              <div className="source-list">
                {session?.sources.map((source) => (
                  <div key={source.id}>
                    <BookOpen size={16} />
                    <span>
                      <strong>{source.title}</strong>
                      <small>
                        {source.kind} ·{" "}
                        {source.jurisdiction || "Jurisdiction not supplied"} ·{" "}
                        {source.version || "Version not supplied"}
                      </small>
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Remove source ${source.title}`}
                      onClick={() => {
                        revision.current++;
                        setSession((current) =>
                          current
                            ? removeSourceFromSession(current, source.id)
                            : current,
                        );
                        setNotice(
                          "Source removed. Your comments are preserved and reopened for review; AI suggestions relying on that source were removed.",
                        );
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <form className="source-form" onSubmit={addSource}>
                <div className="form-heading">
                  <h3>Add a reference</h3>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => sourceFileInput.current?.click()}
                  >
                    <Upload size={14} />{" "}
                    {busy ? "Importing…" : "Import text from file"}
                  </button>
                </div>
                <label>
                  Source title
                  <input
                    required
                    value={sourceDraft.title}
                    maxLength={300}
                    placeholder="e.g. DIFC Data Protection Law · Article 24"
                    onChange={(event) =>
                      setSourceDraft({
                        ...sourceDraft,
                        title: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Type
                    <select
                      value={sourceDraft.kind}
                      onChange={(event) =>
                        setSourceDraft({
                          ...sourceDraft,
                          kind: event.target.value as LegalSource["kind"],
                        })
                      }
                    >
                      <option value="law">Law / regulation</option>
                      <option value="guidance">Regulatory guidance</option>
                      <option value="policy">Internal policy</option>
                    </select>
                  </label>
                  <label>
                    Jurisdiction
                    <input
                      value={sourceDraft.jurisdiction}
                      maxLength={300}
                      placeholder="e.g. DIFC"
                      onChange={(event) =>
                        setSourceDraft({
                          ...sourceDraft,
                          jurisdiction: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Version / effective date
                    <input
                      value={sourceDraft.version}
                      maxLength={200}
                      placeholder="As published on…"
                      onChange={(event) =>
                        setSourceDraft({
                          ...sourceDraft,
                          version: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Original source link
                    <input
                      type="url"
                      value={sourceDraft.url}
                      maxLength={2000}
                      placeholder="https://…"
                      onChange={(event) =>
                        setSourceDraft({
                          ...sourceDraft,
                          url: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Exact source text
                  <textarea
                    required
                    minLength={20}
                    maxLength={60000}
                    rows={5}
                    value={sourceDraft.text}
                    placeholder="Paste the relevant article and enough surrounding context to understand it."
                    onChange={(event) =>
                      setSourceDraft({
                        ...sourceDraft,
                        text: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-bottom">
                  <span className="small-note">
                    Up to 10 references per review.
                  </span>
                  <button className="button primary" disabled={busy}>
                    <Plus size={15} /> Add source
                  </button>
                </div>
              </form>
              <div className="official-links">
                <span className="section-label">OFFICIAL STARTING POINTS</span>
                <a
                  href="https://www.difc.com/business/registrars-and-commissioners/commissioner-of-data-protection/guidance"
                  target="_blank"
                  rel="noreferrer"
                >
                  DIFC guidance <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://www.pdpc.gov.sg/help-and-resources/2017/10/guide-on-data-protection-clauses-for-agreements-relating-to-the-processing-of-personal-data"
                  target="_blank"
                  rel="noreferrer"
                >
                  Singapore PDPC guidance <ArrowUpRight size={13} />
                </a>
              </div>
            </>
          )}
          {modal === "context" && (
            <form className="context-form" onSubmit={analyze}>
              <p className="modal-intro">
                A focused review of clause interactions, using your document and{" "}
                {session?.sources.length || 0} supplied reference(s). Legal
                findings require source text.
              </p>
              <label>
                Relevant jurisdiction
                <input
                  required
                  maxLength={300}
                  value={context.jurisdiction}
                  onChange={(event) =>
                    setContext({ ...context, jurisdiction: event.target.value })
                  }
                  placeholder="e.g. DIFC — applicability to be confirmed"
                />
              </label>
              <label>
                Party you represent
                <input
                  required
                  maxLength={300}
                  value={context.party}
                  onChange={(event) =>
                    setContext({ ...context, party: event.target.value })
                  }
                  placeholder="e.g. Customer / Northstar Studio"
                />
              </label>
              <label>
                What matters in this review?
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={context.instructions}
                  onChange={(event) =>
                    setContext({ ...context, instructions: event.target.value })
                  }
                  placeholder="Focus on subcontracting approvals and what happens to our data at termination."
                />
              </label>
              <div
                className={`connection-status ${analysisAvailable ? "connected" : ""}`}
              >
                <Settings2 size={18} />
                <div>
                  <strong>
                    {analysisAvailable
                      ? "Live analysis is connected"
                      : serverChecked
                        ? "Live analysis needs a server connection"
                        : "Checking connection…"}
                  </strong>
                  <p>
                    {analysisAvailable
                      ? "Suggestions will be checked against the quoted source text before appearing in your review."
                      : "Set OPENAI_API_KEY in the server’s .env file and restart the app. Uploads, reference mapping, comments and exports already work."}
                  </p>
                </div>
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  Send this document, review context and supplied source text to
                  OpenAI for this review.
                </span>
              </label>
              <div className="form-bottom">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setSession((current) =>
                      current ? { ...current, context } : current,
                    );
                    closeModal();
                  }}
                >
                  Save context
                </button>
                <button
                  className="button primary"
                  disabled={!analysisAvailable || !consent || analyzing}
                >
                  <Sparkles size={16} /> Run review
                </button>
              </div>
            </form>
          )}
          {modal === "paste" && (
            <form className="context-form" onSubmit={addPastedDocument}>
              <label>
                Document name
                <input
                  required
                  maxLength={300}
                  value={pastedName}
                  onChange={(event) => setPastedName(event.target.value)}
                />
              </label>
              <label>
                Document text
                <textarea
                  autoFocus
                  required
                  rows={12}
                  maxLength={250000}
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                  placeholder={
                    "1. Services\nThe Supplier will provide…\n\n2. Data processing\n…"
                  }
                />
              </label>
              <div className="form-bottom">
                <span className="small-note">
                  Keep clause numbers and headings where possible.
                </span>
                <button className="button primary">
                  <ArrowRight size={15} /> Open document
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
