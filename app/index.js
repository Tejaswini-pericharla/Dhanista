// api/index.js
// This file serves as the entry point for your backend Express application
// when deployed as a Vercel Serverless Function.

// Import your Express app instance from the backend folder.
// The path 'backend/index' refers to your backend/index.js file.
// Vercel will automatically find and run the 'module.exports = app;' from that file.
const app = require('../backend/index');

// IMPORTANT: Export the app instance. Vercel automatically handles this exported app
// as a serverless function. You do NOT call app.listen() here.
module.exports = app;