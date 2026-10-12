const fs = require("node:fs");
const path = require("node:path");
for (const name of ["dist", "build"]) {
  const target = path.resolve(__dirname, "..", name);
  fs.rmSync(target, { recursive: true, force: true });
}
