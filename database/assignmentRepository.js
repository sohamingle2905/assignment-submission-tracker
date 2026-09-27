const { database } = require('./database');

// Keep the database column name due_date mapped to the API's dueDate field.
const assignmentFields = `
  id,
  title,
  subject,
  description,
  due_date AS dueDate,
  priority,
  status
`;

function getAll() {
  const sql = `SELECT ${assignmentFields} FROM assignments ORDER BY id`;

  return new Promise((resolve, reject) => {
    database.all(sql, [], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function getById(id) {
  const sql = `SELECT ${assignmentFields} FROM assignments WHERE id = ?`;

  return new Promise((resolve, reject) => {
    database.get(sql, [id], (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

async function create(assignment) {
  const sql = `
    INSERT INTO assignments
      (title, subject, description, due_date, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    assignment.title,
    assignment.subject,
    assignment.description,
    assignment.dueDate,
    assignment.priority,
    assignment.status,
    new Date().toISOString()
  ];

  const id = await new Promise((resolve, reject) => {
    database.run(sql, values, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this.lastID);
    });
  });

  return getById(id);
}

async function update(id, assignment) {
  const sql = `
    UPDATE assignments
    SET title = ?, subject = ?, description = ?, due_date = ?, priority = ?, status = ?
    WHERE id = ?
  `;
  const values = [
    assignment.title,
    assignment.subject,
    assignment.description,
    assignment.dueDate,
    assignment.priority,
    assignment.status,
    id
  ];

  const changes = await new Promise((resolve, reject) => {
    database.run(sql, values, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this.changes);
    });
  });

  if (changes === 0) {
    return null;
  }

  return getById(id);
}

async function remove(id) {
  const assignment = await getById(id);
  if (!assignment) {
    return null;
  }

  const sql = 'DELETE FROM assignments WHERE id = ?';

  await new Promise((resolve, reject) => {
    database.run(sql, [id], (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return assignment;
}

module.exports = { getAll, getById, create, update, remove };
