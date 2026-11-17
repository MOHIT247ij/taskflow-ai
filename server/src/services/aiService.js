/**
 * AI Service — Strategy pattern:
 *   1) Try Google Gemini (LLM) when GEMINI_API_KEY is configured
 *   2) Fall back to the local heuristic engine on missing key / error / timeout
 * Every response carries `source` so the UI can show where the answer came from.
 */
const env = require('../config/env');
const heuristic = require('./heuristicEngine');

const TIMEOUT_MS = 12000;

async function callGemini(prompt) {
  if (!env.geminiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    return JSON.parse(text.replace(/^```json\s*|```$/g, ''));
  } catch (err) {
    console.warn(`⚠️  Gemini unavailable, using heuristic engine: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const clampPriority = (p) => (PRIORITIES.includes(p) ? p : 'medium');

async function parseTask(text, now = new Date()) {
  const llm = await callGemini(
    `Today is ${now.toISOString()} (${now.toDateString()}). Convert this task description into JSON with keys:
title (short imperative, no date/priority words), priority (low|medium|high|urgent), dueDate (ISO 8601 or null),
tags (array of lowercase single words, max 3), estimateHours (number or null).
Input: """${text}"""`
  );
  if (llm && llm.title) {
    return {
      source: 'gemini',
      task: {
        title: String(llm.title).slice(0, 200),
        priority: clampPriority(llm.priority),
        dueDate: llm.dueDate && !Number.isNaN(Date.parse(llm.dueDate)) ? new Date(llm.dueDate).toISOString() : null,
        tags: Array.isArray(llm.tags) ? llm.tags.slice(0, 5).map((t) => String(t).toLowerCase()) : [],
        estimateHours: typeof llm.estimateHours === 'number' ? llm.estimateHours : null,
      },
    };
  }
  return { source: 'heuristic', task: heuristic.parseTask(text, now) };
}

async function breakdownGoal(goal, context = '') {
  const llm = await callGemini(
    `You are a senior project manager. Break the goal below into 4-8 concrete, actionable tasks in logical order.
Return JSON: {"tasks":[{"title": string (<=90 chars, starts with a verb), "estimateHours": number,
"priority": "low"|"medium"|"high"|"urgent", "tags": [string], "dayOffset": integer days from today}]}
Project context: ${context || 'n/a'}
Goal: """${goal}"""`
  );
  if (llm && Array.isArray(llm.tasks) && llm.tasks.length) {
    return {
      source: 'gemini',
      tasks: llm.tasks.slice(0, 10).map((t, i) => ({
        title: String(t.title || `Step ${i + 1}`).slice(0, 200),
        estimateHours: Number(t.estimateHours) || null,
        priority: clampPriority(t.priority),
        tags: Array.isArray(t.tags) ? t.tags.slice(0, 3).map((x) => String(x).toLowerCase()) : [],
        dayOffset: Number.isInteger(t.dayOffset) ? t.dayOffset : i + 1,
      })),
    };
  }
  return { source: 'heuristic', tasks: heuristic.breakdownGoal(goal) };
}

async function suggestPriority(task, now = new Date()) {
  const llm = await callGemini(
    `Today is ${now.toISOString()}. Suggest a priority for this task. Return JSON {"priority":"low|medium|high|urgent","reason":"one short sentence"}.
Task: ${JSON.stringify({ title: task.title, description: task.description, dueDate: task.dueDate })}`
  );
  if (llm && llm.priority) return { source: 'gemini', priority: clampPriority(llm.priority), reason: String(llm.reason || '') };
  const h = heuristic.suggestPriority(task, now);
  return { source: 'heuristic', priority: h.priority, reason: h.reason };
}

async function generateInsights(stats, focusTasks = []) {
  const base = heuristic.generateInsights(stats);
  const llm = stats.total
    ? await callGemini(
        `You are a productivity coach inside a task manager. Given these stats and top open tasks, return JSON
{"headline": one motivating sentence, "insights": [3 short actionable bullet strings with an emoji each]}.
Stats: ${JSON.stringify(stats)}
Top open tasks: ${JSON.stringify(focusTasks.map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })))}`
      )
    : null;
  const focus = focusTasks.slice(0, 3).map((t) => ({ _id: t._id, title: t.title, priority: t.priority, dueDate: t.dueDate }));
  if (llm && llm.headline && Array.isArray(llm.insights)) {
    return { source: 'gemini', headline: llm.headline, insights: llm.insights.slice(0, 5), focus };
  }
  return { source: 'heuristic', ...base, focus };
}

module.exports = { parseTask, breakdownGoal, suggestPriority, generateInsights, isLLMEnabled: () => Boolean(env.geminiKey) };
