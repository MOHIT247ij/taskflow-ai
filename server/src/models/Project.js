const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    color: { type: String, default: '#6366f1' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Tenant-scoped listing: every query filters by owner first
projectSchema.index({ owner: 1, archived: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
