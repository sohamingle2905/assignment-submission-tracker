const express = require('express');
const assignmentStore = require('../data/assignmentStore');

const router = express.Router();

const allowedPriorities = ['Low', 'Medium', 'High'];
const allowedStatuses = ['Pending', 'In Progress', 'Submitted'];

// Check the complete request body used when creating or replacing an assignment.
function validateAssignment(body) {
  const errors = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: {}, errors: { body: 'A JSON object is required.' } };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const dueDate = body.dueDate;
  const priority = body.priority;
  const status = body.status;
  const description = body.description === undefined ? '' : body.description;

  if (!title) {
    errors.title = 'Title is required.';
  }
  if (!subject) {
    errors.subject = 'Subject is required.';
  }
  if (typeof dueDate !== 'string' || !isValidDate(dueDate)) {
    errors.dueDate = 'Due date must be a valid date in YYYY-MM-DD format.';
  }
  if (!allowedPriorities.includes(priority)) {
    errors.priority = `Priority must be one of: ${allowedPriorities.join(', ')}.`;
  }
  if (!allowedStatuses.includes(status)) {
    errors.status = `Status must be one of: ${allowedStatuses.join(', ')}.`;
  }
  if (typeof description !== 'string') {
    errors.description = 'Description must be a string.';
  }

  return {
    body: { title, subject, description, dueDate, priority, status },
    errors
  };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseId(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sendValidationError(res, errors) {
  return res.status(400).json({ error: 'Validation failed.', details: errors });
}

// GET /api/assignments - return every assignment.
router.get('/', (req, res) => {
  res.json(assignmentStore.getAll());
});

// GET /api/assignments/:id - return one assignment.
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Assignment id must be a positive integer.' });
  }

  const assignment = assignmentStore.getById(id);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found.' });
  }

  return res.json(assignment);
});

// POST /api/assignments - validate and create an assignment.
router.post('/', (req, res) => {
  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length > 0) {
    return sendValidationError(res, result.errors);
  }

  const assignment = assignmentStore.create(result.body);
  return res.status(201).location(`/api/assignments/${assignment.id}`).json(assignment);
});

// PUT /api/assignments/:id - validate and replace an assignment's details.
router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Assignment id must be a positive integer.' });
  }

  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length > 0) {
    return sendValidationError(res, result.errors);
  }

  const assignment = assignmentStore.update(id, result.body);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found.' });
  }

  return res.json(assignment);
});

// DELETE /api/assignments/:id - remove an assignment.
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Assignment id must be a positive integer.' });
  }

  const assignment = assignmentStore.remove(id);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found.' });
  }

  return res.json({ message: 'Assignment deleted.', assignment });
});

module.exports = router;
