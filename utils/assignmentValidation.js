const allowedPriorities = ['Low', 'Medium', 'High'];
const allowedStatuses = ['Pending', 'In Progress', 'Submitted'];

// Validate and clean the fields shared by the JSON API and HTML forms.
function validateAssignment(body) {
  const errors = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: {}, errors: { body: 'A form or JSON object is required.' } };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const dueDate = body.dueDate;
  const priority = body.priority;
  const status = body.status;
  const description = body.description === undefined ? '' : body.description;

  if (!title) errors.title = 'Title is required.';
  if (!subject) errors.subject = 'Subject is required.';
  if (typeof dueDate !== 'string' || !isValidDate(dueDate)) {
    errors.dueDate = 'Due date must be a valid date in YYYY-MM-DD format.';
  }
  if (!allowedPriorities.includes(priority)) {
    errors.priority = `Priority must be one of: ${allowedPriorities.join(', ')}.`;
  }
  if (!allowedStatuses.includes(status)) {
    errors.status = `Status must be one of: ${allowedStatuses.join(', ')}.`;
  }
  if (typeof description !== 'string') errors.description = 'Description must be a string.';

  return {
    body: { title, subject, description, dueDate, priority, status },
    errors
  };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidStatus(value) {
  return allowedStatuses.includes(value);
}

module.exports = { validateAssignment, isValidStatus, allowedPriorities, allowedStatuses };
