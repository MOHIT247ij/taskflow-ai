const Activity = require('../models/Activity');

// Fire-and-forget: activity logging must never break the main request
function log(user, action, message, { project, task } = {}) {
  Activity.create({ user, action, message, project, task }).catch((err) =>
    console.warn('Activity log failed:', err.message)
  );
}

module.exports = { log };
