import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import ChatMessage from './ChatMessage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://auwuojgyebcqiprkhizf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3Vvamd5ZWJjcWlwcmtoaXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTI3MzcsImV4cCI6MjA1Mjk4ODczN30.U1CukrPhrGKmAx5jFvn8c-M8blFDqpRXZMwYngCoM1M');

// Hardcoded demo responses
const DEMO_RESPONSES = {
  '1': {
    type: 'bot',
    content: `Here's a PR description for JIRA-123 "Implement user authentication flow":

# Pull Request: Implement User Authentication Flow

## Overview
This PR implements a secure user authentication system using JWT tokens and OAuth2.0 integration with major providers.

## Changes
- Added JWT token-based authentication
- Implemented OAuth2.0 flows for Google and GitHub
- Created secure password hashing using bcrypt
- Added user session management
- Implemented password reset flow

## Testing
- Added unit tests for authentication controllers
- Integration tests for OAuth flows
- Security testing for token management
- Load testing for concurrent authentication requests

## Related
- Closes JIRA-123
- Dependencies on JIRA-120 (User Model)
- Blocks JIRA-125 (User Settings)`
  },
  '2': {
    type: 'bot',
    content: `Here's a PR description for JIRA-456 "Implement real-time chat features":

# Pull Request: Real-time Chat Implementation

## Overview
This PR adds real-time chat functionality using WebSocket connections and implements message persistence.

## Changes
- WebSocket server implementation using Socket.io
- Message queue system for offline message handling
- Real-time typing indicators
- Message read receipts
- Message persistence in PostgreSQL

## Testing
- WebSocket connection stress tests
- Message delivery confirmation tests
- Database performance tests
- UI/UX testing for real-time updates

## Related
- Closes JIRA-456
- Dependencies on JIRA-450 (Database Schema)
- Related to JIRA-460 (Push Notifications)`
  },
  '3': {
    type: 'bot',
    content: `Generated commit message for JIRA-123:

[JIRA-123] feat: implement secure user authentication with OAuth2.0

- Add JWT token authentication
- Integrate Google & GitHub OAuth
- Implement password hashing
- Add session management
- Create password reset flow`
  },
  '4': {
    type: 'bot',
    content: `Generated commit message for JIRA-456:
    

git commit -m "feat: implement secure storage of application secrets in AWS Secrets Manager

The following key changes have been made:

- Established a secure connection to AWS Secrets Manager to store and retrieve application secrets, ensuring that sensitive data is not hard-coded in the application.
- Implemented encryption for secrets at rest and in transit, enhancing the security of sensitive information such as API keys, database credentials, and other confidential data.
- Developed a seamless interface for developers to easily add, update, and delete secrets within the AWS Secrets Manager, streamlining the management process.
- Added comprehensive logging and monitoring capabilities to track access and modifications to secrets, ensuring compliance and security auditing.
- Conducted thorough testing to validate the integration and ensure that secrets are handled securely without impacting application performance.""`
  }
};

const ChatArea = ({ conversation }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(!conversation);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add keyboard event listener for demo responses
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Check if Ctrl/Cmd + number is pressed and there's at least one message
      if ((e.ctrlKey || e.metaKey) && ['1', '2', '3', '4'].includes(e.key) && messages.length > 0) {
        e.preventDefault(); // Prevent default Ctrl/Cmd + number behavior
        const response = DEMO_RESPONSES[e.key];
        if (response) {
          setIsDemoMode(true);
          setMessages(prev => [...prev, response]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      type: 'user',
      content: message.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage(''); // Clear input
  };

  // Show welcome screen only if in demo mode and no messages
  if (isDemoMode && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to Jira Chat</h2>
          <p className="text-gray-600 mb-4">Start a new conversation to begin</p>
          
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Chat Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white">
              <span className="text-white text-lg font-semibold">J</span>
            </div>
            <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              {conversation?.title || 'Demo Chat'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-white/90 rounded-lg transition-all duration-200 group"
            >
              <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent hover:scrollbar-thumb-blue-300">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <div key={index} className="mb-6 animate-fade-in">
              <ChatMessage type={msg.type} message={msg.content} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Type your message here...`}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white/50 backdrop-blur-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center space-x-2"
            >
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatArea; 