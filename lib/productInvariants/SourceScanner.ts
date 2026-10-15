import fs from "fs";
import path from "path";

export interface ScannedSource {
  /** Repo-relative path with forward slashes. */
  file: string;
  /** Source with comments removed (strings left intact). */
  code: string;
  /** Every string literal and JSX text run: what a user could end up reading. */
  copy: string[];
}

/**
 * Reads source files so product-invariant tests can assert on what the app
 * says and which design tokens it uses. A small hand-rolled tokenizer rather
 * than a TypeScript parse: it only has to tell comments, strings and
 * everything else apart, and staying dependency-free keeps these tests fast.
 */
export class SourceScanner {
  private static readonly SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "generated"]);

  constructor(private readonly root: string = process.cwd()) {}

  /** All files under the given repo-relative folders with one of the extensions, tests excluded. */
  list(folders: string[], extensions: string[]): string[] {
    const out: string[] = [];
    for (const folder of folders) this.walk(path.join(this.root, folder), extensions, out);
    return out.map((f) => path.relative(this.root, f).split(path.sep).join("/")).sort();
  }

  scan(file: string): ScannedSource {
    const raw = fs.readFileSync(path.join(this.root, file), "utf8");
    const { code, strings } = SourceScanner.tokenize(raw);
    const jsxText = file.endsWith(".tsx") ? SourceScanner.jsxText(code) : [];
    // Module specifiers and asset paths ("@/components/drink/beer-glass-icon")
    // are not copy a user reads.
    const readable = strings.filter((s) => !/^[@\w./-]*\/[\w./-]*$/.test(s));
    return { file, code, copy: [...readable, ...jsxText] };
  }

  raw(file: string): string {
    return fs.readFileSync(path.join(this.root, file), "utf8");
  }

  private walk(dir: string, extensions: string[], out: string[]): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SourceScanner.SKIP_DIRS.has(entry.name)) this.walk(path.join(dir, entry.name), extensions, out);
      } else if (extensions.some((e) => entry.name.endsWith(e)) && !/\.test\.[tj]sx?$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
  }

  private static tokenize(src: string): { code: string; strings: string[] } {
    let code = "";
    const strings: string[] = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i]!;
      const next = src[i + 1];
      if (c === "/" && next === "/") {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (c === "/" && next === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end === -1 ? src.length : end + 2;
      } else if (c === '"' || c === "'" || c === "`") {
        let j = i + 1;
        while (j < src.length && src[j] !== c) {
          if (src[j] === "\\") j++;
          // A newline ends a quote-delimited string: it was really an
          // apostrophe or a regex, not a literal.
          if (c !== "`" && src[j] === "\n") break;
          j++;
        }
        strings.push(src.slice(i + 1, j));
        code += src.slice(i, j + 1);
        i = j + 1;
      } else {
        code += c;
        i++;
      }
    }
    return { code, strings };
  }

  private static jsxText(code: string): string[] {
    const out: string[] = [];
    for (const m of code.matchAll(/>([^<>{}=;\n]*[A-Za-z][^<>{}=;\n]*)</g)) out.push(m[1]!.trim());
    return out;
  }
}
