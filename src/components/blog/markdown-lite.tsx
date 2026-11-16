import type { ReactNode } from "react";

/*
 * Dependency-free renderer for the small, trusted markdown subset used by
 * blog `content_md` (DATABASE_SCHEMA.md §3.7): #/##/### headings, blank-line
 * paragraphs, "- " bullets, "1." ordered items, and "> " quotes.
 *
 * Security: content is parsed into React elements — NO dangerouslySetInnerHTML,
 * no raw HTML passthrough, so markup in posts can never inject scripts
 * (SECURITY.md §10). Inline markdown (links, bold) renders as plain text in
 * MVP — a conscious limitation, not a silent failure.
 */

function renderLines(lines: string[]): ReactNode {
  return lines.map((line, i) => <p key={i}>{line || "​"}</p>);
}

export function MarkdownLite({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(
        <p key={`p${blocks.length}`} className="leading-relaxed">
          {renderLines(paragraph)}
        </p>
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item, i) => <li key={i}>{item}</li>);
      blocks.push(
        list.ordered ? (
          <ol
            key={`l${blocks.length}`}
            className="list-decimal space-y-1 pl-5"
          >
            {items}
          </ol>
        ) : (
          <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        )
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push(
        <blockquote
          key={`q${blocks.length}`}
          className="border-brand-600 border-l-4 pl-4 italic"
        >
          {renderLines(quote)}
        </blockquote>
      );
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level === 1
          ? "text-2xl font-bold tracking-tight"
          : level === 2
            ? "text-xl font-bold tracking-tight"
            : "text-lg font-semibold";
      blocks.push(
        level === 1 ? (
          <h2 key={`h${blocks.length}`} className={cls}>
            {text}
          </h2>
        ) : level === 2 ? (
          <h3 key={`h${blocks.length}`} className={cls}>
            {text}
          </h3>
        ) : (
          <h4 key={`h${blocks.length}`} className={cls}>
            {text}
          </h4>
        )
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line.trim());
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line.trim());
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();

  return <div className="space-y-4">{blocks}</div>;
}
