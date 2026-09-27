const express = require('express');
const path = require('path');
const assignmentsRouter = require('./routes/assignments');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies before they reach the API routes.
app.use(express.json());

// Serve frontend files from the public folder.
app.use(express.static(path.join(__dirname, 'public')));

// A simple endpoint to check that the server is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running.' });
});

app.use('/api/assignments', assignmentsRouter);

// Keep unknown API paths in JSON format.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Handle malformed JSON and any unexpected server errors consistently.
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Assignment Submission Tracker is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
