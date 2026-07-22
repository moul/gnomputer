import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__");

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));
}

export const FIXTURES = {
  status: readFixture("status.json"),
  qrender: readFixture("qrender.json"),
  qfile: readFixture("qfile.json"),
};
