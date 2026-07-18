import { expect, test } from "vitest";
import { markdownToHtml, addHeadingIdsAndExtractToc } from "./markdown";

test("compiles basic markdown to semantic html", async () => {
  const html = await markdownToHtml("# Title Heading\nThis is a paragraph with **bold** text.");
  expect(html).toContain("<h1>Title Heading</h1>");
  expect(html).toContain("<p>This is a paragraph with <strong>bold</strong> text.</p>");
});

test("sanitizes dangerous raw html script tags", async () => {
  const html = await markdownToHtml("Unsafe <script>alert('XSS')</script> text.");
  expect(html).not.toContain("<script>");
  expect(html).toContain("alert('XSS')");
});

test("sanitizes dangerous inline event attributes", async () => {
  const html = await markdownToHtml('<img src="x" onerror="alert(1)">');
  expect(html).not.toContain("onerror");
});

test("sanitizes javascript: protocol hyperlinks", async () => {
  const html = await markdownToHtml("[Link](javascript:alert(1))");
  expect(html).not.toContain("href=\"javascript:");
});

test("extracts headers TOC and generates case-insensitive slug IDs", () => {
  const htmlInput = "<h2>Hello World</h2>\n<h3>Child Heading Details</h3>";
  const { html: modifiedHtml, toc } = addHeadingIdsAndExtractToc(htmlInput);

  expect(modifiedHtml).toContain('<h2 id="hello-world">Hello World</h2>');
  expect(modifiedHtml).toContain('<h3 id="child-heading-details">Child Heading Details</h3>');

  expect(toc).toHaveLength(2);
  expect(toc[0]).toEqual({
    id: "hello-world",
    text: "Hello World",
    level: 2,
  });
  expect(toc[1]).toEqual({
    id: "child-heading-details",
    text: "Child Heading Details",
    level: 3,
  });
});

test("keeps duplicate heading ids unique", () => {
  const result = addHeadingIdsAndExtractToc("<h2>Overview</h2><h3>Overview</h3>");

  expect(result.toc.map((item) => item.id)).toEqual(["overview", "overview-2"]);
  expect(result.html).toContain('id="overview-2"');
});
