'use strict';

jest.mock('../src/detect', () => ({
  detect: jest.fn(),
  ScmType: { GIT: 'git', SVN: 'svn', UNKNOWN: 'unknown' },
}));

jest.mock('../src/migrate', () => ({
  migrate: jest.fn(),
  migrateBatch: jest.fn(),
  planMigration: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/index');

describe('GET /api/health', () => {
  it('returns 200 with status, version, and uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('POST /api/detect', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/api/detect').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'url is required');
  });
});

describe('POST /api/sanitize', () => {
  it('returns sanitized name for valid input', async () => {
    const res = await request(app).post('/api/sanitize').send({ name: 'My Project!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('original', 'My Project!');
    expect(res.body).toHaveProperty('sanitized', 'my-project');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/sanitize').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'name is required');
  });
});

describe('POST /api/plan', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/api/plan').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'url is required');
  });
});

describe('POST /api/migrate', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/api/migrate').send({ token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'url is required');
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/migrate')
      .send({ url: 'https://sourceforge.net/projects/test/' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'GitHub token is required');
  });
});

describe('POST /api/migrate/batch', () => {
  it('returns 400 when urls is missing', async () => {
    const res = await request(app).post('/api/migrate/batch').send({ token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'urls array is required');
  });

  it('returns 400 when urls is not an array', async () => {
    const res = await request(app)
      .post('/api/migrate/batch')
      .send({ urls: 'not-an-array', token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'urls array is required');
  });

  it('returns 400 when urls is empty array', async () => {
    const res = await request(app).post('/api/migrate/batch').send({ urls: [], token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'urls array is required');
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/migrate/batch')
      .send({ urls: ['https://sourceforge.net/projects/test/'] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'GitHub token is required');
  });
});

describe('GET /', () => {
  it('returns the HTML page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
