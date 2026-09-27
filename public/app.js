const API_URL = '/api/assignments';
const allowedStatuses = ['Pending', 'In Progress', 'Submitted'];

// Keep the page usable if the helper file fails to load in the browser.
const assignmentHelpers = window.AssignmentUtils || (() => {
  function daysUntil(dueDate, today = new Date()) {
    const [year, month, day] = dueDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((due - current) / (24 * 60 * 60 * 1000));
  }

  function isOverdue(assignment, today = new Date()) {
    return assignment.status !== 'Submitted' && daysUntil(assignment.dueDate, today) < 0;
  }

  function filterAndSortAssignments(assignments, options) {
    const query = options.query.trim().toLocaleLowerCase();
    const priorityRank = { High: 3, Medium: 2, Low: 1 };
    const statusRank = { Pending: 1, 'In Progress': 2, Submitted: 3 };
    return assignments.filter((assignment) => {
      const text = `${assignment.title} ${assignment.subject}`.toLocaleLowerCase();
      const statusMatches = options.status === 'All'
        || (options.status === 'Overdue'
          ? isOverdue(assignment)
          : assignment.status === options.status);
      return text.includes(query)
        && statusMatches
        && (options.priority === 'All' || assignment.priority === options.priority)
        && (options.subject === 'All' || assignment.subject === options.subject);
    }).sort((first, second) => {
      let order = 0;
      if (options.sortBy === 'priority') {
        order = priorityRank[second.priority] - priorityRank[first.priority];
      } else if (options.sortBy === 'status') {
        order = statusRank[first.status] - statusRank[second.status];
      } else {
        order = first.dueDate.localeCompare(second.dueDate);
      }
      return order || first.id - second.id;
    });
  }

  return { daysUntil, isOverdue, filterAndSortAssignments };
})();
const { daysUntil, isOverdue, filterAndSortAssignments } = assignmentHelpers;

const state = {
  assignments: [],
  editingId: null,
  toastTimer: null
};

const elements = {
  rows: document.querySelector('#assignment-rows'),
  emptyState: document.querySelector('#empty-state'),
  emptyTitle: document.querySelector('#empty-title'),
  emptyDescription: document.querySelector('#empty-description'),
  totalCount: document.querySelector('#total-count'),
  pendingCount: document.querySelector('#pending-count'),
  inProgressCount: document.querySelector('#in-progress-count'),
  submittedCount: document.querySelector('#submitted-count'),
  overdueCount: document.querySelector('#overdue-count'),
  assignmentTotal: document.querySelector('#assignment-total'),
  refreshButton: document.querySelector('#refresh-button'),
  clearFiltersButton: document.querySelector('#clear-filters-button'),
  sidebarCount: document.querySelector('#sidebar-count'),
  progressPercent: document.querySelector('#progress-percent'),
  progressCaption: document.querySelector('#progress-caption'),
  progressBar: document.querySelector('#progress-bar'),
  progressFill: document.querySelector('#progress-fill'),
  searchInput: document.querySelector('#search-input'),
  statusFilter: document.querySelector('#status-filter'),
  priorityFilter: document.querySelector('#priority-filter'),
  subjectFilter: document.querySelector('#subject-filter'),
  sortSelect: document.querySelector('#sort-select'),
  dialog: document.querySelector('#assignment-dialog'),
  form: document.querySelector('#assignment-form'),
  formTitle: document.querySelector('#form-title'),
  saveButton: document.querySelector('#save-assignment-button'),
  toastRegion: document.querySelector('#toast-region')
};

const formFields = {
  title: elements.form.elements.namedItem('title'),
  subject: elements.form.elements.namedItem('subject'),
  description: elements.form.elements.namedItem('description'),
  dueDate: elements.form.elements.namedItem('dueDate'),
  priority: elements.form.elements.namedItem('priority'),
  status: elements.form.elements.namedItem('status')
};

function toLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(toLocalDate(dateString));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    throw new Error('Could not reach the server. Check that the application is running and try again.');
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(result?.error || `Request failed with status ${response.status}.`);
    error.details = result?.details;
    throw error;
  }

  return result;
}

