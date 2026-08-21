import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
const publications = JSON.parse(await fs.readFile(path.join(root, "data/publications.json"), "utf8"));
const failures = [];

const requiredFields = ["title", "url", "conferenceGroup", "year", "contribution", "topics", "displayHtml"];
publications.forEach((paper, index) => {
  requiredFields.forEach((field) => {
    if (!(field in paper) || paper[field] === "") failures.push(`publication ${index + 1}: missing ${field}`);
  });
  if (!Array.isArray(paper.topics) || paper.topics.length === 0) failures.push(`publication ${index + 1}: topics must be non-empty array`);
});

const renderedCount = (html.match(/<li class="paper-item"/g) ?? []).length;
if (renderedCount !== publications.length) failures.push(`rendered publications ${renderedCount} != data ${publications.length}`);

for (const match of html.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^\"]+"[^>]*)>/gi)) {
  if (!/\btarget="_blank"/i.test(match[1])) failures.push(`external link lacks target=_blank: ${match[0].slice(0, 140)}`);
  const rel = match[1].match(/\brel="([^"]*)"/i)?.[1].split(/\s+/) ?? [];
  if (!rel.includes("noopener") || !rel.includes("noreferrer")) failures.push(`external link lacks rel: ${match[0].slice(0, 140)}`);
}

[
  'aria-controls="navbar-menu"',
  'aria-expanded="false"',
  'id="filter-status"',
  'aria-live="polite"',
  'id="clear-filters"',
  'property="og:image"',
  "PUBLICATIONS:START"
].forEach((token) => {
  if (!html.includes(token)) failures.push(`index.html missing ${token}`);
});

[
  "assets/vendor/aos/",
  "assets/vendor/animate.css/",
  "assets/vendor/boxicons/",
  "assets/vendor/glightbox/",
  "assets/vendor/isotope-layout/",
  "assets/vendor/php-email-form/",
  "assets/vendor/remixicon/",
  "assets/vendor/swiper/"
].forEach((token) => {
  if (html.includes(token)) failures.push(`unused dependency still loaded: ${token}`);
});

for (const relative of ["assets/img/og-card.png", "assets/img/favicon.png", "assets/img/apple-touch-icon.png", "robots.txt", "sitemap.xml"]) {
  try {
    await fs.access(path.join(root, relative));
  } catch {
    failures.push(`missing ${relative}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`site checks passed: ${publications.length} publications`);
}
