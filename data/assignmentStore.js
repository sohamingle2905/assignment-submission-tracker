// Temporary in-memory storage. Assignments reset when the server restarts.
const assignments = [];
let nextId = 1;

function getAll() {
  return assignments;
}

function getById(id) {
  return assignments.find((assignment) => assignment.id === id);
}

function create(assignmentDetails) {
  const assignment = { id: nextId, ...assignmentDetails };
  nextId += 1;
  assignments.push(assignment);
  return assignment;
}

function update(id, assignmentDetails) {
  const index = assignments.findIndex((assignment) => assignment.id === id);

  if (index === -1) {
    return null;
  }

  assignments[index] = { id, ...assignmentDetails };
  return assignments[index];
}

function remove(id) {
  const index = assignments.findIndex((assignment) => assignment.id === id);

  if (index === -1) {
    return null;
  }

  return assignments.splice(index, 1)[0];
}

module.exports = { getAll, getById, create, update, remove };
