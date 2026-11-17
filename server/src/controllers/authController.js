const User = require('../models/User');
const Project = require('../models/Project');
const { signToken } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../utils/http');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({ name, email, password });
  // Onboarding: every new workspace starts with one project
  await Project.create({ name: 'My First Project', description: 'Start here 🚀', owner: user._id });

  res.status(201).json({ success: true, token: signToken(user._id), user });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid email or password');
  res.json({ success: true, token: signToken(user._id), user });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, user });
});
