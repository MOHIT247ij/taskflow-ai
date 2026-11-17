const mongoose = require('mongoose');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const ai = require('../services/aiService');
const { asyncHandler } = require('../utils/http');

const DAY = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

async function computeStats(userId) {
  const owner = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);
  const in48h = new Date(now.getTime() + 2 * DAY);

  // Single $facet aggregation computes every dashboard metric in one DB round-trip
  const [facet] = await Task.aggregate([
    { $match: { owner } },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPriority: [{ $match: { status: { $ne: 'done' } } }, { $group: { _id: '$priority', count: { $sum: 1 } } }],
        overdue: [{ $match: { status: { $ne: 'done' }, dueDate: { $lt: now } } }, { $count: 'n' }],
        dueSoon: [{ $match: { status: { $ne: 'done' }, dueDate: { $gte: now, $lte: in48h } } }, { $count: 'n' }],
        thisWeek: [{ $match: { completedAt: { $gte: weekAgo } } }, { $count: 'n' }],
        lastWeek: [{ $match: { completedAt: { $gte: twoWeeksAgo, $lt: weekAgo } } }, { $count: 'n' }],
        daily: [
          { $match: { completedAt: { $gte: new Date(now.getTime() - 6 * DAY - (now.getTime() % DAY)) } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
        ],
        hours: [{ $match: { status: { $ne: 'done' } } }, { $group: { _id: null, h: { $sum: { $ifNull: ['$estimateHours', 0] } } } }],
        aiCount: [{ $match: { aiGenerated: true } }, { $count: 'n' }],
      },
    },
  ]);

  const status = Object.fromEntries(facet.byStatus.map((s) => [s._id, s.count]));
  const priority = Object.fromEntries(facet.byPriority.map((s) => [s._id, s.count]));
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  const first = (arr) => arr[0]?.n || 0;

  const dailyMap = Object.fromEntries(facet.daily.map((d) => [d._id, d.count]));
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * DAY);
    const key = d.toISOString().slice(0, 10);
    return { date: key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), count: dailyMap[key] || 0 };
  });

  return {
    total,
    todo: status.todo || 0,
    inProgress: status.in_progress || 0,
    review: status.review || 0,
    done: status.done || 0,
    completionRate: total ? Math.round(((status.done || 0) / total) * 100) : 0,
    overdue: first(facet.overdue),
    dueSoon: first(facet.dueSoon),
    urgentOpen: priority.urgent || 0,
    completedThisWeek: first(facet.thisWeek),
    completedLastWeek: first(facet.lastWeek),
    openHours: Math.round((facet.hours[0]?.h || 0) * 10) / 10,
    aiGenerated: first(facet.aiCount),
    priority: { urgent: priority.urgent || 0, high: priority.high || 0, medium: priority.medium || 0, low: priority.low || 0 },
    daily,
  };
}

async function focusTasks(userId) {
  const open = await Task.find({ owner: userId, status: { $ne: 'done' } })
    .select('title priority dueDate status project')
    .sort({ dueDate: 1 })
    .limit(50)
    .lean();
  return open.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity);
  });
}

exports.summary = asyncHandler(async (req, res) => {
  const [stats, recent, upcoming] = await Promise.all([
    computeStats(req.userId),
    Activity.find({ user: req.userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Task.find({ owner: req.userId, status: { $ne: 'done' }, dueDate: { $ne: null } }).sort({ dueDate: 1 }).limit(6).populate('project', 'name color').lean(),
  ]);
  res.json({ success: true, stats, recent, upcoming });
});

exports.insights = asyncHandler(async (req, res) => {
  const [stats, focus] = await Promise.all([computeStats(req.userId), focusTasks(req.userId)]);
  const result = await ai.generateInsights(stats, focus.slice(0, 8));
  res.json({ success: true, ...result });
});