async function loadAssignments({ announce = false } = {}) {
  try {
    const assignments = await request(API_URL);
    if (!Array.isArray(assignments)) {
      throw new Error('The server returned an unexpected assignments response.');
    }

    state.assignments = assignments;
    renderDashboard();
    if (announce) showToast('Assignments refreshed.', 'success');
  } catch (error) {
    showToast(error.message, 'error', 7000);
    if (state.assignments.length === 0) {
      elements.emptyTitle.textContent = 'Could not load assignments';
      elements.emptyDescription.textContent = error.message;
      elements.emptyState.hidden = false;
    }
  }
}

function renderDashboard() {
  const assignments = state.assignments;
  const pending = assignments.filter((item) => item.status === 'Pending').length;
  const inProgress = assignments.filter((item) => item.status === 'In Progress').length;
  const submitted = assignments.filter((item) => item.status === 'Submitted').length;
  const overdue = assignments.filter(isOverdue).length;
  const percentage = assignments.length ? Math.round((submitted / assignments.length) * 100) : 0;

  elements.totalCount.textContent = assignments.length;
  elements.pendingCount.textContent = pending;
  elements.inProgressCount.textContent = inProgress;
  elements.submittedCount.textContent = submitted;
  elements.overdueCount.textContent = overdue;
  elements.sidebarCount.textContent = assignments.length;
  elements.assignmentTotal.textContent = `${assignments.length} ${assignments.length === 1 ? 'assignment' : 'assignments'}`;
  elements.progressPercent.textContent = `${percentage}%`;
  elements.progressCaption.textContent = assignments.length
    ? `${submitted} of ${assignments.length} ${assignments.length === 1 ? 'assignment' : 'assignments'} submitted.`
    : 'Every finished assignment is a win.';
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressBar.setAttribute('aria-valuenow', percentage);

  updateSubjectOptions();
  renderAssignments();
}

function updateSubjectOptions() {
  const selectedSubject = elements.subjectFilter.value;
  const subjects = [...new Set(state.assignments.map((assignment) => assignment.subject))]
    .sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));

  elements.subjectFilter.innerHTML = '<option value="All">All subjects</option>'
    + subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('');

  if (subjects.includes(selectedSubject)) {
    elements.subjectFilter.value = selectedSubject;
  }
}

function getTimeLeft(assignment) {
  if (assignment.status === 'Submitted') {
    return { label: 'Submitted', className: 'done' };
  }

  const days = daysUntil(assignment.dueDate);
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`,
      className: 'overdue'
    };
  }
  if (days === 0) return { label: 'Due today', className: 'due-soon' };
  if (days === 1) return { label: 'Due tomorrow', className: 'due-soon' };
  return { label: `Due in ${days} days`, className: days <= 3 ? 'due-soon' : '' };
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(' ', '-');
}

function renderAssignments() {
  const query = elements.searchInput.value.trim();
  const status = elements.statusFilter.value;
  const priority = elements.priorityFilter.value;
  const subject = elements.subjectFilter.value;
  const visibleAssignments = filterAndSortAssignments(state.assignments, {
    query,
    status,
    priority,
    subject,
    sortBy: elements.sortSelect.value
  });

  const hasFilters = query || status !== 'All' || priority !== 'All' || subject !== 'All';
  elements.assignmentTotal.textContent = hasFilters
    ? `${visibleAssignments.length} shown of ${state.assignments.length}`
    : `${state.assignments.length} ${state.assignments.length === 1 ? 'assignment' : 'assignments'}`;

  elements.rows.innerHTML = visibleAssignments.map((assignment) => {
    const dueLabel = getTimeLeft(assignment);
    const priorityClass = `priority-${assignment.priority.toLowerCase()}`;
    return `
      <tr data-id="${assignment.id}">
        <td data-label="Assignment"><div class="assignment-name"><strong title="${escapeHtml(assignment.title)}">${escapeHtml(assignment.title)}</strong><span title="${escapeHtml(assignment.subject)}">${escapeHtml(assignment.subject)}${assignment.description ? ` · ${escapeHtml(assignment.description)}` : ''}</span></div></td>
        <td data-label="Due date"><span class="due-date">${escapeHtml(formatDate(assignment.dueDate))}</span></td>
        <td data-label="Priority"><span class="priority-badge ${priorityClass}">${escapeHtml(assignment.priority)}</span></td>
        <td data-label="Status"><label class="sr-only" for="status-${assignment.id}">Change status for ${escapeHtml(assignment.title)}</label><select class="status-badge status-${statusClass(assignment.status)} status-select" id="status-${assignment.id}" data-action="status" aria-label="Status for ${escapeHtml(assignment.title)}">${allowedStatuses.map((status) => `<option value="${status}" ${status === assignment.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
        <td data-label="Time left"><span class="days-label ${dueLabel.className}">${escapeHtml(dueLabel.label)}</span></td>
        <td data-label="Actions"><div class="row-actions"><button class="action-button edit-button" type="button" data-action="edit" aria-label="Edit ${escapeHtml(assignment.title)}" title="Edit"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6 4 4M4 20l4.25-.85L19 8.4a2.12 2.12 0 0 0-3-3L5.25 16.15 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="action-button delete-button" type="button" data-action="delete" aria-label="Delete ${escapeHtml(assignment.title)}" title="Delete"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14m-12.5 0 .8 12h8.4l.8-12M9 7V4.5h6V7m-5 3v5m4-5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></td>
      </tr>`;
  }).join('');

  const hasAssignments = state.assignments.length > 0;
  const hasVisibleAssignments = visibleAssignments.length > 0;
  const hasCriteria = Boolean(query) || status !== 'All' || priority !== 'All' || subject !== 'All';
  elements.emptyState.hidden = hasVisibleAssignments;
  if (!hasAssignments && !hasCriteria) {
    elements.emptyTitle.textContent = 'A fresh start';
    elements.emptyDescription.textContent = 'No assignments yet. Add your first one to get organized.';
    document.querySelector('#empty-add-button').hidden = false;
    elements.clearFiltersButton.hidden = true;
  } else if (!hasVisibleAssignments) {
    elements.emptyTitle.textContent = 'No assignments found.';
    elements.emptyDescription.textContent = 'Try changing your search or filters to see more assignments.';
    document.querySelector('#empty-add-button').hidden = true;
    elements.clearFiltersButton.hidden = false;
  }
}

