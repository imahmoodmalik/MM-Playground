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
  FileText,
  FolderClosed,
  FolderOpen,
  GitBranch,
  Link2,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Sparkles,
  SquareSplitHorizontal,
  Upload,
  X,
} from "lucide-react";
import { exampleSession } from "../shared/demo";
import {
  applyReviewResult,
  isReviewItem,
  localReview,
  safeSourceUrl,
} from "../shared/review";
import { sessionSchema, sourceSchema } from "../shared/schema";
import type {
  Clause,
  Finding,
  LegalSource,
  ReviewContext,
  ReviewFocus,
  ReviewSession,
} from "../shared/types";
import { importDocument } from "./import";
import { AgreementReview, ReviewSetup } from "./AgreementReview";
import type { ReviewService } from "./AgreementReview";
import { reviewAgreement } from "./review-client";
import "./connected.css";
import {
  categorizeClauses,
  normalizeTermText,
  textDirection,
} from "../shared/terms";
import { TermsPanel } from "./TermsPanel";

type Connection = {
  id: string;
  target: Clause | LegalSource;
  direction: "outgoing" | "incoming" | "source";
  finding: Finding;
  reason: string;
};
type SideView = "terms" | "review" | "comments" | "connections" | "graph";
type OpenTarget = { type: "clause" | "source"; id: string; reason: string };
const originLabel: Record<Finding["origin"], string> = {
  "reference-check": "Reference check",
  "topic-match": "Keyword match",
  reviewer: "Your comment",
  ai: "AI suggestion",
  example: "Example comment",
};

function IconButton({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cw-icon ${active ? "is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="cw-dialog"
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      {children}
    </dialog>
  );
}

function HighlightedText({
  text,
  finding,
  onClick,
}: {
  text: string;
  finding?: Finding;
  onClick: () => void;
}) {
  const quote =
    finding?.quote &&
    (text.includes(finding.quote)
      ? finding.quote
      : finding.quote.split("\n").slice(1).join("\n").trim());
  if (!quote || !text.includes(quote)) return <>{text}</>;
  const index = text.indexOf(quote);
  return (
    <>
      {text.slice(0, index)}
      <mark
        className="cw-highlight"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        title={`Read comment: ${finding!.title}`}
      >
        {quote}
      </mark>
      {text.slice(index + quote.length)}
    </>
  );
}

function clauseBody(clause: Clause) {
  const lines = clause.text.split("\n");
  return lines[0].trim() === `${clause.label}. ${clause.title}`
    ? lines.slice(1).join("\n").trim()
    : clause.text;
}

const previewSession = exampleSession;

function LocalGraph({
  clause,
  connections,
  onOpen,
}: {
  clause: Clause;
  connections: Connection[];
  onOpen: (connection: Connection) => void;
}) {
  const nodes = connections
    .filter(
      (connection, index, list) =>
        list.findIndex((item) => item.target.id === connection.target.id) ===
        index,
    )
    .slice(0, 6);
  return (
    <div className="cw-local-graph">
      <svg
        viewBox="0 0 300 220"
        role="img"
        aria-label={`Connections around clause ${clause.label}. Use the list below to open a connection.`}
      >
        <defs>
          <radialGradient id="cw-glow">
            <stop stopColor="var(--cw-accent)" stopOpacity=".12" />
            <stop offset="1" stopColor="var(--cw-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="150" cy="110" r="105" fill="url(#cw-glow)" />
        {nodes.map((node, index) => {
          const angle =
            -Math.PI / 2 + (index * Math.PI * 2) / Math.max(nodes.length, 3);
          const x = 150 + Math.cos(angle) * 100;
          const y = 110 + Math.sin(angle) * 75;
          const explicit = node.finding.origin === "reference-check";
          return (
            <g key={node.id}>
              <line
                x1="150"
                y1="110"
                x2={x}
                y2={y}
                stroke={
                  explicit
                    ? "var(--cw-graph-reference)"
                    : "var(--cw-graph-link)"
                }
                strokeWidth="1.2"
                strokeDasharray={explicit ? undefined : "4 4"}
              />
              <g
                className="cw-graph-node"
                role="button"
                tabIndex={0}
                aria-label={`Open ${node.target.title} alongside`}
                onClick={() => onOpen(node)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(node);
                  }
                }}
              >
                <title>{node.target.title}</title>
                <rect
                  x={x - 28}
                  y={y - 18}
                  width="56"
                  height="50"
                  fill="transparent"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="7"
                  fill={
                    node.direction === "source"
                      ? "var(--cw-success)"
                      : "var(--cw-graph-link)"
                  }
                />
                <text x={x} y={y + 23} textAnchor="middle">
                  {"label" in node.target ? `§ ${node.target.label}` : "Source"}
                </text>
              </g>
            </g>
          );
        })}
        <circle
          cx="150"
          cy="110"
          r="12"
          fill="var(--cw-accent)"
          stroke="var(--cw-accent-line)"
          strokeWidth="2"
        />
        <text x="150" y="143" textAnchor="middle" className="cw-graph-center">
          § {clause.label} · current
        </text>
      </svg>
      <p>
        <span className="cw-graph-key" /> Explicit reference{" "}
        <span className="cw-graph-key suggested" /> Suggested / manual
      </p>
    </div>
  );
}

