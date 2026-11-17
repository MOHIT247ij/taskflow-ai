const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const activity = require('../services/activityService');
const { ApiError, asyncHandler } = require('../utils/http');

exports.list = asyncHandler(async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.userId);
  const projects = await Project.find({ owner, archived: false }).sort({ createdAt: 1 }).lean();

  // One aggregation for progress of all projects (avoids N+1 queries)
  const counts = await Task.aggregate([
    { $match: { owner } },
    { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id.toString(), c]));

  res.json({
    success: true,
    projects: projects.map((p) => {
      const c = byId[p._id.toString()] || { total: 0, done: 0 };
      return { ...p, taskCount: c.total, doneCount: c.done, progress: c.total ? Math.round((c.done / c.total) * 100) : 0 };
    }),
  });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;
  const project = await Project.create({ name, description, color, owner: req.userId });
  activity.log(req.userId, 'project.created', `Created project "${project.name}"`, { project: project._id });
  res.status(201).json({ success: true, project });
});

exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'color', 'archived'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const project = await Project.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, updates, { new: true, runValidators: true });
  if (!project) throw new ApiError(404, 'Project not found');
  res.json({ success: true, project });
});

exports.remove = asyncHandler(async (req, res) => {
  const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!project) throw new ApiError(404, 'Project not found');
  await Task.deleteMany({ project: project._id, owner: req.userId });
  activity.log(req.userId, 'project.deleted', `Deleted project "${project.name}"`);
  res.json({ success: true });
});
