#!/usr/bin/env node
// 직원이 작업 완료를 팀 상태 파일(data/team.json)에 기록하는 CLI.
// 대시보드는 이 파일을 3초마다 읽으므로, 기록 즉시 화면에 반영됩니다.
//
// 사용 예:
//   node bin/log-work.mjs --role product-marketing --status good \
//     --output "product-marketing.md 확정" --metric "12개 섹션 완료" --pipe good
//
// 옵션:
//   --role   <code>   직원 스킬 코드 (필수) 예: copywriting, video, product-selection
//   --status <s>      good | warn | idle  (직원 상태 배지)
//   --label  <text>   상태 라벨 (생략 시 good=완료 / warn=진행중 / idle=대기)
//   --output <text>   최근 산출물 텍스트
//   --metric <text>   지표 텍스트
//   --pipe   <s>      해당 단계 파이프라인 상태도 함께 갱신 (good|warn|idle)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TEAM_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(TEAM_DIR, "data", "team.json");

const CODE_TO_PIPE = {
  "product-marketing": "전략 기획",
  "product-discovery": "상품 발굴",
  "product-selection": "우수상품 선정",
  "copywriting": "카피",
  "ad-creative": "광고",
  "image": "이미지",
  "video": "영상",
  "review-management": "리뷰 관리",
  "customer-support": "CS 응대",
};
const LABELS = { good: "완료", warn: "진행중", idle: "대기" };
const PIPE_LABELS = { good: "완료", warn: "진행중", idle: "대기 · 초안" };

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    if (k) a[k] = argv[i + 1];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args.role) {
  console.error("✗ --role <스킬코드> 는 필수입니다. 예: --role copywriting");
  process.exit(1);
}

const data = JSON.parse(readFileSync(FILE, "utf-8"));
const emp = data.employees.find((e) => e.code === args.role);
if (!emp) {
  console.error(`✗ '${args.role}' 직원을 찾을 수 없습니다. 가능한 코드: ${data.employees.map((e) => e.code).join(", ")}`);
  process.exit(1);
}

if (args.status) {
  if (!LABELS[args.status]) { console.error("✗ --status 는 good|warn|idle"); process.exit(1); }
  emp.status = args.status;
  emp.statusLabel = args.label || LABELS[args.status];
} else if (args.label) {
  emp.statusLabel = args.label;
}
if (args.output) emp.output = args.output;
if (args.metric) emp.metric = args.metric;

if (args.pipe) {
  const title = CODE_TO_PIPE[args.role];
  const step = data.pipeline.find((p) => p.t === title);
  if (step) { step.s = args.pipe; step.sl = PIPE_LABELS[args.pipe] || LABELS[args.pipe]; }
}

data.updatedISO = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");

console.log(`✓ [${emp.role}] 기록 완료 — 상태: ${emp.statusLabel}${args.output ? ` · 산출물: ${emp.output}` : ""}`);
console.log(`  → data/team.json 갱신됨. 대시보드가 자동 반영합니다.`);
