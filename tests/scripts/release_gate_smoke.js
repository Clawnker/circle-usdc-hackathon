#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet';
const API_KEY = process.env.API_KEY || 'demo-key';
const LATENCY_BUDGET_MS = Number(process.env.LATENCY_BUDGET_MS || 2500);

const CASES = [
  { name: 'routing-social', prompt: 'What tokens are people talking about on Base today?', expected: ['aura'] },
  { name: 'routing-payment', prompt: 'Approve 25 USDC for router spending', expected: ['bankr', 'multi-hop'] },
  { name: 'readability', prompt: 'Summarize Base ecosystem opportunities in bullet points for this week', expected: ['general', 'scribe', 'multi-hop'] },
];

async function postJson(url, body) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, latencyMs, json, text };
}

function classifyFailureSlices(results) {
  const slices = {
    http: results.filter(r => !r.ok).length,
    latency: results.filter(r => r.latencyMs > LATENCY_BUDGET_MS).length,
    routing: results.filter(r => !r.routePass).length,
    payload: results.filter(r => !r.payloadPass).length,
  };
  return slices;
}

(async () => {
  const startedAt = new Date().toISOString();
  const health = await fetch(`${BASE_URL}/health`).then(r => r.ok).catch(() => false);

  const results = [];
  for (const tc of CASES) {
    const call = await postJson(`${BASE_URL}/api/route-preview`, {
      prompt: tc.prompt,
      hiredAgents: ['bankr', 'scribe', 'seeker', 'aura', 'magos'],
      networkMode: NETWORK_MODE,
    });

    const specialist = String(call.json?.specialist || '').toLowerCase();
    const routePass = tc.expected.some(e => specialist.includes(e));
    const payloadPass = Boolean(call.json?.network) && typeof call.json?.fee === 'number';
    const latencyPass = call.latencyMs <= LATENCY_BUDGET_MS;

    results.push({
      case: tc.name,
      prompt: tc.prompt,
      expected: tc.expected,
      specialist,
      network: call.json?.network,
      executionSupported: call.json?.executionSupported,
      fee: call.json?.fee,
      ok: call.ok,
      status: call.status,
      latencyMs: call.latencyMs,
      routePass,
      payloadPass,
      latencyPass,
      raw: call.json || call.text,
    });
  }

  const p95 = results.map(r => r.latencyMs).sort((a, b) => a - b)[Math.max(0, Math.ceil(results.length * 0.95) - 1)] || 0;
  const pass = health && results.every(r => r.ok && r.routePass && r.payloadPass && r.latencyPass);
  const failureSlices = classifyFailureSlices(results);

  const summary = {
    startedAt,
    baseUrl: BASE_URL,
    networkMode: NETWORK_MODE,
    health,
    latencyBudgetMs: LATENCY_BUDGET_MS,
    p95LatencyMs: p95,
    pass,
    failureSlices,
    results,
  };

  const artifactsDir = path.join(process.cwd(), 'tests', 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const outPath = path.join(artifactsDir, `release-gate-smoke-${NETWORK_MODE}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    pass,
    health,
    baseUrl: BASE_URL,
    networkMode: NETWORK_MODE,
    p95LatencyMs: p95,
    failureSlices,
    artifact: outPath,
  }, null, 2));

  if (!pass) process.exit(1);
})();
