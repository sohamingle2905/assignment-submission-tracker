const express = require('express');
const assignmentStore = require('../database/assignmentRepository');
const {
  validateAssignment,
  isValidStatus,
  allowedPriorities,
  allowedStatuses
} = require('../utils/assignmentValidation');

const router = express.Router();

function parseId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function todayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntil(dueDate) {
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - startOfToday) / (24 * 60 * 60 * 1000));
}

function formatDate(dueDate) {
  const [year, month, day] = dueDate.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function decorateAssignment(assignment) {
  const days = daysUntil(assignment.dueDate);
  const isOverdue = assignment.status !== 'Submitted' && days < 0;
  let timeLeft = 'Submitted';

  if (assignment.status !== 'Submitted') {
    if (days < 0) timeLeft = `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
    else if (days === 0) timeLeft = 'Due today';
    else if (days === 1) timeLeft = 'Due tomorrow';
    else timeLeft = `Due in ${days} days`;
  }

  return { ...assignment, isOverdue, timeLeft };
}

function renderForm(res, { assignment = {}, errors = {}, isEdit = false, status = 200 } = {}) {
  return res.status(status).render('assignment-form', {
    assignment,
    errors,
    isEdit,
    priorities: allowedPriorities,
    statuses: allowedStatuses
  });
}

router.get('/', async (req, res) => {
  const allAssignments = (await assignmentStore.getAll()).map(decorateAssignment);
  const filters = {
    q: typeof req.query.q === 'string' ? req.query.q.trim() : '',
    status: typeof req.query.status === 'string' ? req.query.status : 'All',
    priority: typeof req.query.priority === 'string' ? req.query.priority : 'All',
    subject: typeof req.query.subject === 'string' ? req.query.subject : 'All',
    sort: ['dueDate', 'priority', 'status'].includes(req.query.sort) ? req.query.sort : 'dueDate'
  };
  const query = filters.q.toLocaleLowerCase();

  const assignments = allAssignments.filter((assignment) => {
    const matchesSearch = `${assignment.title} ${assignment.subject}`.toLocaleLowerCase().includes(query);
    const matchesStatus = filters.status === 'All'
      || (filters.status === 'Overdue' ? assignment.isOverdue : assignment.status === filters.status);
    const matchesPriority = filters.priority === 'All' || assignment.priority === filters.priority;
    const matchesSubject = filters.subject === 'All' || assignment.subject === filters.subject;
    return matchesSearch && matchesStatus && matchesPriority && matchesSubject;
  });

  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  const statusRank = { Pending: 1, 'In Progress': 2, Submitted: 3 };
  assignments.sort((first, second) => {
    if (filters.sort === 'priority') return priorityRank[second.priority] - priorityRank[first.priority];
    if (filters.sort === 'status') return statusRank[first.status] - statusRank[second.status];
    return first.dueDate.localeCompare(second.dueDate);
  });

  const total = allAssignments.length;
  const submitted = allAssignments.filter((item) => item.status === 'Submitted').length;
  const statuses = ['Pending', 'In Progress', 'Submitted'];
  const priorities = ['Low', 'Medium', 'High'];

  return res.render('dashboard', {
    assignments,
    total,
    shown: assignments.length,
    pending: allAssignments.filter((item) => item.status === 'Pending').length,
    inProgress: allAssignments.filter((item) => item.status === 'In Progress').length,
    submitted,
    overdue: allAssignments.filter((item) => item.isOverdue).length,
    progress: total ? Math.round((submitted / total) * 100) : 0,
    statuses,
    priorities,
    subjects: [...new Set(allAssignments.map((item) => item.subject))].sort(),
    filters,
    todayLabel: new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()),
    formatDate
  });
});

router.get('/assignments/new', (req, res) => renderForm(res));

router.post('/assignments', async (req, res) => {
  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length) {
    return renderForm(res, { assignment: req.body, errors: result.errors, status: 400 });
  }

  await assignmentStore.create(result.body);
  return res.redirect(303, '/#assignments');
});

router.get('/assignments/:id/edit', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).send('Assignment ID must be a positive number.');
  const assignment = await assignmentStore.getById(id);
  if (!assignment) return res.status(404).send('Assignment not found.');
  return renderForm(res, { assignment, isEdit: true });
});

router.post('/assignments/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).send('Assignment ID must be a positive number.');
  const result = validateAssignment(req.body);
  if (Object.keys(result.errors).length) {
    return renderForm(res, { assignment: { ...req.body, id }, errors: result.errors, isEdit: true, status: 400 });
  }

  const updated = await assignmentStore.update(id, result.body);
  if (!updated) return res.status(404).send('Assignment not found.');
  return res.redirect(303, '/#assignments');
});

router.post('/assignments/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).send('Assignment ID must be a positive number.');
  if (!isValidStatus(req.body.status)) return res.status(400).send('Invalid assignment status.');

  const assignment = await assignmentStore.getById(id);
  if (!assignment) return res.status(404).send('Assignment not found.');
  await assignmentStore.update(id, { ...assignment, status: req.body.status });
  return res.redirect(303, '/#assignments');
});

router.post('/assignments/:id/delete', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).send('Assignment ID must be a positive number.');
  const deleted = await assignmentStore.remove(id);
  if (!deleted) return res.status(404).send('Assignment not found.');
  return res.redirect(303, '/#assignments');
});

module.exports = router;
