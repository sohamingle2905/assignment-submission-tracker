// Jest sets NODE_ENV to "test". Set it here as well so the database module
// always opens an isolated in-memory database for this test file.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');
const { database, initializeDatabase } = require('../database/database');

const validAssignment = {
  title: 'Database report',
  subject: 'Database Systems',
  description: 'Prepare the final report',
  dueDate: '2026-10-15',
  priority: 'Medium',
  status: 'Pending'
};

function runDatabaseCommand(sql) {
  return new Promise((resolve, reject) => {
    database.run(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createAssignment(overrides = {}) {
  const response = await request(app)
    .post('/api/assignments')
    .send({ ...validAssignment, ...overrides });

  expect(response.status).toBe(201);
  return response.body;
}

beforeAll(async () => {
  await initializeDatabase();
});

beforeEach(async () => {
  // Keep every test independent and make generated IDs repeatable.
  await runDatabaseCommand('DELETE FROM assignments');
  await runDatabaseCommand("DELETE FROM sqlite_sequence WHERE name = 'assignments'");
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test('GET /api/assignments returns an empty JSON array successfully', async () => {
  const response = await request(app).get('/api/assignments');

  expect(response.status).toBe(200);
  expect(response.body).toEqual([]);
});

test('POST /api/assignments creates and returns an assignment', async () => {
  const response = await request(app)
    .post('/api/assignments')
    .send(validAssignment);

  expect(response.status).toBe(201);
  expect(response.headers.location).toBe('/api/assignments/1');
  expect(response.body).toMatchObject({ id: 1, ...validAssignment });
});

test('POST /api/assignments rejects missing required fields', async () => {
  const response = await request(app)
    .post('/api/assignments')
    .send({ title: 'Incomplete assignment' });

  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Validation failed.');
  expect(response.body.details).toMatchObject({
    subject: expect.any(String),
    dueDate: expect.any(String),
    priority: expect.any(String),
    status: expect.any(String)
  });
});

test('GET /api/assignments/:id returns one assignment', async () => {
  const created = await createAssignment();
  const response = await request(app).get(`/api/assignments/${created.id}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(created);
});

test('PUT /api/assignments/:id updates an assignment', async () => {
  const created = await createAssignment();
  const changes = {
    ...validAssignment,
    title: 'Updated database report',
    priority: 'High',
    status: 'In Progress'
  };

  const response = await request(app)
    .put(`/api/assignments/${created.id}`)
    .send(changes);

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ id: created.id, ...changes });
});

test('DELETE /api/assignments/:id removes an assignment', async () => {
  const created = await createAssignment();
  const response = await request(app).delete(`/api/assignments/${created.id}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Assignment deleted.');
  expect(response.body.assignment.id).toBe(created.id);

  const listResponse = await request(app).get('/api/assignments');
  expect(listResponse.body).toEqual([]);
});

test('an invalid assignment ID returns a 400 error', async () => {
  const response = await request(app).get('/api/assignments/not-a-number');

  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Assignment id must be a positive integer.');
});

test('POST /api/assignments rejects invalid status and priority values', async () => {
  const invalidStatus = await request(app)
    .post('/api/assignments')
    .send({ ...validAssignment, status: 'Finished' });
  const invalidPriority = await request(app)
    .post('/api/assignments')
    .send({ ...validAssignment, priority: 'Urgent' });

  expect(invalidStatus.status).toBe(400);
  expect(invalidStatus.body.details.status).toMatch(/Pending, In Progress, Submitted/);
  expect(invalidPriority.status).toBe(400);
  expect(invalidPriority.body.details.priority).toMatch(/Low, Medium, High/);
});
