import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const manifest = fs.readFileSync(new URL("./manifest.webmanifest", import.meta.url), "utf8");

const officialColors = ["#059669", "#065F46", "#1F2937", "#6B7280", "#F3F4F6", "#FFFFFF"];

test("usa a paleta oficial da identidade aprovada", () => {
  for (const color of officialColors) {
    assert.match(css.toUpperCase(), new RegExp(color.toUpperCase()));
  }
});

test("usa Poppins e o logotipo aprovado", () => {
  assert.match(html, /family=Poppins/);
  assert.match(html, /\/logo-mark\.png/);
  assert.ok(fs.existsSync(new URL("./logo-mark.png", import.meta.url)));
});

test("manifesto usa ícones existentes na raiz", () => {
  assert.match(manifest, /\/icon-192\.png/);
  assert.match(manifest, /\/icon-512\.png/);
  assert.ok(fs.existsSync(new URL("./icon-192.png", import.meta.url)));
  assert.ok(fs.existsSync(new URL("./icon-512.png", import.meta.url)));
});
