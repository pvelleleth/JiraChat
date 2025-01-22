import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://auwuojgyebcqiprkhizf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3Vvamd5ZWJjcWlwcmtoaXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTI3MzcsImV4cCI6MjA1Mjk4ODczN30.U1CukrPhrGKmAx5jFvn8c-M8blFDqpRXZMwYngCoM1M');

const ChatArea = ({ conversation }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!conversation || !user) return;

      // First verify this conversation belongs to the current user
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', conversation.id)
        .single();

      if (convError) {
        console.error('Error verifying conversation ownership:', convError);
        return;
      }

      if (convData.user_id !== user.id) {
        console.error('Unauthorized access to conversation');
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    };

    if (user) {
      fetchMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel(`messages:${conversation?.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${conversation?.id}` 
          }, 
          (payload) => {
            setMessages(currentMessages => [...currentMessages, payload.new]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversation, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || !conversation || !user) return;

    // Verify conversation ownership before sending message
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversation.id)
      .single();

    if (convError || convData.user_id !== user.id) {
      console.error('Unauthorized access to conversation');
      return;
    }

    try {
      setIsLoading(true);
      const userMessageContent = message.trim();
      setMessage(''); // Clear input early

      // Save user message to database and update local state immediately
      const { data: userMessageData, error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          content: userMessageContent,
          type: 'user'
        }])
        .select()
        .single();

      if (messageError) throw messageError;
      
      // Update local state with user message
      setMessages(currentMessages => [...currentMessages, userMessageData]);

      // Call the API
      const response = await fetch(`http://localhost:8000/answer?question=${encodeURIComponent(userMessageContent)}`);
      const botResponse = await response.text();

      // Save bot response to database and update local state immediately
      const { data: botMessageData, error: botError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          content: botResponse,
          type: 'bot'
        }])
        .select()
        .single();

      if (botError) throw botError;
      
      // Update local state with bot message
      setMessages(currentMessages => [...currentMessages, botMessageData]);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = userMessageContent.length > 30 ? userMessageContent.substring(0, 30) + '...' : userMessageContent;
        const { error: titleError } = await supabase
          .from('conversations')
          .update({ title })
          .eq('id', conversation.id)
          .eq('user_id', user.id); // Ensure we only update if user owns the conversation

        if (titleError) throw titleError;
      }

    } catch (error) {
      console.error('Error handling message:', error);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: "I'm sorry, I encountered an error while processing your request. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to Jira Chat</h2>
          <p className="text-gray-600">Start a new conversation to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-800">{conversation.title}</h2>
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <div key={msg.id || index} className="mb-6">
              <ChatMessage type={msg.type} message={msg.content} />
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm animate-pulse">
                  <span className="text-white text-sm font-medium">J</span>
                </div>
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all pl-12"
                disabled={isLoading}
              />
              <svg 
                className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <button
              type="submit"
              className={`bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center space-x-2 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
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