import { containsQuote, normalize } from "../shared/review";
import type { Clause, Finding } from "../shared/types";

interface WordNode {
  type: string;
  value?: string;
  children?: WordNode[];
  comments?: WordComment[];
  commentId?: string;
}
interface WordComment {
  commentId: string;
  body: WordNode[];
  authorName?: string;
}
export interface ImportedComment {
  id: string;
  text: string;
  author: string;
  paragraph: string;
}

function plainText(node: WordNode): string {
  if (node.type === "text") return node.value || "";
  if (node.type === "tab") return "\t";
  if (node.type === "break") return "\n";
  return (
    (node.children || []).map(plainText).join("") +
    (node.type === "paragraph" ? "\n\n" : "")
  );
}

// The converter exposes comment markers, not the original highlighted ranges.
// Anchor to their paragraph only when that paragraph maps to a unique clause.
export function readWordTree(document: WordNode) {
  const markers = new Map<string, string[]>();
  function walk(node: WordNode, paragraph: string) {
    const context =
      node.type === "paragraph" ? plainText(node).trim() : paragraph;
    if (node.type === "commentReference" && node.commentId) {
      markers.set(node.commentId, [
        ...(markers.get(node.commentId) || []),
        context,
      ]);
    }
    for (const child of node.children || []) walk(child, context);
  }
  walk(document, "");
  return {
    text: plainText(document),
    comments: (document.comments || []).map((comment) => ({
      id: comment.commentId,
      text: comment.body.map(plainText).join("").trim(),
      author: (comment.authorName || "Word reviewer").slice(0, 300),
      paragraph:
        markers.get(comment.commentId)?.length === 1
          ? markers.get(comment.commentId)![0]
          : "",
    })),
  };
}

export async function extractWord(arrayBuffer: ArrayBuffer) {
  const mammoth = await import("mammoth");
  let extracted: ReturnType<typeof readWordTree> | undefined;
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      includeEmbeddedStyleMap: false,
      externalFileAccess: false,
      // HTML is never rendered. Avoid decoding images that are not part of text review.
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      transformDocument: (document: WordNode) => {
        extracted = readWordTree(document);
        return document;
      },
    },
  );
  if (!extracted) throw new Error("Could not read the Word document.");
  return { ...extracted, unsupported: result.messages.length > 0 };
}

export function anchorWordComments(
  comments: ImportedComment[],
  clauses: Clause[],
) {
  const findings: Finding[] = [];
  for (const comment of comments) {
    const matches = clauses.filter((clause) =>
      containsQuote(clause.text, comment.paragraph),
    );
    if (
      matches.length !== 1 ||
      !comment.text ||
      comment.text.length > 6000 ||
      normalize(comment.paragraph).length > 5000 ||
      findings.length >= 1000
    )
      continue;
    const clause = matches[0];
    findings.push({
      id: `word-comment-${findings.length + 1}`,
      kind: "comment",
      origin: "reviewer",
      imported: true,
      author: comment.author,
      title: comment.text.split("\n")[0].slice(0, 100),
      explanation: comment.text,
      clauseId: clause.id,
      quote: normalize(comment.paragraph),
      related: [],
      sources: [],
      uncertainty: "",
      status: "open",
    });
  }
  return { findings, unplaced: comments.length - findings.length };
}
