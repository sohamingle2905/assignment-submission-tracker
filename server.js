const express = require('express');
const path = require('path');
const assignmentsRouter = require('./routes/assignments');
const pagesRouter = require('./routes/pages');
const { initializeDatabase, database } = require('./database/database');

const app = express();
const PORT = process.env.PORT || 3000;
let httpServer;
let isShuttingDown = false;

// Parse JSON request bodies before they reach the API routes.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Send direct requests for the old static dashboard to the current server-rendered page.
app.get('/index.html', (req, res) => res.redirect(302, '/'));

// Serve frontend files from the public folder.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// A simple endpoint to check that the server is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running.' });
});

// Render dashboard pages on the server so core buttons do not need browser JavaScript.
app.use('/', pagesRouter);
app.use('/api/assignments', assignmentsRouter);

// Keep unknown API paths in JSON format.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Handle malformed JSON, database errors, and other server errors consistently.
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }

  if (error.code && error.code.startsWith('SQLITE_')) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'A database error occurred.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Internal server error.' });
});

async function startServer() {
  try {
    // Wait until SQLite is ready before accepting requests.
    await initializeDatabase();

    // Keep a reference to the HTTP server and report port errors clearly.
    httpServer = app.listen(PORT);
    httpServer.on('listening', () => {
      console.log(`Assignment Submission Tracker is running at http://localhost:${PORT}`);
      console.log('SQLite database is ready.');
    });
    httpServer.on('error', (error) => {
      console.error(`Could not start the web server on port ${PORT}:`, error.message);
      database.close();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('Could not initialize the SQLite database:', error);
    process.exitCode = 1;
    database.close();
  }
}

function stopServer(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received. Shutting down the server...`);

  if (!httpServer) {
    database.close();
    return;
  }

  httpServer.close((serverError) => {
    if (serverError) {
      console.error('Error while stopping the web server:', serverError);
      process.exitCode = 1;
    }

    database.close((databaseError) => {
      if (databaseError) {
        console.error('Error while closing the SQLite database:', databaseError);
        process.exitCode = 1;
      }
    });
  });
}

if (require.main === module) {
  process.on('SIGINT', () => stopServer('SIGINT'));
  process.on('SIGTERM', () => stopServer('SIGTERM'));
  startServer();
}

module.exports = app;
