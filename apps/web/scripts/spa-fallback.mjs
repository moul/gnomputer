import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dist = path.join(fileURLToPath(new URL("..", import.meta.url)), "dist");
await copyFile(path.join(dist, "index.html"), path.join(dist, "404.html"));
