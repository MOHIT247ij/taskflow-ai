const ai = require('../services/aiService');
const Project = require('../models/Project');
const User = require('../models/User');
const activity = require('../services/activityService');
const { ApiError, asyncHandler } = require('../utils/http');

// SaaS-style metering: each LLM-backed request consumes one credit (heuristic is free)
async function consumeCredit(userId) {
  if (!ai.isLLMEnabled()) return;
  const user = await User.findOneAndUpdate({ _id: userId, aiCredits: { $gt: 0 } }, { $inc: { aiCredits: -1 } }, { new: true });
  if (!user) throw new ApiError(402, 'AI credits exhausted for this plan');
}

exports.status = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('aiCredits plan');
  res.json({ success: true, engine: ai.isLLMEnabled() ? 'gemini' : 'heuristic', credits: user?.aiCredits ?? 0, plan: user?.plan });
});

exports.parse = asyncHandler(async (req, res) => {
  await consumeCredit(req.userId);
  const result = await ai.parseTask(req.body.text);
  res.json({ success: true, ...result });
});

exports.breakdown = asyncHandler(async (req, res) => {
  await consumeCredit(req.userId);
  const { goal, projectId } = req.body;
  let context = '';
  if (projectId) {
    const p = await Project.findOne({ _id: projectId, owner: req.userId }).select('name description').lean();
    if (p) context = `${p.name}: ${p.description}`;
  }
  const result = await ai.breakdownGoal(goal, context);
  const today = new Date();
  result.tasks = result.tasks.map((t) => {
    const due = new Date(today);
    due.setDate(due.getDate() + (t.dayOffset || 1));
    due.setHours(18, 0, 0, 0);
    return { ...t, dueDate: due.toISOString() };
  });
  activity.log(req.userId, 'ai.breakdown', `AI broke down goal: "${goal.slice(0, 60)}"`, { project: projectId });
  res.json({ success: true, ...result });
});

exports.priority = asyncHandler(async (req, res) => {
  await consumeCredit(req.userId);
  const result = await ai.suggestPriority(req.body);
  res.json({ success: true, ...result });
});
