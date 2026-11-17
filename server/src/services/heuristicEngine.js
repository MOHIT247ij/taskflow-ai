/**
 * Heuristic AI engine — zero-dependency, deterministic fallback used when no
 * LLM key is configured or the LLM call fails. Keeps every AI feature usable
 * offline and makes the product resilient (graceful degradation).
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const PRIORITY_WORDS = {
  urgent: ['urgent', 'asap', 'immediately', 'critical', 'blocker', 'p0', 'emergency'],
  high: ['high priority', 'important', 'high', 'p1', 'deadline', 'client', 'production', 'bug', 'fix'],
  low: ['low priority', 'low', 'someday', 'maybe', 'nice to have', 'p3', 'optional'],
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(18, 0, 0, 0); // treat "by <day>" as end of working day
  return x;
}

/** Extract a due date from natural language. Returns { date, matched } */
function extractDate(text, now = new Date()) {
  const t = text.toLowerCase();
  const today = startOfDay(now);
  let m;

  if ((m = t.match(/\b(by |on |due )?(today|tonight|eod)\b/))) return { date: endOfDay(today), matched: m[0] };
  if ((m = t.match(/\b(by |on |due )?(tomorrow|tmrw|tmr)\b/))) return { date: endOfDay(new Date(today.getTime() + DAY)), matched: m[0] };
  if ((m = t.match(/\bin (\d{1,3}) (day|days|week|weeks)\b/))) {
    const n = parseInt(m[1], 10) * (m[2].startsWith('week') ? 7 : 1);
    return { date: endOfDay(new Date(today.getTime() + n * DAY)), matched: m[0] };
  }
  if ((m = t.match(/\b(by |on |due )?next week\b/))) return { date: endOfDay(new Date(today.getTime() + 7 * DAY)), matched: m[0] };
  if ((m = t.match(/\b(by |on |due )?(end of (the )?week|eow|this weekend)\b/))) {
    const diff = (5 - today.getDay() + 7) % 7; // upcoming friday
    return { date: endOfDay(new Date(today.getTime() + diff * DAY)), matched: m[0] };
  }
  if ((m = t.match(/\b(by |on |due )?(next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thurs|fri|sat)\b/))) {
    const word = m[3];
    const idx = WEEKDAYS.findIndex((w) => w.startsWith(word.slice(0, 3)));
    let diff = (idx - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (m[2]) diff += diff < 7 ? 7 : 0;
    return { date: endOfDay(new Date(today.getTime() + diff * DAY)), matched: m[0] };
  }
  // dd/mm or dd-mm (Indian format)
  if ((m = t.match(/\b(by |on |due )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10) - 1;
    let year = m[4] ? parseInt(m[4], 10) : today.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 18);
    if (!m[4] && d < today) d.setFullYear(year + 1);
    if (!Number.isNaN(d.getTime()) && month < 12 && day <= 31) return { date: d, matched: m[0] };
  }
  return { date: null, matched: '' };
}

function detectPriority(text) {
  const t = ` ${text.toLowerCase()} `;
  for (const level of ['urgent', 'high', 'low']) {
    const hit = PRIORITY_WORDS[level].find((w) => new RegExp(`\\b${w}\\b`).test(t));
    if (hit) return { priority: level, matched: hit };
  }
  return { priority: 'medium', matched: '' };
}

/** "Fix login bug by friday urgent #auth ~3h" -> structured task */
function parseTask(text, now = new Date()) {
  let working = ` ${text.trim()} `;

  const tags = [...working.matchAll(/#([\w-]{1,30})/g)].map((x) => x[1].toLowerCase());
  working = working.replace(/#[\w-]{1,30}/g, ' ');

  let estimateHours = null;
  const est = working.match(/[~(]?\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b\)?/i);
  if (est) {
    const n = parseFloat(est[1]);
    estimateHours = /^m/i.test(est[2]) ? Math.round((n / 60) * 100) / 100 : n;
    working = working.replace(est[0], ' ');
  }

  const { date, matched: dateText } = extractDate(working, now);
  if (dateText) working = working.replace(new RegExp(dateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');

  const { priority, matched: prioText } = detectPriority(working);
  // only strip explicit priority markers, keep meaningful words like "bug"
  if (prioText && /priority|urgent|asap|p\d|critical|immediately|someday|maybe/.test(prioText)) {
    working = working.replace(new RegExp(`\\b${prioText}( priority)?\\b`, 'i'), ' ');
  }

  const title = working
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .replace(/\b(priority)\b/gi, '')
    .trim();

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : text.trim(),
    priority,
    dueDate: date ? date.toISOString() : null,
    tags,
    estimateHours,
  };
}

const TEMPLATES = [
  {
    match: /\b(app|website|web ?site|api|feature|backend|frontend|dashboard|module|integration|login|auth|page)\b/i,
    tags: ['dev'],
    steps: [
      ['Define requirements & acceptance criteria for', 1],
      ['Design data model / UI wireframe for', 2],
      ['Set up project structure & dependencies for', 1],
      ['Implement core logic of', 4],
      ['Build UI & connect API for', 3],
      ['Write tests & fix edge cases for', 2],
      ['Code review, deploy & document', 1],
    ],
  },
  {
    match: /\b(report|presentation|ppt|paper|thesis|document|proposal|essay|article|blog)\b/i,
    tags: ['writing'],
    steps: [
      ['Gather sources & data for', 2],
      ['Draft outline of', 1],
      ['Write first draft of', 3],
      ['Create visuals / charts for', 2],
      ['Review, proofread & finalise', 1],
    ],
  },
  {
    match: /\b(launch|marketing|campaign|social|seo|promotion|event)\b/i,
    tags: ['marketing'],
    steps: [
      ['Define target audience & goals for', 1],
      ['Prepare content calendar for', 2],
      ['Create creatives & copy for', 3],
      ['Schedule & publish', 1],
      ['Track metrics & report results of', 1],
    ],
  },
  {
    match: /\b(exam|study|learn|course|interview|prepare|preparation|revise)\b/i,
    tags: ['learning'],
    steps: [
      ['List syllabus / topics for', 1],
      ['Collect study material for', 1],
      ['Study core concepts of', 6],
      ['Practice problems / mock tests for', 4],
      ['Revise weak areas of', 2],
    ],
  },
];

function breakdownGoal(goal) {
  const clean = goal.trim().replace(/\.$/, '');
  const short = clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
  const tpl = TEMPLATES.find((x) => x.match.test(clean)) || {
    tags: ['general'],
    steps: [
      ['Clarify scope & success criteria for', 1],
      ['Research & plan', 2],
      ['Execute first milestone of', 3],
      ['Review progress on', 1],
      ['Complete & wrap up', 1],
    ],
  };
  const total = tpl.steps.length;
  return tpl.steps.map(([verb, hours], i) => ({
    title: `${verb} "${short}"`,
    estimateHours: hours,
    priority: i < 2 ? 'high' : i === total - 1 ? 'medium' : 'medium',
    tags: tpl.tags,
    dayOffset: Math.round(((i + 1) / total) * Math.max(total, 7)), // spread across ~a week
  }));
}

function suggestPriority({ title = '', description = '', dueDate = null }, now = new Date()) {
  let score = 0;
  const reasons = [];
  const kw = detectPriority(`${title} ${description}`);
  if (kw.priority === 'urgent') { score += 4; reasons.push(`keyword "${kw.matched}"`); }
  if (kw.priority === 'high') { score += 2; reasons.push(`keyword "${kw.matched}"`); }
  if (kw.priority === 'low') { score -= 2; reasons.push(`keyword "${kw.matched}"`); }

  if (dueDate) {
    const days = (new Date(dueDate).getTime() - now.getTime()) / DAY;
    if (days < 0) { score += 4; reasons.push('already overdue'); }
    else if (days <= 1) { score += 3; reasons.push('due within 24h'); }
    else if (days <= 3) { score += 2; reasons.push('due within 3 days'); }
    else if (days <= 7) { score += 1; reasons.push('due this week'); }
    else { reasons.push('deadline is comfortable'); }
  } else {
    reasons.push('no deadline set');
  }

  const priority = score >= 5 ? 'urgent' : score >= 3 ? 'high' : score <= -1 ? 'low' : 'medium';
  return { priority, score, reason: reasons.join(', ') };
}

function generateInsights(stats) {
  const insights = [];
  const { total = 0, done = 0, overdue = 0, dueSoon = 0, inProgress = 0, urgentOpen = 0, completedThisWeek = 0, completedLastWeek = 0 } = stats;
  const rate = total ? Math.round((done / total) * 100) : 0;

  if (!total) {
    return {
      headline: 'Fresh start! Create your first project and let AI break a goal into tasks.',
      insights: ['Tip: try the AI Quick Add bar — e.g. "Prepare client demo by friday urgent #sales ~2h"'],
      focus: [],
    };
  }
  if (overdue) insights.push(`⚠️ ${overdue} task${overdue > 1 ? 's are' : ' is'} overdue — reschedule or tackle them first.`);
  if (urgentOpen) insights.push(`🔥 ${urgentOpen} urgent task${urgentOpen > 1 ? 's' : ''} still open.`);
  if (dueSoon) insights.push(`⏰ ${dueSoon} task${dueSoon > 1 ? 's' : ''} due in the next 48 hours.`);
  if (inProgress > 5) insights.push(`🧠 ${inProgress} tasks in progress — limit WIP to ~3 to finish faster.`);
  if (completedThisWeek > completedLastWeek) insights.push(`📈 Velocity up: ${completedThisWeek} done this week vs ${completedLastWeek} last week.`);
  else if (completedLastWeek > completedThisWeek) insights.push(`📉 ${completedThisWeek} done this week vs ${completedLastWeek} last week — pick a few quick wins.`);
  if (rate >= 70) insights.push(`✅ Strong completion rate of ${rate}%.`);

  const headline = overdue
    ? 'Clear the overdue backlog first, then move to high-impact work.'
    : rate >= 70
      ? 'Great momentum — you are on track this week!'
      : 'Steady progress. Focus on your top priorities today.';

  return { headline, insights: insights.length ? insights : [`Completion rate: ${rate}%. Keep going!`], focus: [] };
}

module.exports = { parseTask, breakdownGoal, suggestPriority, generateInsights, extractDate, detectPriority };
