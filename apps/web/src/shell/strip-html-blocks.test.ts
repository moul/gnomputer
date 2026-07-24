import { describe, it, expect } from "vitest";
import { stripHtmlBlocks } from "./strip-html-blocks";

describe("stripHtmlBlocks", () => {
  it("drops a block that is itself raw HTML", () => {
    const result = stripHtmlBlocks('<div align="center"><img src="./x.png" /></div>\n\n# Heading');
    expect(result).toBe("# Heading");
  });

  it("leaves ordinary markdown untouched", () => {
    const input = "# Heading\n\nSome **bold** text.\n\n- one\n- two";
    expect(stripHtmlBlocks(input)).toBe(input);
  });

  it("drops multiple HTML blocks scattered through the document", () => {
    const result = stripHtmlBlocks("<img src=\"a.png\" />\n\n# Title\n\n<br />\n\nBody text.");
    expect(result).toBe("# Title\n\nBody text.");
  });
});
