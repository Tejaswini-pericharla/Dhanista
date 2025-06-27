import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios'; // Import axios for API calls

// === Modal Component ===
// This component renders a custom modal for alerts and messages.
const Modal = ({ show, title, message, onClose }) => {
  if (!show) {
    return null; // Don't render if 'show' prop is false
  }

  return (
    // Fixed overlay covering the entire screen
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      {/* Modal content box with styling and animation */}
      <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-sm w-full animate-fade-in-up">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <button
          onClick={onClose} // Button to close the modal
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ease-in-out"
        >
          OK
        </button>
      </div>
    </div>
  );
};


// === components/MessageBubble.js ===
// Renders a single chat message bubble within the chat interface.
const MessageBubble = ({ sender, content }) => (
  <div
    // Dynamically apply styles based on sender for user (blue) or AI (green) messages
    // animate-fade-in provides a subtle entrance animation for new messages
    className={`max-w-[70%] p-3 m-2 rounded-xl shadow-md animate-fade-in ${
      sender === 'user' ? 'bg-blue-500 text-white self-end text-right' : 'bg-green-100 text-gray-800 self-start text-left'
    }`}
  >
    <p className="break-words">{content}</p> {/* Display message content */}
  </div>
);

// === components/ChatBox.js ===
// Main chat interface component handling message display and input.
const ChatBox = ({ messages, addMessage }) => {
  const [input, setInput] = useState(""); // State to store the current user input message
  const [isTyping, setIsTyping] = useState(false); // State to control the AI typing indicator
  const chatEndRef = useRef(null); // Ref to enable auto-scrolling to the latest message

  // Simulate a fixed user ID for demonstration purposes.
  const userId = "demo_user_123";

  // RECTIFIED: Set API_BASE_URL based on environment
  const API_BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

  // useEffect hook to scroll to the bottom of the chat box whenever the messages array changes.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // useEffect hook to fetch initial chat history when the component mounts.
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        // Placeholder for fetching chat history if a GET /api/chat/:userId endpoint existed.
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };
    fetchChatHistory();
  }, []); // Empty dependency array ensures this effect runs only once on mount.

  // useCallback hook for the sendMessage function to prevent unnecessary re-renders.
  // Handles sending the user's message to the backend and receiving the AI's reply.
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return; // Do nothing if the input message is empty or just whitespace.

    const userMessage = input.trim();
    addMessage({ sender: "user", content: userMessage }); // Add user's message to the UI immediately.
    setInput(""); // Clear the input field.
    setIsTyping(true); // Show the "AI is typing..." indicator.

    try {
      // Make a POST request to the backend's chat API.
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        userId,
        message: userMessage,
      });

      const aiReply = response.data.reply; // Extract the AI's reply from the response.
      addMessage({ sender: "ai", content: aiReply }); // Add the AI's reply to the UI.
    } catch (error) {
      console.error("Error sending message:", error); // Log any errors during the API call.
      addMessage({ sender: "ai", content: "Oops! Something went wrong. Please try again." }); // Display a generic error message to the user.
    } finally {
      setIsTyping(false); // Hide the typing indicator regardless of success or failure.
    }
  }, [input, addMessage, API_BASE_URL]); // Dependencies: 'input', 'addMessage', and API_BASE_URL

  return (
    // Removed 'md:' prefix from animate-fade-in-left to apply on all screen sizes
    <div className="flex flex-col border border-blue-300 rounded-lg shadow-lg bg-white p-4 max-w-3xl mx-auto mb-8 animate-fade-in-left w-full">
      <h3 className="text-xl font-semibold mb-4 text-center text-blue-700">Chat with Dhanista</h3>
      <div className="flex flex-col h-80 overflow-y-auto mb-4 p-2 border border-blue-200 rounded-md bg-blue-50 custom-scrollbar">
        {/* Conditional rendering for an empty chat state */}
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-auto mb-auto">Start a conversation!</p>
        )}
        {/* Map through messages and render MessageBubble for each */}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} sender={msg.sender} content={msg.content} />
        ))}
        {/* AI typing indicator, pulsates when AI is responding */}
        {isTyping && (
          <div className="self-start text-gray-500 italic p-3 m-2 rounded-xl bg-gray-100 animate-pulse">
            AI is typing...
          </div>
        )}
        <div ref={chatEndRef} /> {/* Element for auto-scrolling to the bottom */}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:shadow-lg transition-shadow text-gray-700"
        />
        <button
          onClick={sendMessage}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ease-in-out"
        >
          Send
        </button>
      </div>
    </div>
  );
};

