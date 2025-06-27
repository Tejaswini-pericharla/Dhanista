// backend/index.js - This is your main server entry point

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
// The 'port' constant is no longer strictly necessary for Vercel deployment
// but can remain if you want to reuse this file for local development with a conditional listener.
// const port = process.env.PORT || 5000; // Define the port for your server

// Middleware
// IMPORTANT: For production on Vercel, you should update CORS origin to your Vercel deployment URL
// For example: origin: ['http://localhost:3000', 'https://your-project-name.vercel.app']
app.use(cors());
// Enable parsing of JSON request bodies
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  // These options are deprecated in recent Mongoose versions, but keep for broader compatibility
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB Connected Successfully!');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  // In a serverless environment, avoid process.exit(1) as it might terminate the function prematurely
});

// Import your chat routes
const chatRoutes = require('./routes/chat');
// Mount the chat routes under the '/api/chat' endpoint
app.use('/api/chat', chatRoutes);

// Basic route for testing server status (mostly for local development)
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// IMPORTANT: Export the app instance for Vercel Serverless Functions
// Vercel will use this exported 'app' as the serverless function handler.
module.exports = app;

// Removed the app.listen() block for Vercel deployment.
// If you want to keep it for local development, you can wrap it in an if (process.env.NODE_ENV !== 'production') block:
/*
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Local Dev Server running on http://localhost:${port}`);
  });
}
*/
