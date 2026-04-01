'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { migrate, migrateBatch, planMigration } = require('./migrate');
const { detect } = require('./detect');
const { sanitizeRepoName } = require('./sanitize');
const logger = require('./logger');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- API Routes ----------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: require('../package.json').version,
    uptime: process.uptime(),
  });
});

// Detect SCM type for a SourceForge URL
app.post('/api/detect', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    const result = await detect(url);
    res.json(result);
  } catch (err) {
    logger.error(`Detection error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// Sanitize a repository name
app.post('/api/sanitize', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    res.json({ original: name, sanitized: sanitizeRepoName(name) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Plan a migration (dry run)
app.post('/api/plan', async (req, res) => {
  try {
    const { url, repoName, owner } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    const plan = await planMigration(url, { repoName, owner });
    res.json(plan);
  } catch (err) {
    logger.error(`Planning error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// Execute a single migration
app.post('/api/migrate', async (req, res) => {
  try {
    const { url, token, owner, org, isPrivate, repoName } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }
    const result = await migrate(url, { token, owner, org, isPrivate, repoName });
    res.json(result);
  } catch (err) {
    logger.error(`Migration error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Execute batch migration
app.post('/api/migrate/batch', async (req, res) => {
  try {
    const { urls, token, owner, org, isPrivate } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls array is required' });
    }
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }
    const results = await migrateBatch(urls, { token, owner, org, isPrivate });
    res.json({ results });
  } catch (err) {
    logger.error(`Batch migration error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server (only when run directly, not when imported for testing)
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`SF2GH Migrator running on http://localhost:${PORT}`);
  });
}

module.exports = app;
