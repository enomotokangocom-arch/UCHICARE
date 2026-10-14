// 人と組織の幸せプロジェクト：HTML原稿からPDFを生成する
// 使い方: npm install && node build.mjs
// Chromium の場所は環境変数 CHROMIUM_PATH で指定可能
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'output');
fs.mkdirSync(outDir, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));

const jobs = [
  { src: 'src/plan.html', out: '01_企画書_本文.pdf' },
  { src: 'src/worksheets.html', out: '02_付録_記入用ワークシート.pdf' },
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});
let problems = 0;
for (const job of jobs) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(here, job.src)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // はみ出しチェック：各ページの中身が枠に収まっているか
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => {
    const pad = parseFloat(getComputedStyle(p).paddingBottom);
    const limit = p.getBoundingClientRect().bottom - (p.querySelector('.pf') ? pad - 2 : 0);
    let maxBottom = 0;
    p.querySelectorAll(':scope > *:not(.pf):not(svg.bg)').forEach(el => { maxBottom = Math.max(maxBottom, el.getBoundingClientRect().bottom); });
    return { page: i + 1, over: Math.round(maxBottom - limit) };
  }).filter(r => r.over > 0));
  if (overflow.length) { problems += overflow.length; console.warn(`[${job.src}] overflow:`, overflow); }
  await page.pdf({ path: path.join(outDir, job.out), preferCSSPageSize: true, printBackground: true });
  console.log('wrote', job.out);
  await page.close();
}
await browser.close();

// 本文と付録をまとめた1冊版も作る（pypdf があれば）
import { execFileSync } from 'node:child_process';
try {
  execFileSync('python3', ['-c', `
import sys, pypdf
w = pypdf.PdfWriter()
for f in sys.argv[1:3]: w.append(f)
w.write(sys.argv[3])`, path.join(outDir, jobs[0].out), path.join(outDir, jobs[1].out), path.join(outDir, '00_企画書_本文＋付録_一冊版.pdf')]);
  console.log('wrote 00_企画書_本文＋付録_一冊版.pdf');
} catch (e) { console.warn('一冊版の結合をスキップしました（python3 + pypdf が必要）'); }
if (problems) { console.error(`${problems} page(s) overflow`); process.exitCode = 1; }
