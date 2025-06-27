const mongoose = require("mongoose");

// Schema for FAQ documents
const faqSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Title of the FAQ
  content: { type: String, required: true }, // Answer content of the FAQ
  createdAt: { type: Date, default: Date.now } // Timestamp for when the FAQ was created
});

module.exports = mongoose.model("FAQ", faqSchema);