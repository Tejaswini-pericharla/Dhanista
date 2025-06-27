// backend/routes/chat.js
const express = require("express");
const router = express.Router();
// CORRECTED PATHS: Go up one level (..) then into models/
const Chat = require("../models/Chat"); // Import Chat model
const FAQ = require("../models/FAQ");   // Import FAQ model
const axios = require("axios");         // For making HTTP requests to Gemini API
const dotenv = require("dotenv");       // Import dotenv to access environment variables
const multer = require('multer');       // For handling file uploads (multipart/form-data)
const pdf = require('pdf-parse');       // For parsing PDF content

// Load environment variables (ensure this runs if not already in index.js)
// It's generally better to call dotenv.config() once in your main index.js file.
// For safety, we include it here as well, but it won't re-run if already configured.
dotenv.config();

// Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Get the API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- DEBUGGING LINE: Check if the API key is loaded ---
console.log("GEMINI_API_KEY loaded:", GEMINI_API_KEY ? "YES (key present)" : "NO (key is undefined/empty)");
// --- END DEBUGGING LINE ---

// Configure Multer for file uploads
// We use memoryStorage for direct processing of the file buffer
const upload = multer({ storage: multer.memoryStorage() });


// --- CHAT ROUTE (for user messages) ---
router.post("/", async (req, res) => {
  const { userId, message } = req.body;

  console.log("Received chat request for userId:", userId, "message:", message);

  if (!userId || !message) {
    console.log("Validation failed: User ID or message missing.");
    return res.status(400).json({ reply: "User ID and message are required." });
  }

  try {
    // 1. Fetch all FAQs to use as context for the AI
    const faqs = await FAQ.find({});
    // Concatenate FAQs into a single context string. Add a clear separator.
    const faqContext = faqs.map(faq => `Q: ${faq.title}\nA: ${faq.content}`).join("\n\n---\n\n");
    console.log("Fetched FAQs. Context length:", faqContext.length);

    // 2. Fetch existing chat history for context (optional, but good for continuity)
    let chat = await Chat.findOne({ userId });
    let chatHistory = [];
    if (chat && chat.messages) {
      // Limit to last few messages and map to Gemini API 'parts' format
      chatHistory = chat.messages.slice(-5).map(msg => ({ // Limit to last 5 messages for brevity and token efficiency
        role: msg.sender === 'user' ? 'user' : 'model', // Gemini uses 'model' for AI/assistant
        parts: [{ text: msg.content }]
      }));
      console.log("Fetched chat history. Messages count:", chatHistory.length);
    } else {
      console.log("No existing chat history found for userId:", userId);
    }

    // Construct the AI's system instruction/context for improved keyword matching and response generation
    // Changed instruction to be less restrictive about answering only from FAQs
    const systemInstruction = `You are Dhanista, a helpful and knowledgeable AI assistant. Your primary goal is to answer user questions accurately and comprehensively based on the provided FAQs and your general knowledge.

    When answering:
    - **Prioritize information from the FAQs.** If a direct or highly relevant answer is found there, use it.
    - If the user's question isn't directly covered by the FAQs, try to use your general knowledge to provide a helpful response.
    - If you genuinely cannot find any relevant information in the FAQs AND your general knowledge is insufficient to answer the query, politely state that you do not have enough information to provide a precise answer.

    Here are the available FAQs:
    ${faqContext}
    `;

    // Construct messages payload for the Gemini API
    const payload = {
      contents: [
        { role: "user", parts: [{ text: systemInstruction }] }, // System instruction as the first user message
        ...chatHistory, // Include previous messages for conversation context
        { role: "user", parts: [{ text: message }] } // Current user message
      ],
      generationConfig: {
        temperature: 0.5, // Slightly increased temperature for more flexibility, default was 0.7 which is good, but 0.5 can make it more focused but still allow some inference. Let's keep it at 0.5 for now and test.
        maxOutputTokens: 500,
      }
    };
    console.log("Sending payload to Gemini API. Payload (first 500 chars):", JSON.stringify(payload, null, 2).substring(0, 500) + "...");


    // 3. Call Gemini API
    const response = await axios.post(
      GEMINI_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );
    console.log("Received response from Gemini API.");

    if (response.data && response.data.candidates && response.data.candidates.length > 0 &&
        response.data.candidates[0].content && response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts.length > 0) {
      const reply = response.data.candidates[0].content.parts[0].text;
      console.log("Extracted AI Reply:", reply);

      // 4. Save chat history to MongoDB
      if (!chat) {
        chat = new Chat({ userId, messages: [] });
      }
      chat.messages.push({ sender: "user", content: message });
      chat.messages.push({ sender: "ai", content: reply });
      await chat.save();
      console.log("Chat history saved to MongoDB.");

      res.json({ reply });
    } else {
      console.error("Gemini API response was empty or malformed:", JSON.stringify(response.data, null, 2));
      res.status(500).json({ reply: "AI response was empty or malformed. Please try again." });
    }

  } catch (error) {
    console.error("Error interacting with Gemini API or MongoDB:", error.response ? error.response.data : error.message);
    res.status(500).json({ reply: "An error occurred while processing your request. Please try again later." });
  }
});


