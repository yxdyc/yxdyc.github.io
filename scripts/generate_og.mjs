import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "assets", "img", "og-card.svg");
const svg = await fs.readFile(svgPath);

await sharp(svg).png().toFile(path.join(root, "assets", "img", "og-card.png"));
await sharp(svg).resize(96, 96, { fit: "cover" }).png().toFile(path.join(root, "assets", "img", "favicon.png"));
await sharp(svg).resize(180, 180, { fit: "cover" }).png().toFile(path.join(root, "assets", "img", "apple-touch-icon.png"));
console.log("Generated og-card.png and favicon assets");
