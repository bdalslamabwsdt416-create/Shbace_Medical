import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = new URL("../src/index.ts", import.meta.url);
const adminPath = new URL("../admin/index.html", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const admin = readFileSync(adminPath, "utf8");
const marker = /const ADMIN_HTML = [\\s\\S]*?;\\n/;
if (!marker.test(source)) throw new Error("ADMIN_HTML marker was not found in src/index.ts");
const next = source.replace(marker, "const ADMIN_HTML = " + JSON.stringify(admin) + ";\\n");
writeFileSync(sourcePath, next);
console.log("Embedded admin page synchronized.");