// --- TEXT FAQ UPLOAD ROUTE ---
router.post("/faqs", async (req, res) => {
  const { title, content } = req.body;

  console.log("Received text FAQ upload request. Title:", title);

  if (!title || !content) {
    console.log("Validation failed: FAQ title or content missing.");
    return res.status(400).json({ message: "FAQ title and content are required." });
  }

  try {
    const newFAQ = new FAQ({ title, content });
    await newFAQ.save();
    console.log("Text FAQ saved to MongoDB successfully:", newFAQ);
    res.status(201).json({ message: "Text FAQ uploaded successfully!", faq: newFAQ });
  } catch (error) {
    console.error("Error saving text FAQ to MongoDB:", error.message);
    res.status(500).json({ message: "Failed to upload text FAQ.", error: error.message });
  }
});

// --- GENERIC FILE FAQ UPLOAD ROUTE ---
// 'file' here matches the formData.append('file', file) name from the frontend
router.post("/upload-file-faq", upload.single('file'), async (req, res) => {
  const { title } = req.body; // Title comes from form field
  const uploadedFile = req.file;   // File comes from req.file (thanks to multer)

  console.log("Received generic file upload request. Title:", title, "File:", uploadedFile ? uploadedFile.originalname : "No file");

  if (!title || !uploadedFile) {
    console.log("Validation failed: FAQ Title or file missing.");
    return res.status(400).json({ message: "FAQ title and file are required." });
  }

  let extractedContent = ''; // Initialize extracted content as empty

  try {
    // Attempt to extract text based on mimetype
    if (uploadedFile.mimetype === 'application/pdf') {
      try {
        const data = await pdf(uploadedFile.buffer); // uploadedFile.buffer contains the binary data
        extractedContent = data.text;
        console.log("Text extracted from PDF successfully.");
      } catch (pdfError) {
        console.warn("Could not extract text from PDF:", uploadedFile.originalname, pdfError.message);
        extractedContent = `[Failed to extract text from PDF: ${pdfError.message}]`;
      }
    } else if (uploadedFile.mimetype.startsWith('text/')) {
        // Basic handling for plain text files (e.g., .txt, .csv, .json, .js, .html, .css etc.)
        extractedContent = uploadedFile.buffer.toString('utf8');
        console.log("Text extracted from plain text file.");
    } else {
      console.log(`No specific text extraction logic for mimetype: ${uploadedFile.mimetype}. Storing basic info.`);
      // For other file types (images, videos, binaries, etc.), we won't extract content directly
      // Instead, we'll store a placeholder with file details.
      extractedContent = `[File uploaded: ${uploadedFile.originalname}, Type: ${uploadedFile.mimetype}, Size: ${uploadedFile.size} bytes]`;
      // If you need actual text from images or more complex formats, you would integrate
      // OCR services (for images) or specialized parsing libraries here.
    }

    // Save the extracted text (or placeholder) as a new FAQ document in MongoDB
    const newFAQ = new FAQ({
      title: title,
      content: extractedContent, // Use the extracted text/placeholder as the FAQ content
    });
    await newFAQ.save();
    console.log("File FAQ saved to MongoDB successfully (extracted text/placeholder):", newFAQ);
    res.status(201).json({ message: "File uploaded and processed successfully!", faq: newFAQ });

  } catch (error) {
    console.error("Error processing file or saving FAQ:", error.message);
    res.status(500).json({ message: "Failed to process file or upload FAQ.", error: error.message });
  }
});


module.exports = router;