// === components/AdminUpload.js ===
// Component for admin to upload FAQ content, supporting both text and various file types.
const AdminUpload = ({ onClose, onUploadSuccess }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // RECTIFIED: Set API_BASE_URL based on environment
  const API_BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

  // Function to display the custom modal with a specific message.
  const showCustomModal = (msg) => {
    console.log("Attempting to show modal with message:", msg); // DEBUG LOG
    setModalMessage(msg);
    setShowModal(true);
  };

  // Function to hide the custom modal and clear its message.
  const closeCustomModal = () => {
    setShowModal(false);
    setModalMessage("");
  };

  // useCallback hook for the upload function to prevent unnecessary re-renders.
  // Handles uploading either text-based FAQ content or a selected file (PDF, JPG, etc.).
  const upload = useCallback(async () => {
    setMessage(""); // Clear any previous general messages.
    closeCustomModal(); // Ensure the modal is closed before attempting a new upload.

    // --- Input Validation ---
    if (!title.trim()) {
      showCustomModal("FAQ Title cannot be empty! Please provide a title.");
      return; // Stop the upload process if title is missing.
    }

    if (!content.trim() && !file) {
      showCustomModal("Please provide either FAQ Content or upload a file.");
      return; // Stop the upload process if both text content and file are missing.
    }
    // --- End Input Validation ---

    try {
      let uploadEndpoint = `${API_BASE_URL}/api/chat/faqs`; // Default endpoint for text FAQ uploads.
      let payload = { title, content }; // Default payload for text FAQ uploads.
      let headers = { 'Content-Type': 'application/json' }; // Default headers for JSON payload.

      if (file) {
        // If a file is selected, switch to the file upload endpoint and use FormData.
        uploadEndpoint = `${API_BASE_URL}/api/chat/upload-file-faq`; // Endpoint for generic file uploads.
        const formData = new FormData(); // FormData is required for sending files.
        formData.append('title', title); // Append the title.
        formData.append('file', file); // Append the file itself. The name 'file' must match backend's multer config.
        payload = formData; // Set the payload to FormData.
        headers = {}; // Axios automatically sets 'Content-Type': 'multipart/form-data' when sending FormData, so no manual header is needed here.
        setMessage("File upload initiated. Text will be extracted from supported file types (e.g., PDF, plain text)."); // Inform user about file processing.

      } else {
        // If no file is selected, proceed with text content upload.
        setMessage("FAQ upload initiated."); // Inform user about text upload.
      }

      // Perform the API call using axios.post.
      const response = await axios.post(uploadEndpoint, payload, { headers });

      // Check the backend's response message for success.
      if (response.data.message && response.data.message.includes("successfully")) {
        setMessage(response.data.message); // Display the success message from the backend.
        // Clear input fields and selected file after successful upload.
        setTitle("");
        setContent("");
        setFile(null);
        if (onUploadSuccess) {
          onUploadSuccess(); // Call the callback to hide the admin panel if provided.
        }
      } else {
          // Fallback message if backend response doesn't explicitly include "successfully" but also didn't throw an error.
          setMessage(response.data.message || "Upload completed with an unexpected message.");
      }

    } catch (error) {
      // Handle errors during the upload process (network issues, backend errors, etc.).
      console.error("Error uploading FAQ:", error.response ? error.response.data : error.message);
      const errorMessage = error.response && error.response.data && error.response.data.message
                             ? error.response.data.message // Use error message from backend if available
                             : "Failed to upload FAQ. Please check your network and try again."; // Generic error message
      setMessage(errorMessage); // Display error message to the user.
      showCustomModal(errorMessage); // Also show the error in the custom modal for prominent display.
    } finally {
      // Clear the general message after a delay, regardless of success or failure.
      setTimeout(() => setMessage(""), 5000);
    }
  }, [title, content, file, onUploadSuccess, API_BASE_URL]); // Added API_BASE_URL to dependencies for useCallback.

  // handleFileChange function processes the selected file from the input.
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]; // Get the first file selected by the user.
    if (selectedFile) {
      setFile(selectedFile); // Set the selected file to state.
      setContent(""); // Clear any text content if a file is selected (prioritize file).
      setMessage(""); // Clear any previous general messages.
      closeCustomModal(); // Close the modal if open, as the user is now interacting with file input.
    } else {
      setFile(null); // Clear file state if no file is selected.
    }
  };

  return (
    // Removed 'md:' prefix from animate-fade-in-right to apply on all screen sizes
    <div className="flex flex-col border border-green-300 rounded-lg shadow-lg bg-white p-4 max-w-3xl mx-auto animate-fade-in-right w-full">
      <h3 className="text-xl font-semibold mb-4 text-center text-green-700">Admin - Upload FAQs</h3>
      <input
        type="text"
        placeholder="FAQ Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="mb-3 p-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:shadow-lg transition-shadow text-gray-700"
      />
      <textarea
        placeholder="FAQ Content (or leave blank if uploading file)"
        value={content}
        onChange={e => { setContent(e.target.value); setFile(null); }}
        rows="5"
        disabled={!!file}
        className="mb-4 p-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 resize-y focus:shadow-lg transition-shadow text-gray-700 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
      />

      <div className="mb-4">
        <label htmlFor="file-upload" className="block text-gray-700 text-sm font-bold mb-2">
          Upload File (Optional):
        </label>
        <input
          type="file"
          id="file-upload"
          accept="*/*"
          onChange={handleFileChange}
          disabled={!!content.trim()}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
        />
        {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>}
      </div>

      <button
        onClick={upload}
        disabled={!content.trim() && !file}
        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-200 ease-in-out"
      >
        {file ? 'Upload File FAQ' : 'Upload Text FAQ'}
      </button>
      {message && (
        <p className={`mt-4 text-center font-medium ${message.includes("successfully") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
      <button
        onClick={onClose}
        className="mt-6 px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus://ring-purple-400 transition duration-200 ease-in-out"
      >
        Back to Chat
      </button>

      <Modal
        show={showModal}
        title="Input Required"
        message={modalMessage}
        onClose={closeCustomModal}
      />
    </div>
  );
};

// Main application component
function App() {
  const [messages, setMessages] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isCogSpinning, setIsCogSpinning] = useState(false);

  const addMessage = useCallback((message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  }, []);

  const handleUploadSuccess = useCallback(() => {
    setShowAdminPanel(false);
  }, []);

  const handleCogClick = () => {
    setShowAdminPanel(true);
    setIsCogSpinning(true);

    setTimeout(() => {
      setIsCogSpinning(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-100 p-8 font-inter">
      {/* Tailwind CSS CDN for utility classes */}
      <script src="https://cdn.tailwindcss.com"></script>
      {/* Google Font link for 'Inter' typeface */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      {/* Custom CSS for body font and scrollbar styling */}
      <style>
        {`
        body {
          font-family: 'Inter', sans-serif;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #fff7ed;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fbcfe8;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f472b6;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }

        @keyframes fade-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in-left {
          animation: fade-in-left 0.8s ease-out forwards;
        }

        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in-right {
          animation: fade-in-right 0.8s ease-out forwards;
        }

        button {
            transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out;
        }
        button:hover {
            transform: translateY(-1px);
        }

        @keyframes spin-once {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-once {
          animation: spin-once 0.5s ease-out forwards;
        }

        @keyframes title-pop-in {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(-20px);
          }
          80% {
            opacity: 1;
            transform: scale(1.05) translateY(0);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-title-pop-in {
          animation: title-pop-in 0.8s ease-out forwards;
        }

        @keyframes color-cycle {
          0% { color: #f87171; }
          25% { color: #60a5fa; }
          50% { color: #34d399; }
          75% { color: #facc15; }
          100% { color: #f87171; }
        }
        .animate-color-cycle {
          animation: color-cycle 4s linear infinite;
        }
        `}
      </style>
      <header className="text-center mb-10 relative">
        <h1 className="text-4xl font-bold mb-2 animate-title-pop-in animate-color-cycle">Hello! I'm Dhanista, your helpful AI assistant</h1>
        <p className="text-gray-600 text-lg">Your instant connection to answers.</p>

        <button
          onClick={handleCogClick}
          className={`absolute top-4 right-4 p-2 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded-full shadow-md transition-colors duration-200 ${isCogSpinning ? 'animate-spin-once' : ''}`}
          aria-label="Open Admin Panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <div className={showAdminPanel ? "grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto" : "flex justify-center max-w-6xl mx-auto"}>
        <ChatBox messages={messages} addMessage={addMessage} />
        {showAdminPanel && <AdminUpload onClose={() => setShowAdminPanel(false)} onUploadSuccess={handleUploadSuccess} />}
      </div>
    </div>
  );
}

export default App;