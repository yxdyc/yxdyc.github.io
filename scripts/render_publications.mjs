import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const indexPath = path.join(rootDir, "index.html");
const dataPath = path.join(rootDir, "data", "publications.json");
const START = "<!-- PUBLICATIONS:START - generated from data/publications.json -->";
const END = "<!-- PUBLICATIONS:END -->";
const execFileAsync = promisify(execFile);

function attr(openingTag, name) {
  return openingTag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ?? "";
}

function stripTags(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPublications(html) {
  const listStart = html.indexOf('<ul id="paper-list" class="group-container">');
  if (listStart < 0) throw new Error("paper-list not found");
  const contentStart = html.indexOf(">", listStart) + 1;
  const sectionEnd = html.indexOf("<!-- ======= Experience Section", contentStart);
  if (sectionEnd < 0) throw new Error("research section end not found");
  const section = html.slice(contentStart, sectionEnd);
  const starts = [...section.matchAll(/<li\s+class="paper-item"/gi)].map((match) => contentStart + match.index);
  const items = [];
  starts.forEach((itemStart, index) => {
      const boundary = starts[index + 1] ?? sectionEnd;
      const chunk = html.slice(itemStart, boundary);
      const itemEnd = chunk.lastIndexOf("</li>");
      if (itemEnd < 0) throw new Error(`publication ${index + 1} closing tag not found`);
      const itemHtml = chunk.slice(0, itemEnd + 5);
      const openingTag = itemHtml.match(/^<li\b[^>]*>/i)?.[0];
      if (!openingTag) throw new Error("publication opening tag not found");
      const body = itemHtml.slice(openingTag.length, itemHtml.lastIndexOf("</li>"));
      const link = body.match(/<a\b[^>]*href="([^"]+)"/i)?.[1] ?? "";
      const titleHtml = body.match(/<a\b[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/a>/i)?.[1] ?? "";
      const conference = attr(openingTag, "data-conference");
      items.push({
        title: stripTags(titleHtml),
        url: link,
        conferenceGroup: conference === "IJCV" ? "TPAMI, CVPR, IJCV" : conference,
        year: Number(attr(openingTag, "data-year")),
        contribution: attr(openingTag, "data-authors"),
        topics: attr(openingTag, "data-tags").split(",").filter(Boolean),
        displayHtml: body.trim()
      });
  });

  if (items.length === 0) throw new Error("no publications extracted");
  return items;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function render(items) {
  return items.map((item) => [
    "          <li class=\"paper-item\"",
    `            data-conference="${escapeAttribute(item.conferenceGroup)}"`,
    `            data-year="${escapeAttribute(item.year)}"`,
    `            data-authors="${escapeAttribute(item.contribution)}"`,
    `            data-senior-author="${item.seniorAuthorship ? "true" : "false"}"`,
    `            data-title="${escapeAttribute(item.title)}"`,
    `            data-tags="${escapeAttribute(item.topics.join(","))}">`,
    item.displayHtml.split("\n").map((line) => `            ${line.trimEnd()}`).join("\n"),
    "          </li>"
  ].join("\n")).join("\n\n");
}

function normalizeExternalLinks(html) {
  return html.replace(/<a\b([^>]*\bhref="https?:\/\/[^\"]+"[^>]*)>/gi, (full, attrs) => {
    let next = attrs;
    if (!/\btarget=/i.test(next)) next += ' target="_blank"';
    if (/\brel="([^"]*)"/i.test(next)) {
      next = next.replace(/\brel="([^"]*)"/i, (_, value) => {
        const tokens = new Set(value.split(/\s+/).filter(Boolean));
        tokens.add("noopener");
        tokens.add("noreferrer");
        return `rel="${[...tokens].join(" ")}"`;
      });
    } else {
      next += ' rel="noopener noreferrer"';
    }
    return `<a${next}>`;
  });
}

async function main() {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  let html = await fs.readFile(indexPath, "utf8");

  if (process.argv.includes("--init")) {
    const items = extractPublications(html);
    await fs.writeFile(dataPath, `${JSON.stringify(items, null, 2)}\n`);
  }

  if (process.argv.includes("--recover")) {
    const rawCurrentItems = JSON.parse(await fs.readFile(dataPath, "utf8"));
    const hasUpdatedHumanVBench = rawCurrentItems.some((item) => item.title.startsWith("HumanVBench: Probing"));
    const currentItems = rawCurrentItems.filter((item) => !(
      hasUpdatedHumanVBench && item.title.startsWith("HumanVBench: Exploring")
    ));
    const { stdout: headHtml } = await execFileAsync("git", ["show", "HEAD:index.html"], { cwd: rootDir, maxBuffer: 2_000_000 });
    const originalItems = extractPublications(headHtml);
    const merged = new Map(originalItems.map((item) => [item.title, item]));
    if (hasUpdatedHumanVBench) {
      merged.delete("HumanVBench: Exploring Human-Centric Video Understanding Capabilities of MLLMs with Synthetic Benchmark Data");
    }
    currentItems.forEach((item) => merged.set(item.title, item));
    const recovered = [...merged.values()].map((item) => ({
      ...item,
      conferenceGroup: ["IJCV", "TPAMI, CVPR"].includes(item.conferenceGroup) ? "TPAMI, CVPR, IJCV" : item.conferenceGroup
    }));
    await fs.writeFile(dataPath, `${JSON.stringify(recovered, null, 2)}\n`);
  }

  const items = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const listStart = html.indexOf('<ul id="paper-list" class="group-container">');
  if (listStart < 0) throw new Error("paper-list not found");
  const contentStart = html.indexOf(">", listStart) + 1;
  const sectionEnd = html.indexOf("<!-- ======= Experience Section", contentStart);
  const contentEnd = html.lastIndexOf("</ul>", sectionEnd);
  if (sectionEnd < 0 || contentEnd < contentStart) throw new Error("paper-list closing tag not found");
  html = `${html.slice(0, contentStart)}\n        ${START}\n${render(items)}\n        ${END}\n        ${html.slice(contentEnd)}`;

  html = normalizeExternalLinks(html);
  await fs.writeFile(indexPath, html);
  console.log(`Rendered ${items.length} publications from ${path.relative(rootDir, dataPath)}`);
}

await main();
