#!/usr/bin/env node
// data/team.json 을 dashboard.html 의 내장 스냅샷(FALLBACK)에 굽는다.
// 파일 fetch가 불가능한 환경(아티팩트 공유 등)에서도 최신 상태가 보이도록 동기화.
// 로컬 서버(npx serve)로 볼 땐 이 빌드 없이도 team.json 을 실시간으로 읽는다.
//
// 사용: node bin/build.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TEAM_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(TEAM_DIR, "data", "team.json");
const HTML = join(TEAM_DIR, "dashboard.html");

const json = readFileSync(DATA, "utf-8").trim();
JSON.parse(json); // validate

let html = readFileSync(HTML, "utf-8");
const START = "/*DATA_START*/";
const END = "/*DATA_END*/";
const i = html.indexOf(START);
const j = html.indexOf(END);
if (i === -1 || j === -1) {
  console.error("✗ dashboard.html 에서 DATA_START/DATA_END 마커를 찾지 못했습니다.");
  process.exit(1);
}

const compact = JSON.stringify(JSON.parse(json));
html = html.slice(0, i + START.length) + compact + html.slice(j);
writeFileSync(HTML, html, "utf-8");

console.log("✓ dashboard.html 내장 스냅샷을 data/team.json 으로 동기화했습니다.");
