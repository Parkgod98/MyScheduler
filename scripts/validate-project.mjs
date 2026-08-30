import fs from "node:fs";

const required = [
  "AGENTS.md",
  "docs/product-brief.md",
  "docs/architecture.md",
  "docs/git-conventions.md",
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "public/manifest.webmanifest",
  "public/sw.js",
  ".github/workflows/ci.yml",
];

const errors = [];
for (const file of required) if (!fs.existsSync(file)) errors.push(`필수 파일 누락: ${file}`);

for (const secret of [".env", ".env.local", "service-role.json"]) {
  if (fs.existsSync(secret)) errors.push(`민감 파일이 저장소에 존재함: ${secret}`);
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const script of ["validate", "lint", "typecheck", "build"]) {
  if (!pkg.scripts?.[script]) errors.push(`package.json script 누락: ${script}`);
}

if (errors.length) {
  console.error("Harness validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("Harness validation passed.");
