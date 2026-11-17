/**
 * Seeds a demo account with realistic data so the dashboard looks alive.
 *   npm run seed   ->  login: demo@taskflow.ai / demo1234
 */
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Activity = require('./models/Activity');

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays) => new Date(Date.now() + offsetDays * DAY);

async function seed() {
  await connectDB();
  const email = 'demo@taskflow.ai';
  const old = await User.findOne({ email });
  if (old) {
    await Promise.all([Task.deleteMany({ owner: old._id }), Project.deleteMany({ owner: old._id }), Activity.deleteMany({ user: old._id })]);
    await old.deleteOne();
  }

  const user = await User.create({ name: 'Demo User', email, password: 'demo1234', plan: 'pro', aiCredits: 200 });
  const [web, mkt, study] = await Project.create([
    { name: 'Website Revamp', description: 'Redesign marketing site with new pricing page', color: '#6366f1', owner: user._id },
    { name: 'Product Launch', description: 'Q4 launch campaign for v2.0', color: '#f59e0b', owner: user._id },
    { name: 'Placement Prep', description: 'DSA, SQL and system design practice', color: '#10b981', owner: user._id },
  ]);

  const t = (project, title, status, priority, due, extra = {}) => ({
    project: project._id, owner: user._id, title, status, priority, dueDate: due === null ? null : at(due), ...extra,
  });

  const tasks = [
    t(web, 'Audit current landing page performance', 'done', 'high', -6, { tags: ['seo'], estimateHours: 2, completedAt: at(-5) }),
    t(web, 'Design new pricing page in Figma', 'done', 'high', -3, { tags: ['design'], estimateHours: 4, completedAt: at(-2) }),
    t(web, 'Build responsive navbar component', 'review', 'medium', 1, { tags: ['frontend'], estimateHours: 3 }),
    t(web, 'Integrate Stripe checkout', 'in_progress', 'urgent', 2, { tags: ['payments', 'backend'], estimateHours: 6, subtasks: [{ title: 'Create products in Stripe', done: true }, { title: 'Webhook handler', done: false }] }),
    t(web, 'Fix mobile layout bug on Safari', 'todo', 'high', -1, { tags: ['bug'], estimateHours: 1 }),
    t(web, 'Add dark mode toggle', 'todo', 'low', 10, { tags: ['frontend'], estimateHours: 2 }),
    t(mkt, 'Write launch blog post', 'in_progress', 'high', 3, { tags: ['content'], estimateHours: 3, aiGenerated: true }),
    t(mkt, 'Prepare social media creatives', 'todo', 'medium', 5, { tags: ['design'], estimateHours: 4, aiGenerated: true }),
    t(mkt, 'Email campaign to beta users', 'todo', 'medium', 6, { tags: ['email'], estimateHours: 2, aiGenerated: true }),
    t(mkt, 'Define launch KPIs', 'done', 'medium', -4, { tags: ['analytics'], completedAt: at(-4) }),
    t(study, 'Solve 20 SQL window function problems', 'done', 'high', -1, { tags: ['sql'], estimateHours: 4, completedAt: at(-1) }),
    t(study, 'Revise joins & indexing', 'done', 'medium', -2, { tags: ['sql'], completedAt: at(-3) }),
    t(study, 'Mock interview: system design', 'todo', 'urgent', 1, { tags: ['interview'], estimateHours: 1.5 }),
    t(study, 'Arrays & hashing — 15 LeetCode problems', 'in_progress', 'high', 4, { tags: ['dsa'], estimateHours: 5 }),
    t(study, 'Read "Designing Data-Intensive Applications" ch. 1-3', 'todo', 'low', null, { tags: ['reading'] }),
    t(study, 'Update resume with new projects', 'done', 'high', 0, { tags: ['career'], completedAt: at(0) }),
  ];
  const counters = {};
  for (const task of tasks) {
    const key = `${task.project}-${task.status}`;
    counters[key] = (counters[key] || 0) + 1;
    task.order = counters[key];
  }
  await Task.insertMany(tasks);
  await Activity.create([
    { user: user._id, project: web._id, action: 'project.created', message: 'Created project "Website Revamp"' },
    { user: user._id, project: mkt._id, action: 'ai.breakdown', message: 'AI added 3 tasks to the board' },
    { user: user._id, project: study._id, action: 'task.moved', message: 'Moved "Update resume with new projects" to Done' },
  ]);

  console.log('🌱 Seed complete →  login: demo@taskflow.ai  /  demo1234');
  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
