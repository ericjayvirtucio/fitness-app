#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const [
  junitPath,
  textPath,
  jsonPath,
  suite,
  platform,
  device,
  artifactDirectory,
] = process.argv.slice(2);

if (
  !junitPath ||
  !textPath ||
  !jsonPath ||
  !suite ||
  !platform ||
  !device ||
  !artifactDirectory
) {
  fail(
    'Expected JUnit, text, JSON, suite, platform, device, and artifact paths.',
  );
}

let xml;
try {
  xml = readFileSync(junitPath, 'utf8');
} catch {
  fail(`JUnit report is missing: ${junitPath}`);
}

const scenarios = parseTestCases(xml);
if (scenarios.length === 0) fail('JUnit report contains no testcases.');

const totals = {
  errors: scenarios.filter(({ status }) => status === 'error').length,
  failed: scenarios.filter(({ status }) => status === 'failed').length,
  passed: scenarios.filter(({ status }) => status === 'passed').length,
  skipped: scenarios.filter(({ status }) => status === 'skipped').length,
  total: scenarios.length,
};
const report = {
  artifactDirectory,
  device,
  platform,
  result: totals.failed + totals.errors === 0 ? 'passed' : 'failed',
  scenarios,
  suite,
  totals,
};
const output = formatReport(report);
writeFileSync(textPath, `${output}\n`, 'utf8');
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${output}\n`);
if (report.result === 'failed') process.exitCode = 1;

function parseTestCases(value) {
  const matches = value.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  );
  return [...matches].map((match) => {
    const attributes = parseAttributes(match[1] ?? '');
    const body = match[2] ?? '';
    const failure = extractElement(body, 'failure');
    const error = extractElement(body, 'error');
    const isSkipped =
      /<skipped\b/.test(body) || attributes.status === 'SKIPPED';
    const status = error
      ? 'error'
      : failure
        ? 'failed'
        : isSkipped
          ? 'skipped'
          : attributes.status === 'SUCCESS' || attributes.status === undefined
            ? 'passed'
            : 'error';
    const detail = error?.message ?? failure?.message;
    return {
      durationSeconds: numberAttribute(attributes.time),
      ...(detail ? { failureMessage: normalizeDetail(detail) } : {}),
      name: attributes.name ?? attributes.id ?? 'Unnamed scenario',
      sourceFile: attributes.file ?? null,
      status,
    };
  });
}

function parseAttributes(value) {
  return Object.fromEntries(
    [...value.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)].map((match) => [
      match[1],
      decodeXml(match[2] ?? ''),
    ]),
  );
}

function extractElement(body, name) {
  const match = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}>`).exec(
    body,
  );
  const selfClosing = new RegExp(`<${name}\\b([^>]*)\\/>`).exec(body);
  if (!match && !selfClosing) return null;
  const attributes = parseAttributes(match?.[1] ?? selfClosing?.[1] ?? '');
  return {
    message: attributes.message ?? decodeXml(stripCdata(match?.[2] ?? '')),
  };
}

function numberAttribute(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeDetail(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeXml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function formatReport(report) {
  const lines = ['Scenario results'];
  for (const scenario of report.scenarios) {
    const label = {
      error: 'ERROR',
      failed: 'FAIL',
      passed: 'PASS',
      skipped: 'SKIP',
    }[scenario.status];
    lines.push(
      `${label.padEnd(5)} ${scenario.name} (${scenario.durationSeconds.toFixed(1)}s)`,
    );
    if (scenario.failureMessage) lines.push(`      ${scenario.failureMessage}`);
    if (scenario.status !== 'passed' && scenario.sourceFile)
      lines.push(`      Source: ${scenario.sourceFile}`);
  }
  lines.push('');
  lines.push(
    `Scenarios: ${report.totals.passed} passed, ${report.totals.failed} failed, ${report.totals.errors} errors, ${report.totals.skipped} skipped, ${report.totals.total} total`,
  );
  lines.push(`Evidence: ${report.artifactDirectory}`);
  return lines.join('\n');
}

function fail(message) {
  process.stderr.write(`QA report error: ${message}\n`);
  process.exit(65);
}
