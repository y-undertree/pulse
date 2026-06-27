import { chmodSync } from "node:fs";

chmodSync("build/src/bin.js", 0o755);
