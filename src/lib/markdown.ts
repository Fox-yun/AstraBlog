import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";
import { codeToHtml } from "shiki";

/**
 * A custom unified plugin to highlight code blocks using Shiki.
 * This runs after rehypeSanitize, ensuring that the generated style tags
 * and spans from Shiki are preserved while the input markdown is clean.
 */
function rehypeShikiPlugin() {
  return async (tree: any) => {
    async function walk(node: any) {
      if (node.type === "element" && node.tagName === "pre" && node.children) {
        const codeNode = node.children.find(
          (c: any) => c.type === "element" && c.tagName === "code"
        );
        if (codeNode && codeNode.children) {
          const codeText = codeNode.children
            .map((c: any) => (c.type === "text" ? c.value : ""))
            .join("");
          const classes = codeNode.properties?.className || [];
          const langClass = classes.find((c: string) => c.startsWith("language-"));
          const lang = langClass ? langClass.slice(9) : "text";

          try {
            // Highlight the code block using Shiki
            const highlightedHtml = await codeToHtml(codeText, {
              lang,
              theme: "github-dark", // Matches our bg-void (#09090b) theme
            });

            // Convert this pre node to a raw node containing the Shiki highlighted HTML
            node.type = "raw";
            node.value = highlightedHtml;
          } catch (e) {
            console.error("Shiki syntax highlight error:", e);
          }
          return;
        }
      }

      if (node.children) {
        for (const child of node.children) {
          await walk(child);
        }
      }
    }

    await walk(tree);
  };
}

/**
 * Compiles a markdown string to clean, sanitized HTML with Shiki code block highlight.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize) // Cleans HTML tags, inline event handlers, and javascript: links
    .use(rehypeShikiPlugin)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return file.toString();
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Injects id attributes to h2 and h3 elements in HTML and extracts a TOC manifest.
 */
export function addHeadingIdsAndExtractToc(html: string): {
  html: string;
  toc: TocItem[];
} {
  const toc: TocItem[] = [];
  const usedIds = new Map<string, number>();
  const headingRegex = /<(h2|h3)([^>]*)>(.*?)<\/\1>/gi;

  const modifiedHtml = html.replace(headingRegex, (match, tag, attrs, content) => {
    // Strip inner HTML tags from content for the ID
    const text = content.replace(/<[^>]*>/g, "").trim();
    // Create clean ID supporting letters, numbers, and Chinese/Unicode characters
    const baseId = text
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || `section-${toc.length + 1}`;
    const occurrence = usedIds.get(baseId) || 0;
    usedIds.set(baseId, occurrence + 1);
    const id = occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`;
    const cleanAttrs = attrs.replace(/\s+id=("[^"]*"|'[^']*')/i, "");

    toc.push({ id, text, level: tag === "h2" ? 2 : 3 });

    return `<${tag} id="${id}"${cleanAttrs}>${content}</${tag}>`;
  });

  return { html: modifiedHtml, toc };
}
