const test = require('node:test');
const assert = require('node:assert');
const h = require('../src/services/heuristicEngine');

const NOW = new Date('2026-11-17T10:00:00'); // a Tuesday

test('parseTask extracts title, priority, tags, estimate and due date', () => {
  const r = h.parseTask('Fix login bug by friday urgent #auth ~3h', NOW);
  assert.strictEqual(r.title, 'Fix login bug');
  assert.strictEqual(r.priority, 'urgent');
  assert.deepStrictEqual(r.tags, ['auth']);
  assert.strictEqual(r.estimateHours, 3);
  assert.strictEqual(new Date(r.dueDate).getDay(), 5);
});

test('parseTask understands tomorrow and minutes', () => {
  const r = h.parseTask('Call client tomorrow 30 min', NOW);
  assert.strictEqual(r.title, 'Call client');
  assert.strictEqual(r.estimateHours, 0.5);
  assert.strictEqual(new Date(r.dueDate).getDate(), 18);
});

test('parseTask handles dd/mm dates and low priority', () => {
  const r = h.parseTask('Read paper on 25/11 low priority', NOW);
  assert.strictEqual(r.priority, 'low');
  assert.strictEqual(new Date(r.dueDate).getDate(), 25);
});

test('breakdownGoal picks the dev template for software goals', () => {
  const tasks = h.breakdownGoal('Build a portfolio website');
  assert.ok(tasks.length >= 5);
  assert.ok(tasks.every((t) => t.tags.includes('dev')));
});

test('suggestPriority escalates overdue work', () => {
  const r = h.suggestPriority({ title: 'Send invoice', dueDate: '2026-11-15T10:00:00' }, NOW);
  assert.ok(['high', 'urgent'].includes(r.priority));
});

test('generateInsights handles empty workspace', () => {
  const r = h.generateInsights({ total: 0 });
  assert.match(r.headline, /Fresh start/);
});
