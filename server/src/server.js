const mongoose = require('mongoose');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('❌ Could not connect to MongoDB. Check MONGO_URI in server/.env');
    console.error(`   ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`🚀 TaskFlow AI API running on http://localhost:${env.port}/api`);
    console.log(`🤖 AI engine: ${env.geminiKey ? `Gemini (${env.geminiModel})` : 'Heuristic (set GEMINI_API_KEY for LLM)'}`);
  });

  // Graceful shutdown — lets in-flight requests finish (important for zero-downtime deploys)
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