export default function ConnectedWorkspace() {
  const [session, setSession] = useState<ReviewSession>(previewSession);
  const [activeId, setActiveId] = useState(
    () => exampleSession().document.clauses.find((c) => c.label === "5")!.id,
  );
  const [findingId, setFindingId] = useState("example-retention");
  const [sideView, setSideView] = useState<SideView>("terms");
  const [comparison, setComparison] = useState<OpenTarget | null>(null);
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 1000);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "search" | "source" | "upload" | "review" | null
  >(null);
  const [note, setNote] = useState("");
  const [noteLink, setNoteLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [service, setService] = useState<ReviewService>("checking");
  const [reviewContext, setReviewContext] = useState<ReviewContext>(
    () => previewSession().context,
  );
  const [consent, setConsent] = useState(false);
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sourceDraft, setSourceDraft] = useState({
    title: "",
    text: "",
    url: "",
    jurisdiction: "",
    version: "",
    kind: "law" as LegalSource["kind"],
  });
  const [history, setHistory] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  const docScroll = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const reviewController = useRef<AbortController | null>(null);
  const active =
    session.document.clauses.find((c) => c.id === activeId) ||
    session.document.clauses[0];
  const selected = session.findings.find(
    (f) => f.id === findingId && f.clauseId === active.id,
  );
  const reviewItems = session.findings.filter(isReviewItem);
  const comments = reviewItems.filter((f) => f.clauseId === active.id);
  const reviewed = reviewItems.filter((f) => f.status === "reviewed").length;
  const readingClauses = session.document.isExample
    ? session.document.clauses.filter((clause) => !clause.label.startsWith("P"))
    : session.document.clauses;
  const displayTitle = session.document.isExample
    ? "Master services agreement"
    : session.document.name;
  const relatedTarget =
    comparison?.type === "source"
      ? session.sources.find((s) => s.id === comparison.id)
      : session.document.clauses.find((c) => c.id === comparison?.id);
  const matches = readingClauses.filter((c) =>
    normalizeTermText(`${c.label} ${c.title} ${c.text}`).includes(
      normalizeTermText(query),
    ),
  );

  async function checkService() {
    setService("checking");
    try {
      const response = await fetch("/api/status", {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Service unavailable");
      const data = await response.json();
      setService(data.analysisAvailable === true ? "available" : "unavailable");
    } catch {
      setService("offline");
    }
  }

  useEffect(() => {
    void checkService();
    return () => reviewController.current?.abort();
  }, []);

  async function runReview(event: FormEvent) {
    event.preventDefault();
    if (!consent || service !== "available" || analyzing || busy) return;
    const currentRevision = revision.current;
    const snapshot = {
      clauses: session.document.clauses,
      sources: session.sources,
      context: reviewContext,
      focus: reviewFocus,
    };
    const controller = new AbortController();
    reviewController.current = controller;
    setAnalyzing(true);
    setError("");
    setMessage("");
    setModal(null);
    setSideView(reviewFocus ? "comments" : "review");
    try {
      const result = await reviewAgreement(
        snapshot,
        AbortSignal.any([controller.signal, AbortSignal.timeout(100000)]),
      );
      if (revision.current !== currentRevision) return;
      setSession((current) =>
        applyReviewResult(current, result, snapshot.context, snapshot.focus),
      );
      if (result.findings.length) {
        setActiveId(result.findings[0].clauseId);
        setFindingId(result.findings[0].id);
      }
      setMessage(
        result.findings.length
          ? `${result.findings.length} AI suggestion${result.findings.length === 1 ? "" : "s"} added.`
          : "No AI findings returned.",
      );
    } catch (failure) {
      if (controller.signal.aborted || revision.current !== currentRevision)
        return;
      setError(
        failure instanceof Error && failure.name === "TimeoutError"
          ? "The review timed out. Your existing findings are unchanged."
          : failure instanceof Error
            ? failure.message
            : "The review could not finish. Your existing findings are unchanged.",
      );
    } finally {
      if (reviewController.current === controller) {
        setAnalyzing(false);
        setConsent(false);
        reviewController.current = null;
      }
    }
  }

  const connections = useMemo(() => {
    const items: Connection[] = [];
    for (const finding of session.findings) {
      if (finding.clauseId === active.id) {
        for (const relation of finding.related) {
          const target = session.document.clauses.find(
            (c) => c.id === relation.targetId,
          );
          if (target)
            items.push({
              id: `${finding.id}-${target.id}`,
              target,
              finding,
              reason: relation.reason,
              direction: "outgoing",
            });
        }
        for (const source of finding.sources) {
          const target = session.sources.find((s) => s.id === source.targetId);
          if (target)
            items.push({
              id: `${finding.id}-${target.id}`,
              target,
              finding,
              reason: source.reason,
              direction: "source",
            });
        }
      } else if (finding.related.some((r) => r.targetId === active.id)) {
        const target = session.document.clauses.find(
          (c) => c.id === finding.clauseId,
        );
        if (target)
          items.push({
            id: `${finding.id}-backlink`,
            target,
            finding,
            reason: finding.related.find((r) => r.targetId === active.id)!
              .reason,
            direction: "incoming",
          });
      }
    }
    return items;
  }, [session, active.id]);

  useEffect(() => {
    const parent = docScroll.current;
    const element = document.getElementById(`cw-${active.id}`);
    if (parent && element)
      parent.scrollTo({
        top:
          element.getBoundingClientRect().top -
          parent.getBoundingClientRect().top +
          parent.scrollTop -
          36,
        behavior: "smooth",
      });
  }, [active.id, session.document.name, Boolean(comparison), sidebar]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal("search");
      }
      if (event.key === "Escape" && !modal) setComparison(null);
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [modal]);
  useEffect(() => {
    if (session.document.isExample) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session.document.isExample]);

  function navigate(id: string) {
    if (id !== active.id) {
      setHistory((h) => [...h, active.id]);
      setForward([]);
    }
    setActiveId(id);
    setFindingId(reviewItems.find((f) => f.clauseId === id)?.id || "");
    setNoteLink("");
    setNote("");
  }
  function moveHistory(direction: "back" | "forward") {
    const stack = direction === "back" ? history : forward;
    const id = stack.at(-1);
    if (!id) return;
    if (direction === "back") {
      setHistory((h) => h.slice(0, -1));
      setForward((h) => [...h, active.id]);
    } else {
      setForward((h) => h.slice(0, -1));
      setHistory((h) => [...h, active.id]);
    }
    setActiveId(id);
    setFindingId(reviewItems.find((f) => f.clauseId === id)?.id || "");
    setNote("");
    setNoteLink("");
  }
  function openConnection(connection: Connection) {
    setComparison({
      type: connection.direction === "source" ? "source" : "clause",
      id: connection.target.id,
      reason: connection.reason,
    });
  }
  function selectComment(finding: Finding) {
    navigate(finding.clauseId);
    setFindingId(finding.id);
    setSideView("comments");
  }
  function reviewComment(finding: Finding) {
    setReviewFocus({
      commentId: finding.id,
      clauseId: finding.clauseId,
      quote: finding.quote,
      comment: finding.explanation || finding.title,
    });
    setConsent(false);
    setModal("review");
    void checkService();
  }
  function toggleReviewed(id: string) {
    setSession((current) => ({
      ...current,
      findings: current.findings.map((f) =>
        f.id === id
          ? { ...f, status: f.status === "open" ? "reviewed" : "open" }
          : f,
      ),
    }));
  }
  function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    const target = session.document.clauses.find((c) => c.id === noteLink);
    const source = session.sources.find((s) => s.id === noteLink);
    const finding: Finding = {
      id: `comment-${crypto.randomUUID()}`,
      kind: "comment",
      origin: "reviewer",
      title: note.trim().split("\n")[0].slice(0, 80),
      explanation: note.trim(),
      clauseId: active.id,
      quote: active.text.slice(0, 1000),
      related: target
        ? [
            {
              targetId: target.id,
              quote: target.text.slice(0, 1000),
              reason: "Linked by you",
            },
          ]
        : [],
      sources: source
        ? [
            {
              targetId: source.id,
              quote: source.text.slice(0, 1500),
              reason: "Attached by you; check applicability",
            },
          ]
        : [],
      uncertainty: "",
      status: "open",
    };
    setSession((current) => ({
      ...current,
      findings: [...current.findings, finding],
    }));
    setFindingId(finding.id);
    setNote("");
    setNoteLink("");
    setSideView("comments");
  }
  async function upload(file?: File) {
    if (!file || busy || analyzing) return;
    setBusy(true);
    setError("");
    try {
      let next: ReviewSession;
      if (
        file.name.endsWith(".donna.json") ||
        file.name.endsWith(".rooted.json")
      ) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("This saved review is too large.");
        const parsed = sessionSchema.safeParse(JSON.parse(await file.text()));
        if (!parsed.success)
          throw new Error("This is not a valid Donna review file.");
        next = parsed.data;
      } else {
        const { document, comments } = await importDocument(file);
        next = {
          version: 1,
          document,
          findings: [...comments, ...localReview(document.clauses)],
          sources: [],
          context: { jurisdiction: "", party: "", instructions: "" },
        };
      }
      revision.current++;
      setSession(next);
      setReviewContext(next.context);
      setConsent(false);
      setActiveId(
        next.findings.find(isReviewItem)?.clauseId ||
          next.document.clauses[0].id,
      );
      setReviewFocus(undefined);
      setFindingId(next.findings.find(isReviewItem)?.id || "");
      setComparison(null);
      setHistory([]);
      setForward([]);
      setQuery("");
      setNote("");
      setNoteLink("");
      setModal(null);
      setSideView("terms");
      setMessage(
        next.findings.some((finding) => finding.origin === "ai")
          ? "Saved review opened."
          : "Agreement opened.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not open this document.",
      );
    } finally {
      setBusy(false);
      if (uploadInput.current) uploadInput.current.value = "";
    }
  }
  function saveReview() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${session.document.name.replace(/[^a-z0-9 -]/gi, "").slice(0, 80) || "review"}.donna.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function addSource(event: FormEvent) {
    event.preventDefault();
    if (analyzing) {
      setError(
        "Wait for the current review to finish before changing its sources.",
      );
      return;
    }
    const parsed = sourceSchema.safeParse({
      ...sourceDraft,
      id: `source-${crypto.randomUUID()}`,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    if (parsed.data.url && !safeSourceUrl(parsed.data.url)) {
      setError("Use an http or https address.");
      return;
    }
    if (session.sources.length >= 10) {
      setError("Keep this review to 10 sources or fewer.");
      return;
    }
    revision.current++;
    setSession((current) => ({
      ...current,
      sources: [...current.sources, parsed.data],
      analysis: undefined,
      commentReviews: undefined,
    }));
    setComparison({
      type: "source",
      id: parsed.data.id,
      reason:
        "Source supplied by you. Attach it to a comment to create a connection.",
    });
    setSourceDraft({
      title: "",
      text: "",
      url: "",
      jurisdiction: "",
      version: "",
      kind: "law",
    });
    setModal(null);
    setError("");
  }
  const closeModal = () => {
    setModal(null);
    setError("");
  };
  const connectionCard = (connection: Connection) => (
    <button
      className="cw-link-card"
      key={connection.id}
      onClick={() => openConnection(connection)}
    >
      <span className="cw-link-type">
        {connection.direction === "incoming"
          ? "Backlink"
          : originLabel[connection.finding.origin]}
        <ArrowUpRight size={13} />
      </span>
      <strong>
        {"label" in connection.target ? `${connection.target.label}. ` : ""}
        {connection.target.title}
      </strong>
      <span>{connection.reason}</span>
    </button>
  );

  return (
    <div
      className={`connected-workspace ${sidebar ? "" : "cw-sidebar-hidden"} ${comparison ? "cw-is-comparing" : ""}`}
      data-theme={
        new URLSearchParams(window.location.search).get("theme") === "burgundy"
          ? "burgundy"
          : undefined
      }
    >
      <input
        type="file"
        className="sr-only"
        ref={uploadInput}
        accept=".pdf,.docx,.txt,.md,.donna.json,.rooted.json"
        aria-label="Upload document"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <nav className="cw-rail" aria-label="Workspace tools">
        <div className="cw-logo" title="Donna">
          <span aria-hidden="true">D</span>
        </div>
        <IconButton
          label="Toggle document explorer"
          onClick={() => setSidebar((value) => !value)}
          active={sidebar}
        >
          <FolderClosed size={20} />
        </IconButton>
        <IconButton label="Find a clause" onClick={() => setModal("search")}>
          <Search size={20} />
        </IconButton>
        <IconButton
          label="Review all findings"
          onClick={() => setSideView("review")}
          active={sideView === "review"}
        >
          <ListChecks size={20} />
        </IconButton>
        <IconButton
          label="Show local graph"
          onClick={() => setSideView("graph")}
          active={sideView === "graph"}
        >
          <Network size={20} />
        </IconButton>
        <IconButton label="Add legal source" onClick={() => setModal("source")}>
          <BookOpen size={19} />
        </IconButton>
        <div className="cw-rail-bottom">
          <IconButton label="Save review" onClick={saveReview}>
            <ArrowDownToLine size={19} />
          </IconButton>
          <span className="cw-profile" title="Your local workspace">
            M
          </span>
        </div>
      </nav>

      <aside className="cw-explorer" aria-label="Document explorer">
        <header>
          <span>
            Donna<span className="cw-brand-dot">.</span>
          </span>
          <IconButton
            label="Hide document explorer"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose size={16} />
          </IconButton>
        </header>
        <button className="cw-vault" onClick={() => setModal("upload")}>
          <span className="cw-vault-icon">
            <FolderOpen size={17} />
          </span>
          <span>
            My workspace<small>Local to this session</small>
          </span>
          <Plus size={15} />
        </button>
        <button
          className="cw-search-trigger"
          onClick={() => setModal("search")}
        >
          <Search size={14} />
          <span>Jump to a clause</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="cw-explorer-scroll">
          <div className="cw-section-label">
            DOCUMENTS{" "}
            <button
              title="Open a document"
              aria-label="Open a document"
              onClick={() => setModal("upload")}
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            className="cw-folder"
            onClick={() => setOutlineOpen((open) => !open)}
            aria-expanded={outlineOpen}
          >
            {outlineOpen ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
            <FolderOpen size={15} />
            <span>
              {session.document.isExample
                ? "Northstar × Acme"
                : "Current review"}
            </span>
            <span className="cw-tiny-count">1</span>
          </button>
          <button
            className="cw-file active"
            onClick={() => {
              setOutlineOpen(true);
              navigate(readingClauses[0].id);
            }}
          >
            <FileText size={15} />
            <span>{displayTitle}</span>
          </button>
          {outlineOpen && (
            <nav className="cw-outline" aria-label="Clauses">
              {readingClauses.map((clause) => (
                <button
                  key={clause.id}
                  className={active.id === clause.id ? "active" : ""}
                  onClick={() => navigate(clause.id)}
                >
                  <span className="cw-clause-number">{clause.label}</span>
                  <span>{clause.title}</span>
                  {session.findings.some(
                    (f) => f.clauseId === clause.id && f.origin === "example",
                  ) && <span className="cw-note-dot" />}
                </button>
              ))}
            </nav>
          )}
          <div className="cw-section-label cw-sources-label">
            LEGAL SOURCES{" "}
            <button
              title="Add a source"
              aria-label="Add a source"
              onClick={() => setModal("source")}
            >
              <Plus size={15} />
            </button>
          </div>
          {session.sources.map((source) => (
            <button
              className="cw-file"
              key={source.id}
              onClick={() =>
                setComparison({
                  type: "source",
                  id: source.id,
                  reason:
                    "Source supplied by you; verify version and applicability.",
                })
              }
            >
              <BookOpen size={14} />
              <span>{source.title}</span>
            </button>
          ))}
          {!session.sources.length && (
            <button
              className="cw-add-source"
              onClick={() => setModal("source")}
            >
              <Plus size={13} /> Add law, guidance or policy
            </button>
          )}
        </div>
        <div className="cw-explorer-footer">
          <span className="cw-local-dot" />
          <span>
            Private workspace<small>Save your review before leaving</small>
          </span>
        </div>
      </aside>

      <section className="cw-workspace" aria-label="Reading workspace">
        <header className="cw-tabs">
          <div className="cw-document-tab">
            <FileText size={15} />
            <span>{displayTitle}</span>
            <span className="cw-tab-dot" />
          </div>
          <button
            className="cw-tab-add"
            title="Open a document"
            aria-label="Open another document"
            onClick={() => setModal("upload")}
          >
            <Plus size={17} />
          </button>
          <span className="cw-preview-badge">DESIGN PREVIEW</span>
        </header>
        <div className="cw-workspace-actions">
          <span>
            {session.document.isExample ? "Sample agreement" : "Your agreement"}
            <small>
              {analyzing
                ? "Full review in progress"
                : session.analysis
                  ? "AI review returned"
                  : service === "unavailable"
                    ? "AI review not connected"
                    : service === "available"
                      ? "AI review available"
                      : service === "offline"
                        ? "Review service offline"
                        : "Checking connection…"}
            </small>
          </span>
          <button
            className="cw-secondary"
            disabled={busy || analyzing}
            onClick={() => setModal("upload")}
          >
            <Upload size={14} /> Upload agreement
          </button>
          <button
            className="cw-primary"
            disabled={busy || analyzing}
            onClick={() => {
              setReviewFocus(undefined);
              setConsent(false);
              setModal("review");
              void checkService();
            }}
          >
            {analyzing ? (
              <LoaderCircle className="cw-spin" size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            {analyzing ? "Reviewing…" : "Review agreement"}
          </button>
        </div>
        <div className="cw-document-toolbar">
          <div className="cw-navigation">
            {!sidebar && (
              <IconButton
                label="Show document explorer"
                onClick={() => setSidebar(true)}
              >
                <PanelLeftOpen size={16} />
              </IconButton>
            )}
            <button
              aria-label="Previous location"
              title="Previous location"
              disabled={!history.length}
              onClick={() => moveHistory("back")}
            >
              <ArrowLeft size={15} />
            </button>
            <button
              aria-label="Next location"
              title="Next location"
              disabled={!forward.length}
              onClick={() => moveHistory("forward")}
            >
              <ArrowRight size={15} />
            </button>
          </div>
          <span className="cw-breadcrumb">
            {session.document.isExample ? "Northstar × Acme" : "Documents"}
            <ChevronRight size={12} />
            <span>{active.title}</span>
          </span>
          <button
            className="cw-reading-label"
            title="Show connected clauses"
            onClick={() => setSideView("connections")}
          >
            <Link2 size={14} />
            <span>
              {connections.length} connection
              {connections.length === 1 ? "" : "s"}
            </span>
          </button>
        </div>
        {(message || error) && !modal && (
          <div
            className={`cw-toast ${error ? "cw-error" : ""}`}
            role={error ? "alert" : "status"}
          >
            <span>{error || message}</span>
            <IconButton
              label="Dismiss message"
              onClick={() => {
                setMessage("");
                setError("");
              }}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
        <div className="cw-reading-area">
          <section className="cw-document-column" aria-label="Agreement text">
            <div className="cw-document-info">
              <span>
                <span className="cw-local-dot" />{" "}
                {session.document.isExample
                  ? "Fictional agreement"
                  : "Extracted document text"}
              </span>
              <span>{readingClauses.length} sections</span>
            </div>
            <div className="cw-editor-scroll" ref={docScroll}>
              <div className="cw-paper">
                <div className="cw-paper-heading">
                  <span className="cw-overline">
                    {session.document.isExample
                      ? "NORTHSTAR STUDIO / ACME CLOUD"
                      : "DOCUMENT REVIEW"}
                  </span>
                  <h1>{displayTitle}</h1>
                  <p>
                    {session.document.isExample
                      ? "02 October 2026 · Working copy"
                      : "Text view · consult the original for formatting"}
                  </p>
                </div>
                {readingClauses.map((clause) => {
                  const findings = reviewItems.filter(
                    (f) => f.clauseId === clause.id,
                  );
                  const annotation =
                    clause.id === active.id
                      ? selected ||
                        findings.find(
                          (f) =>
                            f.origin === "example" || f.origin === "reviewer",
                        )
                      : findings.find(
                          (f) =>
                            f.origin === "example" || f.origin === "reviewer",
                        );
                  return (
                    <article
                      id={`cw-${clause.id}`}
                      key={clause.id}
                      className={`cw-clause ${active.id === clause.id ? "is-current" : ""}`}
                    >
                      <div className="cw-clause-heading">
                        <button
                          className="cw-anchor"
                          aria-label={`Focus clause ${clause.label}`}
                          onClick={() => navigate(clause.id)}
                        >
                          §
                        </button>
                        <h2>
                          <button
                            dir={textDirection(clause.title)}
                            onClick={() => navigate(clause.id)}
                          >
                            {clause.label}. {clause.title}
                          </button>
                        </h2>
                        <button
                          className={`cw-comment-count ${findings.some((f) => f.origin === "example") ? "has-editorial" : ""}`}
                          aria-label={`View ${findings.length} comment${findings.length === 1 ? "" : "s"} on clause ${clause.label}`}
                          onClick={() => {
                            navigate(clause.id);
                            setSideView("comments");
                          }}
                        >
                          <MessageSquare size={13} />
                          {findings.length}
                        </button>
                      </div>
                      <p dir={textDirection(clauseBody(clause))}>
                        <HighlightedText
                          text={clauseBody(clause)}
                          finding={annotation}
                          onClick={() =>
                            annotation && selectComment(annotation)
                          }
                        />
                      </p>
                      {active.id === clause.id && connections.length > 0 && (
                        <div className="cw-inline-links">
                          <Link2 size={13} />
                          <span>Connected to</span>
                          {connections
                            .filter(
                              (c, index, list) =>
                                list.findIndex(
                                  (item) => item.target.id === c.target.id,
                                ) === index,
                            )
                            .slice(0, 3)
                            .map((connection) => (
                              <button
                                key={connection.id}
                                onClick={() => openConnection(connection)}
                              >
                                {"label" in connection.target
                                  ? `§ ${connection.target.label}`
                                  : connection.target.title}
                                <ArrowUpRight size={11} />
                              </button>
                            ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                <div className="cw-document-end">
                  End of document <span>◇</span>
                </div>
                {session.document.warnings.length > 0 && (
                  <details className="cw-import-notes">
                    <summary>About this document</summary>
                    {session.document.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </details>
                )}
              </div>
            </div>
            <footer className="cw-reading-footer">
              <span>
                <BookOpen size={13} /> Reading view
              </span>
              <span>Clause {active.label}</span>
            </footer>
          </section>
          {relatedTarget && comparison && (
            <aside className="cw-comparison" aria-label="Linked reading pane">
              <header>
                <SquareSplitHorizontal size={15} />
                <span>Linked reading</span>
                <IconButton
                  label="Close linked reading"
                  onClick={() => setComparison(null)}
                >
                  <X size={16} />
                </IconButton>
              </header>
              <div className="cw-comparison-scroll">
                <span className="cw-overline">
                  {comparison.type === "source"
                    ? "YOUR SOURCE LIBRARY"
                    : "SAME AGREEMENT"}
                </span>
                <h2>
                  {"label" in relatedTarget ? `${relatedTarget.label}. ` : ""}
                  {relatedTarget.title}
                </h2>
                {"jurisdiction" in relatedTarget && (
                  <div className="cw-source-meta">
                    {relatedTarget.kind} ·{" "}
                    {relatedTarget.jurisdiction || "Jurisdiction not supplied"}
                    <br />
                    {relatedTarget.version || "Version not supplied"}
                  </div>
                )}
                <p
                  className="cw-comparison-text"
                  dir={textDirection(relatedTarget.text)}
                >
                  {"label" in relatedTarget
                    ? clauseBody(relatedTarget)
                    : relatedTarget.text}
                </p>
                <div className="cw-connection-reason">
                  <GitBranch size={16} />
                  <div>
                    <strong>Why it’s connected</strong>
                    <p>{comparison.reason}</p>
                  </div>
                </div>
                {comparison.type === "clause" && (
                  <button
                    className="cw-text-action"
                    onClick={() => {
                      navigate(relatedTarget.id);
                      setComparison(null);
                      setSideView("connections");
                    }}
                  >
                    Go to this clause <ArrowRight size={14} />
                  </button>
                )}
                {"url" in relatedTarget && safeSourceUrl(relatedTarget.url) && (
                  <a
                    className="cw-text-action"
                    target="_blank"
                    rel="noreferrer"
                    href={safeSourceUrl(relatedTarget.url)!}
                  >
                    Open original source <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
              <footer>
                <Link2 size={13} /> Your reading position is kept alongside.
              </footer>
            </aside>
          )}
        </div>
      </section>

      <aside className="cw-inspector" aria-label="Clause details">
        <header className="cw-inspector-header">
          <span>
            {sideView === "review" ? (
              <ListChecks size={16} />
            ) : (
              <GitBranch size={16} />
            )}{" "}
            {sideView === "terms"
              ? "Agreement terms"
              : sideView === "review"
                ? "Agreement review"
                : "Clause context"}
          </span>
          <span className="cw-clause-pill">§ {active.label}</span>
        </header>
        <div
          className="cw-inspector-tabs"
          role="tablist"
          aria-label="Clause context views"
        >
          {(["terms", "comments", "connections", "review"] as const).map(
            (view) => (
              <button
                role="tab"
                aria-selected={sideView === view}
                key={view}
                onClick={() => setSideView(view)}
              >
                {view === "terms"
                  ? "Terms"
                  : view === "review"
                    ? "Review"
                    : view === "comments"
                      ? "Comments"
                      : view === "connections"
                        ? "Links"
                        : "Graph"}
                <span>
                  {view === "terms" ? (
                    new Set(
                      categorizeClauses(readingClauses).map(
                        (passage) => passage.categoryId,
                      ),
                    ).size
                  ) : view === "review" ? (
                    reviewItems.length
                  ) : view === "comments" ? (
                    comments.length
                  ) : view === "connections" ? (
                    connections.length
                  ) : (
                    <Network size={13} />
                  )}
                </span>
              </button>
            ),
          )}
        </div>
        <div
          className="cw-inspector-body"
          role="tabpanel"
          aria-label={
            sideView === "review"
              ? "Whole agreement review"
              : `${sideView} for clause ${active.label}`
          }
        >
          {sideView === "terms" && (
            <TermsPanel
              key={session.document.name}
              clauses={readingClauses}
              onPick={navigate}
            />
          )}
          {sideView === "review" && (
            <AgreementReview
              session={session}
              running={analyzing}
              onPick={selectComment}
            />
          )}
          {sideView !== "review" && sideView !== "terms" && (
            <div className="cw-context-heading">
              <span className="cw-overline">YOU’RE READING</span>
              <h2>{active.title}</h2>
            </div>
          )}
          {sideView === "comments" && (
            <>
              {comments.length === 0 && (
                <div className="cw-empty">
                  <MessageSquare size={23} />
                  <h3>No comments on this clause</h3>
                </div>
              )}
              {comments.map((finding) => (
                <article
                  className={`cw-comment-card ${finding.id === findingId ? "selected" : ""} ${finding.status === "reviewed" ? "reviewed" : ""}`}
                  key={finding.id}
                >
                  <div className="cw-comment-byline">
                    <span
                      className={`cw-comment-avatar ${finding.origin === "reviewer" ? "reviewer" : ""}`}
                    >
                      {finding.origin === "reviewer" ? (
                        finding.imported ? (
                          (finding.author || "W").slice(0, 1)
                        ) : (
                          "M"
                        )
                      ) : (
                        <GitBranch size={14} />
                      )}
                    </span>
                    <span>
                      {finding.origin === "reviewer"
                        ? finding.imported
                          ? finding.author || "Word reviewer"
                          : "You"
                        : finding.origin === "example"
                          ? "Donna example"
                          : originLabel[finding.origin]}
                      <small>
                        {finding.imported
                          ? "Word comment"
                          : finding.status === "reviewed"
                            ? "Reviewed"
                            : "Open for review"}
                      </small>
                    </span>
                    <button
                      title={
                        finding.status === "reviewed"
                          ? "Reopen comment"
                          : "Mark reviewed"
                      }
                      aria-label={`${finding.status === "reviewed" ? "Reopen" : "Mark reviewed:"} ${finding.title}`}
                      onClick={() => toggleReviewed(finding.id)}
                      className="cw-resolve"
                    >
                      {finding.status === "reviewed" ? (
                        <CheckCheck size={17} />
                      ) : (
                        <Check size={17} />
                      )}
                    </button>
                  </div>
                  <button
                    className="cw-comment-title"
                    onClick={() => selectComment(finding)}
                  >
                    {finding.title}
                  </button>
                  {finding.explanation !== finding.title && (
                    <p>{finding.explanation}</p>
                  )}
                  {finding.respondsTo && (
                    <button
                      className="cw-text-action"
                      onClick={() => {
                        const parent = session.findings.find(
                          (item) => item.id === finding.respondsTo,
                        );
                        if (parent) selectComment(parent);
                      }}
                    >
                      In response to your comment <ArrowUpRight size={12} />
                    </button>
                  )}
                  {(finding.origin === "ai" || finding.imported) && (
                    <blockquote className="cw-evidence-quote">
                      <span>QUOTED FROM § {active.label}</span>
                      {finding.quote}
                    </blockquote>
                  )}
                  {connections
                    .filter(
                      (c) =>
                        c.finding.id === finding.id &&
                        c.direction !== "incoming",
                    )
                    .map((connection) => (
                      <button
                        className="cw-comment-link"
                        key={connection.id}
                        onClick={() => openConnection(connection)}
                      >
                        <FileText size={14} />
                        <span>
                          {"label" in connection.target
                            ? `§ ${connection.target.label} · `
                            : ""}
                          {connection.target.title}
                          <small>{connection.reason}</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  {finding.uncertainty && (
                    <div className="cw-follow-up">
                      <span>TO CHECK</span>
                      <p>{finding.uncertainty}</p>
                    </div>
                  )}
                  {finding.origin === "reviewer" && (
                    <div className="cw-comment-review">
                      <button
                        className="cw-secondary"
                        disabled={busy || analyzing}
                        onClick={() => reviewComment(finding)}
                      >
                        <GitBranch size={14} /> Find affected clauses
                      </button>
                      {session.commentReviews
                        ?.filter((run) => run.commentId === finding.id)
                        .map((run) => (
                          <p key={run.commentId} role="status">
                            {run.accepted
                              ? `${run.accepted} AI suggestion${run.accepted === 1 ? "" : "s"} below.`
                              : "No supported connections returned for this comment."}
                            {run.rejected ? ` ${run.rejected} withheld.` : ""}
                          </p>
                        ))}
                    </div>
                  )}
                </article>
              ))}
              <form className="cw-note-form" onSubmit={addNote}>
                <label htmlFor="cw-note">
                  <MessageSquare size={14} /> Add a comment
                </label>
                <textarea
                  id="cw-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={`Comment on clause ${active.label}…`}
                  maxLength={6000}
                  rows={3}
                />
                <label className="sr-only" htmlFor="cw-note-link">
                  Link a clause or source
                </label>
                <select
                  id="cw-note-link"
                  value={noteLink}
                  onChange={(event) => setNoteLink(event.target.value)}
                >
                  <option value="">Link a clause or source…</option>
                  <optgroup label="Agreement clauses">
                    {readingClauses
                      .filter((c) => c.id !== active.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}. {c.title}
                        </option>
                      ))}
                  </optgroup>
                  {session.sources.length > 0 && (
                    <optgroup label="Legal sources">
                      {session.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div>
                  <span>Attached to § {active.label}</span>
                  <button
                    className="cw-primary"
                    disabled={!note.trim()}
                    type="submit"
                  >
                    Comment <Send size={13} />
                  </button>
                </div>
              </form>
            </>
          )}
          {(sideView === "connections" || sideView === "graph") && (
            <>
              {sideView === "graph" && (
                <>
                  <LocalGraph
                    clause={active}
                    connections={connections}
                    onOpen={openConnection}
                  />
                  <p className="cw-graph-caption">
                    Select a clause to read it alongside.
                  </p>
                </>
              )}
              {connections.length === 0 && (
                <div className="cw-empty">
                  <Link2 size={23} />
                  <h3>No links added</h3>
                </div>
              )}
              {(["outgoing", "incoming", "source"] as const).map(
                (direction) => {
                  const group = connections.filter(
                    (c) => c.direction === direction,
                  );
                  return group.length ? (
                    <section className="cw-connections-group" key={direction}>
                      <h3>
                        {direction === "incoming"
                          ? "BACKLINKS"
                          : direction === "source"
                            ? "LEGAL SOURCES"
                            : "LINKED CLAUSES"}
                        <span>{group.length}</span>
                      </h3>
                      {group.map(connectionCard)}
                    </section>
                  ) : null;
                },
              )}
            </>
          )}
        </div>
        <footer className="cw-inspector-footer">
          <span>
            <CheckCheck size={14} /> {reviewed} of {reviewItems.length} reviewed
          </span>
          <button onClick={saveReview} title="Download this review">
            <ArrowDownToLine size={14} /> Save
          </button>
        </footer>
      </aside>
      <footer className="cw-statusbar">
        <span>
          <span className="cw-local-dot" /> Local workspace{" "}
          <span className="cw-status-separator">/</span>{" "}
          {session.document.isExample
            ? "Fictional sample"
            : "Save to keep changes"}
        </span>
        <span>
          {session.sources.length} sources{" "}
          <span className="cw-status-separator">·</span>{" "}
          {session.document.clauses.reduce(
            (sum, c) => sum + c.text.split(/\s+/).length,
            0,
          )}{" "}
          words <span className="cw-status-separator">·</span> Session only
        </span>
      </footer>

      {modal === "search" && (
        <Sheet title="Jump to a clause" onClose={closeModal}>
          <div className="cw-search-box">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search clauses"
              placeholder="Search titles, numbers or document text…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="cw-search-results">
            {matches.map((clause) => (
              <button
                key={clause.id}
                onClick={() => {
                  navigate(clause.id);
                  setModal(null);
                  setQuery("");
                }}
              >
                <span>§ {clause.label}</span>
                <div>
                  <strong>{clause.title}</strong>
                  <p>{clause.text.slice(0, 130)}…</p>
                </div>
                <ArrowRight size={15} />
              </button>
            ))}
            {!matches.length && (
              <p className="cw-empty">
                No matching clauses. Try a different word.
              </p>
            )}
          </div>
        </Sheet>
      )}
      {modal === "upload" && (
        <Sheet title="Open a document" onClose={closeModal}>
          <p className="cw-dialog-intro">
            Bring your agreement into this workspace. Opening a file replaces
            the current review; save a copy first if you want to keep it.
          </p>
          <div
            className="cw-upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void upload(event.dataTransfer.files[0]);
            }}
          >
            <Upload size={30} />
            <h3>
              {busy ? "Opening your document…" : "Drop your document here"}
            </h3>
            <p>PDF, DOCX, TXT, Markdown or a saved Donna review</p>
            <button
              className="cw-primary"
              disabled={busy || analyzing}
              onClick={() => uploadInput.current?.click()}
            >
              Choose a file
            </button>
          </div>
          <p className="cw-dialog-footnote">
            Up to 12 MB. Imported files appear as extracted text in this
            preview.
          </p>
          {error && (
            <p className="cw-error" role="alert">
              {error}
            </p>
          )}
          <button className="cw-text-action" onClick={saveReview}>
            <ArrowDownToLine size={14} /> Save current review
          </button>
        </Sheet>
      )}
      {modal === "source" && (
        <Sheet title="Add a legal source" onClose={closeModal}>
          <p className="cw-dialog-intro">
            Add a provision, guidance or policy excerpt. Attach it to a comment
            to connect it to your agreement.
          </p>
          <form className="cw-source-form" onSubmit={addSource}>
            <label>
              Source title
              <input
                autoFocus
                required
                maxLength={300}
                value={sourceDraft.title}
                onChange={(event) =>
                  setSourceDraft({ ...sourceDraft, title: event.target.value })
                }
                placeholder="Law or policy · Article / section"
              />
            </label>
            <div className="cw-form-row">
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
                  <option value="law">Law</option>
                  <option value="guidance">Guidance</option>
                  <option value="policy">Policy</option>
                </select>
              </label>
              <label>
                Jurisdiction
                <input
                  maxLength={150}
                  value={sourceDraft.jurisdiction}
                  onChange={(event) =>
                    setSourceDraft({
                      ...sourceDraft,
                      jurisdiction: event.target.value,
                    })
                  }
                  placeholder="e.g. DIFC"
                />
              </label>
            </div>
            <label>
              Version / date
              <input
                maxLength={150}
                value={sourceDraft.version}
                onChange={(event) =>
                  setSourceDraft({
                    ...sourceDraft,
                    version: event.target.value,
                  })
                }
                placeholder="Version of the source you’re using"
              />
            </label>
            <label>
              Source link
              <input
                type="url"
                value={sourceDraft.url}
                onChange={(event) =>
                  setSourceDraft({ ...sourceDraft, url: event.target.value })
                }
                placeholder="https://"
              />
            </label>
            <label>
              Exact source text
              <textarea
                required
                minLength={30}
                maxLength={60000}
                rows={5}
                value={sourceDraft.text}
                onChange={(event) =>
                  setSourceDraft({ ...sourceDraft, text: event.target.value })
                }
              />
            </label>
            <p className="cw-dialog-footnote">
              Check the source’s currency and applicability. Neither is
              automatically verified.
            </p>
            {error && (
              <p className="cw-error" role="alert">
                {error}
              </p>
            )}
            <button className="cw-primary" type="submit" disabled={analyzing}>
              <Plus size={15} /> Add source
            </button>
          </form>
        </Sheet>
      )}
      {modal === "review" && (
        <Sheet
          title={
            reviewFocus ? "Find affected clauses" : "Review your agreement"
          }
          onClose={closeModal}
        >
          <ReviewSetup
            session={session}
            focus={reviewFocus}
            context={reviewContext}
            setContext={setReviewContext}
            service={service}
            running={analyzing}
            consent={consent}
            setConsent={setConsent}
            onRun={runReview}
            onRefresh={() => void checkService()}
            onSources={() => setModal("source")}
          />
          {error && (
            <p className="cw-error" role="alert">
              {error}
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}
