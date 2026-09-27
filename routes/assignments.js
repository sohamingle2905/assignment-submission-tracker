const express = require('express');
const assignmentStore = require('../database/assignmentRepository');
const { validateAssignment } = require('../utils/assignmentValidation');

const router = express.Router();

function parseId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sendValidationError(res, errors) {
  return res.status(400).json({ error: 'Validation failed.', details: errors });
}

// GET /api/assignments - return every assignment.
router.get('/', async (req, res) => {
  const assignments = await assignmentStore.getAll();
  return res.json(assignments);
});

// GET /api/assignments/:id - return one assignment.
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Assignment id must be a positive integer.' });

  const assignment = await assignmentStore.getById(id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  return res.json(assignment);
});

// POST /api/assignments - validate and create an assignment.
router.post('/', async (req, res) => {
  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length > 0) return sendValidationError(res, result.errors);

  const assignment = await assignmentStore.create(result.body);
  return res.status(201).location(`/api/assignments/${assignment.id}`).json(assignment);
});

// PUT /api/assignments/:id - validate and replace an assignment's details.
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Assignment id must be a positive integer.' });

  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length > 0) return sendValidationError(res, result.errors);

  const assignment = await assignmentStore.update(id, result.body);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  return res.json(assignment);
});

// DELETE /api/assignments/:id - remove an assignment.
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Assignment id must be a positive integer.' });

  const assignment = await assignmentStore.remove(id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  return res.json({ message: 'Assignment deleted.', assignment });
});

module.exports = router;
