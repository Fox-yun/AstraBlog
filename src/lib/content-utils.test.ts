import { describe, expect, it } from "vitest";
import {
  escapeXml,
  estimateReadingMinutes,
  normalizeSlug,
  plainTextExcerpt,
  toPositiveInteger,
} from "./content-utils";

describe("content utilities", () => {
  it("normalizes multilingual slugs without dropping word boundaries", () => {
    expect(normalizeSlug("  Hello, 可复用 Blog!  ")).toBe("hello-可复用-blog");
  });

  it("estimates both latin and CJK reading time", () => {
    expect(estimateReadingMinutes("word ".repeat(201))).toBe(2);
    expect(estimateReadingMinutes("文".repeat(401))).toBe(2);
  });

  it("creates plain excerpts and escapes XML", () => {
    expect(plainTextExcerpt("# Title\n\n[Read](https://example.com)", 20)).toBe("Title Read");
    expect(escapeXml("A & <B>")).toBe("A &amp; &lt;B&gt;");
  });

  it("parses positive pagination values safely", () => {
    expect(toPositiveInteger("3")).toBe(3);
    expect(toPositiveInteger("-1", 2)).toBe(2);
    expect(toPositiveInteger(["4", "5"])).toBe(4);
  });
});
