const mongoose = require('mongoose');

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: STATUSES, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    estimateHours: { type: Number, min: 0, max: 999, default: null },
    subtasks: [subtaskSchema],
    order: { type: Number, default: 0 },
    aiGenerated: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Compound indexes matching the hottest query paths
taskSchema.index({ owner: 1, project: 1, status: 1, order: 1 }); // kanban board
taskSchema.index({ owner: 1, dueDate: 1, status: 1 }); // overdue / upcoming
taskSchema.index({ owner: 1, completedAt: -1 }); // analytics
taskSchema.index({ title: 'text', description: 'text', tags: 'text' }); // search

// Keep completedAt in sync with status
taskSchema.pre('save', function syncCompleted(next) {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? this.completedAt || new Date() : null;
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
module.exports.STATUSES = STATUSES;
module.exports.PRIORITIES = PRIORITIES;
