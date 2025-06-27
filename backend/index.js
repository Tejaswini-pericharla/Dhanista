// backend/index.js - This is your main server entry point

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 5000; // Define the port for your server

// Middleware
// Enable CORS for all origins (adjust for production)
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
  // Exit process if DB connection fails
  process.exit(1);
});

// Import your chat routes
// This path is now correct: it means looking for 'chat.js' inside the 'routes' folder
const chatRoutes = require('./routes/chat');
// Mount the chat routes under the '/api/chat' endpoint
app.use('/api/chat', chatRoutes);

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
