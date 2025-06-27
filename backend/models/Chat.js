const mongoose = require('mongoose');

// Define a sub-schema for individual messages within a chat conversation
const messageSchema = new mongoose.Schema({
  sender: {
    type: String, // 'user' or 'ai'
    required: true
  },
  content: { // Changed from 'message' to 'content' for clarity with Gemini's 'parts'
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Define the main chat schema
const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true // Ensures only one chat document per user
  },
  messages: [messageSchema], // An array of messageSchema documents
  updatedAt: { // Add an updatedAt field for easy sorting/tracking
    type: Date,
    default: Date.now
  }
}, { timestamps: true }); // Mongoose will auto-manage createdAt and updatedAt

// Before saving, update the updatedAt field
chatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Chat', chatSchema);