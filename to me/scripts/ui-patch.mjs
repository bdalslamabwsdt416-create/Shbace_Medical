// Applies the 1.3.10-to-me.16 UI cleanup to the sources right before the PWA build.
// Data lives in ui-patch.json (text replacements) and nelson-cover.b64 (cover image).
// Idempotent: a replacement that is already applied is skipped; an anchor that matches nothing stops the build.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const data = JSON.parse(readFileSync(join(here, "ui-patch.json"), "utf8"));

let imageOk = false;
try {
  const bytes = Buffer.from(readFileSync(join(here, "nelson-cover.b64"), "utf8").trim(), "base64");
  if (createHash("sha256").update(bytes).digest("hex") === data.sha) {
    writeFileSync(join(root, "assets/img/nelson-textbook-cover.webp"), bytes);
    imageOk = true;
  } else console.warn("ui-patch: cover image hash mismatch, keeping the existing cover");
} catch (e) { console.warn("ui-patch: cover image skipped:", e.message); }

for (const [file, pairs] of Object.entries(data.patches)) {
  const path = join(root, file);
  let text = readFileSync(path, "utf8");
  for (const [oldText, newText] of pairs) {
    if (!imageOk && newText.includes("nelson-textbook-cover.webp")) continue;
    if (oldText === "") { if (!text.includes(newText)) text += newText; continue; }
    if (text.includes(newText)) continue;
    const n = text.split(oldText).length - 1;
    if (n !== 1) { console.error(`ui-patch: anchor matched ${n} times in ${file}: ${oldText.slice(0, 80)}`); process.exit(1); }
    text = text.replace(oldText, () => newText);
  }
  writeFileSync(path, text);
}

/* Urology questions now belong to Nephrology */
for (let i = 1; i <= 7; i++) {
  const path = join(root, `data/nelson/nelson-textbook-bank-0${i}.js`);
  if (existsSync(path)) writeFileSync(path, readFileSync(path, "utf8").split('"spec":"urology"').join('"spec":"nephrology"'));
}
if (imageOk) rmSync(join(root, "assets/img/nelson-textbook-cover.svg"), { force: true });
console.log("ui-patch applied" + (imageOk ? "" : " (without the new cover image)"));