function updateTodayLabel() {
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  }).format(new Date());
}

function showAssignmentDialog() {
  elements.dialog.hidden = false;
  elements.dialog.classList.add('is-open');
  document.body.classList.add('dialog-fallback-active');
}

function closeAssignmentDialog() {
  elements.dialog.hidden = true;
  elements.dialog.classList.remove('is-open');
  document.body.classList.remove('dialog-fallback-active');
}

function openAddDialog() {
  state.editingId = null;
  elements.form.reset();
  clearFormErrors();
  elements.formTitle.textContent = 'Add assignment';
  elements.saveButton.textContent = 'Save assignment';
  formFields.status.value = 'Pending';
  formFields.priority.value = 'Medium';
  showAssignmentDialog();
  formFields.title.focus();
}

function openEditDialog(id) {
  const assignment = state.assignments.find((item) => item.id === id);
  if (!assignment) return;

  state.editingId = id;
  clearFormErrors();
  elements.formTitle.textContent = 'Edit assignment';
  elements.saveButton.textContent = 'Save changes';
  Object.entries(formFields).forEach(([key, field]) => {
    field.value = assignment[key] || '';
  });
  showAssignmentDialog();
  formFields.title.focus();
}

function clearFormErrors() {
  Object.values(formFields).forEach((field) => field.removeAttribute('aria-invalid'));
  document.querySelectorAll('.field-error').forEach((message) => {
    message.hidden = true;
    message.textContent = '';
  });
}

function showFormErrors(errors) {
  clearFormErrors();
  Object.entries(errors || {}).forEach(([fieldName, message]) => {
    const field = formFields[fieldName];
    const messageElement = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (field) field.setAttribute('aria-invalid', 'true');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.hidden = false;
    }
  });
}

function showToast(message, type = 'success', duration = 3600) {
  window.clearTimeout(state.toastTimer);
  const icon = type === 'error'
    ? '<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  elements.toastRegion.innerHTML = `<div class="toast ${type === 'error' ? 'error' : ''}" role="${type === 'error' ? 'alert' : 'status'}"><span class="toast-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icon}</svg></span><span class="toast-message">${escapeHtml(message)}</span></div>`;
  state.toastTimer = window.setTimeout(() => { elements.toastRegion.innerHTML = ''; }, duration);
}

