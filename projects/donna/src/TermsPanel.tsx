import { useState } from "react";
import {
  categorizeClauses,
  termCategories,
  textDirection,
} from "../shared/terms";
import type { Clause } from "../shared/types";

export function TermsPanel({
  clauses,
  onPick,
}: {
  clauses: Clause[];
  onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState("all");
  const passages = categorizeClauses(clauses);
  const classified = new Set(passages.map((passage) => passage.clauseId));
  const categories = termCategories.filter((category) =>
    passages.some((passage) => passage.categoryId === category.id),
  );
  const unclassified = clauses.filter((clause) => !classified.has(clause.id));
  const visible = clauses.filter(
    (clause) =>
      selected === "all" ||
      (selected === "other"
        ? !classified.has(clause.id)
        : passages.some(
            (passage) =>
              passage.clauseId === clause.id && passage.categoryId === selected,
          )),
  );
  return (
    <div className="cw-terms-panel">
      <h2>
        Agreement terms{" "}
        <span lang="ar" dir="rtl">
          بنود الاتفاقية
        </span>
      </h2>
      <p>
        {classified.size} of {clauses.length} sections categorized from their
        wording.
      </p>
      <nav aria-label="Term categories" className="cw-term-categories">
        <button
          aria-pressed={selected === "all"}
          onClick={() => setSelected("all")}
        >
          All sections <span>{clauses.length}</span>
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            aria-pressed={selected === category.id}
            onClick={() => setSelected(category.id)}
          >
            <span>
              {category.en}
              <small lang="ar" dir="rtl">
                {category.ar}
              </small>
            </span>
            <span>
              {
                passages.filter((passage) => passage.categoryId === category.id)
                  .length
              }
            </span>
          </button>
        ))}
        {unclassified.length > 0 && (
          <button
            aria-pressed={selected === "other"}
            onClick={() => setSelected("other")}
          >
            Other / uncategorized <span>{unclassified.length}</span>
          </button>
        )}
      </nav>
      <div className="cw-term-passages">
        {visible.map((clause) => {
          const matches = passages.filter(
            (passage) =>
              passage.clauseId === clause.id &&
              (selected === "all" || passage.categoryId === selected),
          );
          return (
            <button
              key={clause.id}
              className="cw-term-passage"
              onClick={() => onPick(clause.id)}
            >
              <strong dir={textDirection(clause.title)}>
                § {clause.label} · {clause.title}
              </strong>
              {matches.length > 0 && (
                <span className="cw-term-labels">
                  {matches
                    .map(
                      (passage) =>
                        termCategories.find(
                          (category) => category.id === passage.categoryId,
                        )!.en,
                    )
                    .join(" · ")}
                </span>
              )}
              <blockquote dir={textDirection(matches[0]?.quote || clause.text)}>
                {matches[0]?.quote || clause.text.slice(0, 250)}
              </blockquote>
            </button>
          );
        })}
      </div>
    </div>
  );
}
