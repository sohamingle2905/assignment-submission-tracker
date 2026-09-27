const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the frontend files from the public folder.
app.use(express.static(path.join(__dirname, 'public')));

// A simple endpoint to check that the server is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running.' });
});

app.listen(PORT, () => {
  console.log(`Assignment Submission Tracker is running at http://localhost:${PORT}`);
});
