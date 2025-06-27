const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const FAQ = require("../models/FAQ");
const axios = require("axios");
const dotenv = require("dotenv");
const multer = require('multer');
const pdf = require('pdf-parse');

dotenv.config();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("GEMINI_API_KEY loaded:", GEMINI_API_KEY ? "YES (key present)" : "NO (key is undefined/empty)");

const upload = multer({ storage: multer.memoryStorage() });

// Helper function to normalize text for comparison
const normalizeText = (text) => {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

// Simple keyword matching function
const findRelevantFaqs = (query, faqs, minScore = 0.3) => {
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2);

    const scoredFaqs = faqs.map(faq => {
        let score = 0;
        const normalizedTitle = normalizeText(faq.title);
        const normalizedContent = normalizeText(faq.content);

        queryWords.forEach(word => {
            if (normalizedTitle.includes(word)) {
                score += 2;
            } else if (normalizedContent.includes(word)) {
                score += 1;
            }
        });

        if (normalizedTitle.includes(normalizedQuery) && normalizedQuery.length > 5) {
            score += 5;
        }
        if (normalizedContent.includes(normalizedQuery) && normalizedQuery.length > 5) {
            score += 2;
        }

        if (faq.title.toLowerCase().includes(query.toLowerCase())) {
            score += 3;
        }
        if (faq.content.toLowerCase().includes(query.toLowerCase())) {
            score += 1;
        }

        return { faq, score };
    });

    const relevantFaqs = scoredFaqs
        .filter(item => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .map(item => item.faq);

    return relevantFaqs.slice(0, 3);
};


// --- CHAT ROUTE (for user messages) ---
router.post("/", async (req, res) => {
    const { userId, message } = req.body;

    console.log("Received chat request for userId:", userId, "message:", message);

    if (!userId || !message) {
        console.log("Validation failed: User ID or message missing.");
        return res.status(400).json({ reply: "User ID and message are required." });
    }

    try {
        const faqs = await FAQ.find({});
        console.log(`Fetched ${faqs.length} FAQs.`);

        const relevantFaqs = findRelevantFaqs(message, faqs);
        let faqContextForGemini = "";

        if (relevantFaqs.length > 0) {
            faqContextForGemini = relevantFaqs.map(faq => `Q: ${faq.title}\nA: ${faq.content}`).join("\n\n---\n\n");
            console.log(`Found ${relevantFaqs.length} relevant FAQs based on keywords.`);
        } else {
            console.log("No highly relevant FAQs found using keyword matching. Relying more on general knowledge.");
        }

        let chat = await Chat.findOne({ userId });
        let chatHistory = [];
        if (chat && chat.messages) {
            let currentChatHistory = chat.messages.filter(m => ['user', 'ai'].includes(m.sender));
            if (currentChatHistory.length > 0 && currentChatHistory[currentChatHistory.length - 1].sender === 'user') {
                currentChatHistory = currentChatHistory.slice(-6);
            } else {
                currentChatHistory = currentChatHistory.slice(-5);
            }

            chatHistory = currentChatHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));
            console.log("Fetched chat history. Messages count:", chatHistory.length);
        } else {
            console.log("No existing chat history found for userId:", userId);
        }

        // --- UPDATED SYSTEM INSTRUCTION ---
        const systemInstruction = `You are Dhanista, a helpful and knowledgeable AI assistant. Your primary goal is to answer user questions accurately and comprehensively.

        **Instructions:**
        1.  **Prioritize the provided relevant FAQs.** If the user's question can be answered by the information in "Relevant FAQs:", use that information directly and comprehensively.
        2.  If the "Relevant FAQs:" section is empty or does not sufficiently answer the question, attempt to answer using your general knowledge.
        3.  **Crucially:** If you cannot find relevant information in the FAQs AND your general knowledge is insufficient, *do not say you don't have enough information*. Instead, acknowledge the query and politely suggest rephrasing or mention that the specific information might not be available in your current knowledge base. For example: "I don't have specific information on that topic in my current knowledge base. Could you please rephrase your question or ask about something else?" or "The information you're looking for might not be in my FAQs. Can I help with anything else?"
        4.  Maintain a friendly and professional tone.

        ${faqContextForGemini ? `**Relevant FAQs:**\n${faqContextForGemini}\n\n` : ''}`;

        const payload = {
            contents: [
                { role: "user", parts: [{ text: systemInstruction }] },
                ...chatHistory,
                { role: "user", parts: [{ text: message }] }
            ],
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 500,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
        };
        console.log("Sending payload to Gemini API. Payload (first 500 chars):", JSON.stringify(payload, null, 2).substring(0, 500) + "...");

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

        let reply = "I'm sorry, I couldn't process your request at this moment. Please try again or rephrase your question."; // Default fallback

        if (response.data && response.data.candidates && response.data.candidates.length > 0 &&
            response.data.candidates[0].content && response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0) {
            reply = response.data.candidates[0].content.parts[0].text;
            console.log("Extracted AI Reply:", reply);
        } else {
            console.error("Gemini API response was empty or malformed:", JSON.stringify(response.data, null, 2));
            reply = "I received an empty or unclear response from the AI. Please try again or ask your question in a different way.";
        }

        if (!chat) {
            chat = new Chat({ userId, messages: [] });
        }
        chat.messages.push({ sender: "user", content: message });
        chat.messages.push({ sender: "ai", content: reply });
        await chat.save();
        console.log("Chat history saved to MongoDB.");

        res.json({ reply });

    } catch (error) {
        console.error("Error interacting with Gemini API or MongoDB:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        let userFacingError = "An unexpected error occurred. Please try again later or contact support if the issue persists.";

        if (error.response) {
            if (error.response.status === 400 && error.response.data.error && error.response.data.error.message.includes("safety")) {
                userFacingError = "I cannot answer that question as it violates my safety guidelines. Please rephrase your query.";
            } else if (error.response.status === 400) {
                userFacingError = "There was an issue with your request. This might be due to an invalid input or API problem. Please try again.";
            } else if (error.response.status === 401 || error.response.status === 403) {
                userFacingError = "Authentication failed with the AI service. Please check the API key configuration on the server.";
            } else if (error.response.status === 500) {
                userFacingError = "The AI service encountered an internal error. Please try again in a few moments.";
            } else {
                 userFacingError = `I'm encountering a problem processing your request (Status: ${error.response.status}). Please try again.`;
            }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            userFacingError = "I'm having trouble connecting to the AI service. Please check your network connection or try again later.";
        } else if (error.message.includes("API key not valid")) { // More specific check for common API key issue
             userFacingError = "There's an issue with the API key. Please ensure it's correctly configured on the server.";
        }


        // Fallback message to prevent "Oops!" if all else fails
        res.status(500).json({ reply: userFacingError });
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
router.post("/upload-file-faq", upload.single('file'), async (req, res) => {
    const { title } = req.body;
    const uploadedFile = req.file;

    console.log("Received generic file upload request. Title:", title, "File:", uploadedFile ? uploadedFile.originalname : "No file");

    if (!title || !uploadedFile) {
        console.log("Validation failed: FAQ Title or file missing.");
        return res.status(400).json({ message: "FAQ title and file are required." });
    }

    let extractedContent = '';

    try {
        if (uploadedFile.mimetype === 'application/pdf') {
            try {
                const data = await pdf(uploadedFile.buffer);
                extractedContent = data.text;
                console.log("Text extracted from PDF successfully.");
            } catch (pdfError) {
                console.warn("Could not extract text from PDF:", uploadedFile.originalname, pdfError.message);
                extractedContent = `[Failed to extract text from PDF: ${pdfError.message}]`;
            }
        } else if (uploadedFile.mimetype.startsWith('text/')) {
            extractedContent = uploadedFile.buffer.toString('utf8');
            console.log("Text extracted from plain text file.");
        } else {
            console.log(`No specific text extraction logic for mimetype: ${uploadedFile.mimetype}. Storing basic info.`);
            extractedContent = `[File uploaded: ${uploadedFile.originalname}, Type: ${uploadedFile.mimetype}, Size: ${uploadedFile.size} bytes]`;
        }

        const newFAQ = new FAQ({
            title: title,
            content: extractedContent,
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