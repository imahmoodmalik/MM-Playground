import { parseDocument } from "../shared/review";
import type { Finding, ReviewDocument } from "../shared/types";
import { anchorWordComments, extractWord } from "./word-import";
import type { ImportedComment } from "./word-import";

export async function extractText(
  file: File,
): Promise<{ text: string; warnings: string[]; comments: ImportedComment[] }> {
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose a document smaller than 12 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const warnings: string[] = [];
  let text = "";
  let comments: ImportedComment[] = [];
  if (extension === "txt" || extension === "md") text = await file.text();
  else if (extension === "docx") {
    const result = await extractWord(await file.arrayBuffer());
    text = result.text;
    comments = result.comments;
    warnings.push(
      "Text view: formatting, automatic numbering and tracked changes may not be preserved. Word comments attach to the paragraph containing their marker, not the original highlighted range.",
    );
    if (result.unsupported)
      warnings.push(
        "The document converter reported unsupported content. Check the original for omitted material.",
      );
  } else if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const document = await task.promise;
    try {
      if (document.numPages > 150)
        throw new Error("This version supports PDFs of up to 150 pages.");
      const pages: string[] = [];
      let emptyPages = 0;
      for (let index = 1; index <= document.numPages; index++) {
        const page = await document.getPage(index);
        const content = await page.getTextContent();
        const lines: string[] = [];
        let line = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          line += item.str + " ";
          if (item.hasEOL) {
            lines.push(line.trim());
            line = "";
          }
        }
        if (line.trim()) lines.push(line.trim());
        const pageText = lines.join("\n");
        if (pageText.trim().length < 20) emptyPages++;
        pages.push(pageText);
        if (pages.reduce((sum, value) => sum + value.length, 0) > 250000)
          throw new Error(
            "This document is too long. Upload a smaller section.",
          );
      }
      text = pages.join("\n\n");
      warnings.push(
        "Extracted text view: PDF columns, tables and numbering may be reordered. Verify against the original.",
      );
      if (emptyPages)
        warnings.push(
          `${emptyPages} page(s) contained little or no readable text. Scanned text and images are not reviewed; OCR is not available in this version.`,
        );
    } finally {
      await task.destroy();
    }
  } else throw new Error("Use a PDF, DOCX, TXT or Markdown document.");
  if (text.trim().length < 30)
    throw new Error(
      "No usable text was found. For a scanned PDF, upload a searchable copy or paste the text.",
    );
  if (text.length > 250000)
    throw new Error("This document is too long. Upload a smaller section.");
  return { text, warnings, comments };
}

export async function importDocument(
  file: File,
): Promise<{ document: ReviewDocument; comments: Finding[] }> {
  const { text, warnings, comments } = await extractText(file);
  const clauses = parseDocument(text);
  if (!clauses.length || clauses.length > 1000)
    throw new Error(
      "Could not create a usable document outline. Try a smaller document or paste the text.",
    );
  if (clauses.every((clause) => clause.label.startsWith("P")))
    warnings.push(
      "No numbered clauses were detected. Paragraph labels are provided for navigation; numbered reference checks are limited.",
    );
  const imported = anchorWordComments(comments, clauses);
  if (imported.unplaced)
    warnings.push(
      `${imported.unplaced} Word comment(s) could not be placed reliably and were not imported. Check them in the original.`,
    );
  return {
    document: {
      name: file.name.replace(/\.[^.]+$/, ""),
      clauses,
      warnings,
      isExample: false,
    },
    comments: imported.findings,
  };
}
