// Small, reusable helpers for filtering, sorting, and checking deadlines.
function daysUntil(dueDate, today = new Date()) {
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((due - current) / millisecondsPerDay);
}

function isOverdue(assignment, today = new Date()) {
  return assignment.status !== 'Submitted' && daysUntil(assignment.dueDate, today) < 0;
}

function filterAndSortAssignments(assignments, options, today = new Date()) {
  const query = options.query.trim().toLocaleLowerCase();
  const filteredAssignments = assignments.filter((assignment) => {
    const searchableText = `${assignment.title} ${assignment.subject}`.toLocaleLowerCase();
    const matchesSearch = searchableText.includes(query);
    const matchesStatus = options.status === 'All'
      || (options.status === 'Overdue'
        ? isOverdue(assignment, today)
        : assignment.status === options.status);
    const matchesPriority = options.priority === 'All' || assignment.priority === options.priority;
    const matchesSubject = options.subject === 'All' || assignment.subject === options.subject;

    return matchesSearch && matchesStatus && matchesPriority && matchesSubject;
  });

  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  const statusRank = { Pending: 1, 'In Progress': 2, Submitted: 3 };

  filteredAssignments.sort((first, second) => {
    let comparison = 0;
    if (options.sortBy === 'priority') {
      comparison = priorityRank[second.priority] - priorityRank[first.priority];
    } else if (options.sortBy === 'status') {
      comparison = statusRank[first.status] - statusRank[second.status];
    } else {
      comparison = first.dueDate.localeCompare(second.dueDate);
    }

    return comparison || first.id - second.id;
  });

  return filteredAssignments;
}

const assignmentUtils = { daysUntil, isOverdue, filterAndSortAssignments };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = assignmentUtils;
}
if (typeof window !== 'undefined') {
  window.AssignmentUtils = assignmentUtils;
}
