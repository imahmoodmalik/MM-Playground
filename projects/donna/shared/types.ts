export interface Clause {
  id: string;
  label: string;
  title: string;
  text: string;
  page?: number;
}
export type FindingKind =
  "reference" | "missing-reference" | "connection" | "legal" | "comment";
export type FindingOrigin =
  "reference-check" | "topic-match" | "reviewer" | "ai" | "example";
export interface Evidence {
  targetId: string;
  quote: string;
  reason: string;
}
export interface Finding {
  id: string;
  kind: FindingKind;
  origin: FindingOrigin;
  title: string;
  explanation: string;
  clauseId: string;
  quote: string;
  related: Evidence[];
  sources: Evidence[];
  uncertainty: string;
  status: "open" | "reviewed";
  respondsTo?: string;
  author?: string;
  imported?: boolean;
}
export interface ReviewFocus {
  commentId: string;
  clauseId: string;
  quote: string;
  comment: string;
}
export interface ReviewRun {
  completedAt: string;
  clauseCount: number;
  sourceCount: number;
  accepted: number;
  rejected: number;
}
export interface LegalSource {
  id: string;
  title: string;
  jurisdiction: string;
  version: string;
  url: string;
  kind: "law" | "guidance" | "policy";
  text: string;
}
export interface ReviewDocument {
  name: string;
  clauses: Clause[];
  warnings: string[];
  isExample: boolean;
}
export interface ReviewContext {
  jurisdiction: string;
  party: string;
  instructions: string;
}
export interface ReviewSession {
  version: 1;
  document: ReviewDocument;
  findings: Finding[];
  sources: LegalSource[];
  context: ReviewContext;
  analysis?: ReviewRun;
  commentReviews?: Array<ReviewRun & { commentId: string }>;
}
