const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { validate } = require('../utils/http');
const auth = require('../controllers/authController');
const projects = require('../controllers/projectController');
const tasks = require('../controllers/taskController');
const ai = require('../controllers/aiController');
const dashboard = require('../controllers/dashboardController');
const { STATUSES, PRIORITIES } = require('../models/Task');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: 'draft-7', legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many AI requests, slow down a bit.' } });

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', uptime: process.uptime() }));

// ---- Auth ----
router.post('/auth/register', authLimiter, validate({ name: { required: true, type: 'string', max: 60 }, email: { required: true, email: true }, password: { required: true, type: 'string', min: 6 } }), auth.register);
router.post('/auth/login', authLimiter, validate({ email: { required: true, email: true }, password: { required: true, type: 'string' } }), auth.login);
router.get('/auth/me', protect, auth.me);

// ---- Everything below requires auth ----
router.use(protect);

router.get('/projects', projects.list);
router.post('/projects', validate({ name: { required: true, type: 'string', max: 80 } }), projects.create);
router.patch('/projects/:id', projects.update);
router.delete('/projects/:id', projects.remove);

const taskRules = {
  title: { required: true, type: 'string', max: 200 },
  project: { required: true, type: 'string' },
  status: { enum: STATUSES },
  priority: { enum: PRIORITIES },
};
router.get('/tasks', tasks.list);
router.post('/tasks', validate(taskRules), tasks.create);
router.post('/tasks/bulk', validate({ project: { required: true, type: 'string' }, tasks: { required: true, type: 'array' } }), tasks.bulkCreate);
router.patch('/tasks/reorder', tasks.reorder);
router.patch('/tasks/:id', validate({ status: { enum: STATUSES }, priority: { enum: PRIORITIES } }), tasks.update);
router.delete('/tasks/:id', tasks.remove);

router.get('/ai/status', ai.status);
router.post('/ai/parse', aiLimiter, validate({ text: { required: true, type: 'string', max: 500 } }), ai.parse);
router.post('/ai/breakdown', aiLimiter, validate({ goal: { required: true, type: 'string', max: 500 } }), ai.breakdown);
router.post('/ai/priority', aiLimiter, validate({ title: { required: true, type: 'string' } }), ai.priority);

router.get('/dashboard/summary', dashboard.summary);
router.get('/dashboard/insights', aiLimiter, dashboard.insights);

module.exports = router;
