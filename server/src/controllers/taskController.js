const Task = require('../models/Task');
const Project = require('../models/Project');
const activity = require('../services/activityService');
const { ApiError, asyncHandler } = require('../utils/http');

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const EDITABLE = ['title', 'description', 'status', 'priority', 'dueDate', 'tags', 'estimateHours', 'subtasks', 'order'];

async function assertProject(projectId, owner) {
  const project = await Project.exists({ _id: projectId, owner });
  if (!project) throw new ApiError(404, 'Project not found');
}

// GET /api/tasks?project=&status=&priority=&q=&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { project, status, priority, q, due } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200)); // capped pagination

  const filter = { owner: req.userId };
  if (project) filter.project = project;
  if (status) filter.status = { $in: status.split(',') };
  if (priority) filter.priority = { $in: priority.split(',') };
  if (q) filter.$text = { $search: q };
  if (due === 'overdue') Object.assign(filter, { dueDate: { $lt: new Date() }, status: { $ne: 'done' } });

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ status: 1, order: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);
  res.json({ success: true, tasks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.create = asyncHandler(async (req, res) => {
  const { project } = req.body;
  await assertProject(project, req.userId);
  const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => EDITABLE.includes(k)));
  const last = await Task.findOne({ owner: req.userId, project, status: data.status || 'todo' }).sort({ order: -1 }).select('order').lean();

  const task = await Task.create({
    ...data,
    project,
    owner: req.userId,
    aiGenerated: Boolean(req.body.aiGenerated),
    order: (last?.order ?? -1) + 1,
  });
  activity.log(req.userId, 'task.created', `Created task "${task.title}"`, { project, task: task._id });
  res.status(201).json({ success: true, task });
});

// Bulk create (used by AI breakdown)
exports.bulkCreate = asyncHandler(async (req, res) => {
  const { project, tasks } = req.body;
  await assertProject(project, req.userId);
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 50) throw new ApiError(400, 'tasks must be an array of 1-50 items');

  const last = await Task.findOne({ owner: req.userId, project, status: 'todo' }).sort({ order: -1 }).select('order').lean();
  let order = (last?.order ?? -1) + 1;
  const docs = tasks.map((t) => ({
    title: t.title,
    description: t.description || '',
    priority: t.priority || 'medium',
    dueDate: t.dueDate || null,
    tags: t.tags || [],
    estimateHours: t.estimateHours ?? null,
    status: 'todo',
    aiGenerated: true,
    order: order++,
    project,
    owner: req.userId,
  }));
  const created = await Task.insertMany(docs);
  activity.log(req.userId, 'ai.breakdown', `AI added ${created.length} tasks to the board`, { project });
  res.status(201).json({ success: true, tasks: created });
});

exports.update = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.userId });
  if (!task) throw new ApiError(404, 'Task not found');
  const prevStatus = task.status;

  for (const key of EDITABLE) if (key in req.body) task[key] = req.body[key];
  await task.save();

  if (prevStatus !== task.status) {
    activity.log(req.userId, 'task.moved', `Moved "${task.title}" to ${STATUS_LABEL[task.status]}`, { project: task.project, task: task._id });
  }
  res.json({ success: true, task });
});

// PATCH /api/tasks/reorder  { items: [{ id, status, order }] } — single round-trip for drag & drop
exports.reorder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length > 500) throw new ApiError(400, 'items must be an array (max 500)');
  if (items.some((i) => !i.id || !Task.STATUSES.includes(i.status) || typeof i.order !== 'number')) {
    throw new ApiError(400, 'each item needs id, valid status and numeric order');
  }

  const now = new Date();
  const ops = items.map(({ id, status, order }) => ({
    updateOne: {
      filter: { _id: id, owner: req.userId },
      update: [
        {
          $set: {
            status,
            order,
            completedAt: {
              $cond: [{ $eq: [status, 'done'] }, { $ifNull: ['$completedAt', now] }, null],
            },
          },
        },
      ],
    },
  }));
  if (ops.length) await Task.bulkWrite(ops, { ordered: false });
  res.json({ success: true, updated: ops.length });
});

exports.remove = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!task) throw new ApiError(404, 'Task not found');
  activity.log(req.userId, 'task.deleted', `Deleted task "${task.title}"`, { project: task.project });
  res.json({ success: true });
});
