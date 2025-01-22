import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://auwuojgyebcqiprkhizf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3Vvamd5ZWJjcWlwcmtoaXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTI3MzcsImV4cCI6MjA1Mjk4ODczN30.U1CukrPhrGKmAx5jFvn8c-M8blFDqpRXZMwYngCoM1M');

const Sidebar = ({ onNewChat, onSelectChat, currentConversationId }) => {
  const [conversations, setConversations] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Fetch conversations
    const fetchConversations = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        setConversations(data);
      }
    };

    fetchConversations();

    // Subscribe to changes
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations' 
        }, 
        fetchConversations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleNewChat = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          user_id: user.id,
          title: 'New Conversation',
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
    } else {
      onNewChat(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen w-72 bg-gradient-to-b from-white to-blue-50 border-r border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold">J</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text">
            Jira Chat
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center space-x-3 text-left px-4 py-3 rounded-xl hover:bg-white hover:shadow-md text-gray-700 hover:text-blue-600 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Chat</span>
          </button>
          
          {/* Conversations List */}
          <div className="border-t border-gray-200 my-4"></div>
          
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv)}
                className={`w-full flex items-center space-x-3 text-left px-4 py-3 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200 ${
                  currentConversationId === conv.id 
                    ? 'bg-white shadow-md text-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="truncate">{conv.title}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 bg-white border-t border-gray-200">
          <div 
            onClick={handleSignOut}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
              <span className="text-white font-medium">{user.email[0].toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{user.email}</p>
              <p className="text-xs text-gray-500">Sign out</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar; 