// Show a message instead of leaving unexpected click-handler errors silent.
window.addEventListener('error', (event) => {
  if (event.error && elements.toastRegion) {
    console.error('Dashboard error:', event.error);
    showToast('That action could not be completed. Refresh the page and try again.', 'error', 6000);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Dashboard request error:', event.reason);
  showToast(event.reason?.message || 'A request could not be completed.', 'error', 6000);
});

async function handleFormSubmit(event) {
  event.preventDefault();
  clearFormErrors();
  if (!elements.form.reportValidity()) return;

  const assignment = Object.fromEntries(new FormData(elements.form).entries());
  const isEditing = state.editingId !== null;
  const url = isEditing ? `${API_URL}/${state.editingId}` : API_URL;
  const method = isEditing ? 'PUT' : 'POST';

  elements.saveButton.disabled = true;
  elements.saveButton.textContent = isEditing ? 'Saving…' : 'Adding…';
  try {
    const result = await request(url, { method, body: JSON.stringify(assignment) });
    closeAssignmentDialog();
    showToast(isEditing ? 'Assignment updated.' : 'Assignment added.');
    await loadAssignments();
    if (!result) throw new Error('The assignment was saved, but the server response was empty.');
  } catch (error) {
    if (error.details) {
      showFormErrors(error.details);
      showToast('Please check the highlighted fields.', 'error', 6000);
    } else {
      showToast(error.message, 'error', 6000);
    }
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = isEditing ? 'Save changes' : 'Save assignment';
  }
}

async function changeStatus(id, status, select) {
  const assignment = state.assignments.find((item) => item.id === id);
  if (!assignment) return;
  const previousStatus = assignment.status;
  select.disabled = true;
  try {
    await request(`${API_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...assignment, status })
    });
    showToast(`Status changed to ${status}.`);
    await loadAssignments();
  } catch (error) {
    select.value = previousStatus;
    showToast(error.message, 'error', 6000);
  } finally {
    select.disabled = false;
  }
}

async function deleteAssignment(id) {
  const assignment = state.assignments.find((item) => item.id === id);
  if (!assignment) return;
  const confirmed = window.confirm(`Delete “${assignment.title}”? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await request(`${API_URL}/${id}`, { method: 'DELETE' });
    showToast('Assignment deleted.');
    await loadAssignments();
  } catch (error) {
    showToast(error.message, 'error', 6000);
  }
}

document.querySelector('#add-assignment-button').addEventListener('click', openAddDialog);
document.querySelector('#empty-add-button').addEventListener('click', openAddDialog);
document.querySelectorAll('.close-dialog, .cancel-dialog').forEach((button) => {
  button.addEventListener('click', closeAssignmentDialog);
});
elements.form.addEventListener('submit', handleFormSubmit);
elements.searchInput.addEventListener('input', renderAssignments);
elements.statusFilter.addEventListener('change', renderAssignments);
elements.priorityFilter.addEventListener('change', renderAssignments);
elements.subjectFilter.addEventListener('change', renderAssignments);
elements.sortSelect.addEventListener('change', renderAssignments);
elements.rows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = Number(button.closest('tr').dataset.id);
  if (button.dataset.action === 'edit') openEditDialog(id);
  if (button.dataset.action === 'delete') deleteAssignment(id);
});
elements.rows.addEventListener('change', (event) => {
  if (event.target.matches('[data-action="status"]')) {
    const id = Number(event.target.closest('tr').dataset.id);
    changeStatus(id, event.target.value, event.target);
  }
});
elements.refreshButton.addEventListener('click', () => loadAssignments({ announce: true }));
elements.clearFiltersButton.addEventListener('click', () => {
  elements.searchInput.value = '';
  elements.statusFilter.value = 'All';
  elements.priorityFilter.value = 'All';
  elements.subjectFilter.value = 'All';
  elements.sortSelect.value = 'dueDate';
  renderAssignments();
});
document.querySelectorAll('a[href="#dashboard"], a[href="#assignments"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetSection = link.getAttribute('href');
    const section = document.querySelector(targetSection);
    if (!section) return;

    event.preventDefault();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.location.hash !== targetSection) {
      window.history.replaceState(null, '', targetSection);
    }

    document.querySelectorAll('.nav-link').forEach((navLink) => {
      const isActive = navLink.getAttribute('href') === targetSection;
      navLink.classList.toggle('active', isActive);
      if (isActive) {
        navLink.setAttribute('aria-current', 'page');
      } else {
        navLink.removeAttribute('aria-current');
      }
    });
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.dialog.hidden) closeAssignmentDialog();
});

elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) closeAssignmentDialog();
});

window.addEventListener('focus', () => loadAssignments());

updateTodayLabel();
loadAssignments();
