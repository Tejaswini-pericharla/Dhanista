// backend/routes/upload.js
const express = require("express");
const router = express.Router();
const FAQ = require("../models/FAQ"); // Import the FAQ model

// POST endpoint to upload new FAQs
router.post("/", async (req, res) => {
  const { title, content } = req.body;

  // Basic validation
  if (!title || !content) {
    return res.status(400).json({ success: false, message: "Title and content are required." });
  }

  try {
    const faq = new FAQ({ title, content }); // Create a new FAQ instance
    await faq.save(); // Save the new FAQ to MongoDB
    res.status(201).json({ success: true, message: "FAQ uploaded successfully!", faq });
  } catch (error) {
    console.error("Error uploading FAQ:", error);
    res.status(500).json({ success: false, message: "Failed to upload FAQ." });
  }
});

module.exports = router;