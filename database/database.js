const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databaseDirectory = __dirname;
const databasePath = path.join(databaseDirectory, 'assignments.db');

fs.mkdirSync(databaseDirectory, { recursive: true });

const database = new sqlite3.Database(databasePath);

function initializeDatabase() {
  const createAssignmentsTable = `
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT
    )
  `;

  return new Promise((resolve, reject) => {
    database.run(createAssignmentsTable, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = { database, databasePath, initializeDatabase };
