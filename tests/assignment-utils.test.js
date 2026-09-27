const { filterAndSortAssignments, isOverdue } = require('../public/assignment-utils');

const today = new Date(2026, 8, 27);
const assignments = [
  {
    id: 1,
    title: 'Calculus project',
    subject: 'Mathematics',
    description: 'A project description',
    dueDate: '2026-10-03',
    priority: 'Medium',
    status: 'Pending'
  },
  {
    id: 2,
    title: 'Lab report',
    subject: 'Biology',
    description: '',
    dueDate: '2026-10-01',
    priority: 'High',
    status: 'In Progress'
  },
  {
    id: 3,
    title: 'Essay',
    subject: 'Literature',
    description: '',
    dueDate: '2026-09-20',
    priority: 'Low',
    status: 'Submitted'
  },
  {
    id: 4,
    title: 'Tutorial exercise',
    subject: 'Mathematics',
    description: '',
    dueDate: '2026-09-25',
    priority: 'High',
    status: 'Pending'
  }
];

function findIds(overrides = {}) {
  return filterAndSortAssignments(assignments, {
    query: '',
    status: 'All',
    priority: 'All',
    subject: 'All',
    sortBy: 'dueDate',
    ...overrides
  }, today).map((assignment) => assignment.id);
}

test('search finds words in titles and subjects without depending on letter case', () => {
  expect(findIds({ query: 'CALCULUS' })).toEqual([1]);
  expect(findIds({ query: 'biology' })).toEqual([2]);
});

test('status, priority, and subject filters narrow the assignment list', () => {
  expect(findIds({ status: 'Pending' })).toEqual([4, 1]);
  expect(findIds({ priority: 'High' })).toEqual([4, 2]);
  expect(findIds({ subject: 'Mathematics' })).toEqual([4, 1]);
});

test('search and multiple filters can be combined', () => {
  expect(findIds({
    query: 'math',
    status: 'Pending',
    priority: 'High',
    subject: 'Mathematics'
  })).toEqual([4]);
});

test('assignments can be sorted by due date, priority, and status', () => {
  expect(findIds({ sortBy: 'dueDate' })).toEqual([3, 4, 2, 1]);
  expect(findIds({ sortBy: 'priority' })).toEqual([2, 4, 1, 3]);
  expect(findIds({ sortBy: 'status' })).toEqual([1, 4, 2, 3]);
});

test('overdue work excludes assignments already submitted', () => {
  expect(isOverdue(assignments[3], today)).toBe(true);
  expect(isOverdue(assignments[2], today)).toBe(false);
  expect(findIds({ status: 'Overdue' })).toEqual([4]);
});

test('search with no matches returns an empty list', () => {
  expect(findIds({ query: 'no matching assignment' })).toEqual([]);
});
