import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_SEQUENCE_DURATION, reducedMotionTransform } from "@/lib/book/timeline";

function sourceFiles(directory: string): string[] { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]); }

describe("cinematic demo constraints", () => {
  it("fits the untouched sequence under nine seconds", () => expect(DEMO_SEQUENCE_DURATION).toBeLessThan(9000));
  it("removes transforms for reduced motion", () => expect(reducedMotionTransform(true)).toBe("none"));
  it("contains no emoji artwork or hardcoded money in book components", () => {
    const root = join(process.cwd(), "components/book");
    const source = existsSync(root) ? sourceFiles(root).filter((file) => file.endsWith(".tsx")).map((file) => readFileSync(file, "utf8")).join("\n") : "";
    expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(source).not.toMatch(/[₹$]\s*\d/);
  });
});
