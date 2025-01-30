import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://auwuojgyebcqiprkhizf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3Vvamd5ZWJjcWlwcmtoaXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTI3MzcsImV4cCI6MjA1Mjk4ODczN30.U1CukrPhrGKmAx5jFvn8c-M8blFDqpRXZMwYngCoM1M');

const Sidebar = ({ onNewChat, onSelectChat, currentConversationId }) => {
  const [conversations, setConversations] = useState([]);
  const [user, setUser] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        setConversations(data || []);
      }
    };

    if (user) {
      fetchConversations();

      // Subscribe to changes for current user's conversations only
      const channel = supabase
        .channel(`conversations:${user.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'conversations',
            filter: `user_id=eq.${user.id}`
          }, 
          fetchConversations
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
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

  const handleContextMenu = (e, conversation) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      conversation
    });
  };

  const handleDeleteConversation = async (conversation) => {
    if (!user) return;

    try {
      // First delete all messages in the conversation
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversation.id);

      if (messagesError) throw messagesError;

      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id)
        .eq('user_id', user.id);

      if (conversationError) throw conversationError;

      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversation.id));
      setContextMenu(null);

      // If this was the current conversation, clear it
      if (currentConversationId === conversation.id) {
        onSelectChat(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen w-72 bg-gradient-to-b from-white via-blue-50/50 to-indigo-50/50 border-r border-gray-200 flex flex-col shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 text-transparent bg-clip-text">
            Jira Chat
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent hover:scrollbar-thumb-blue-300">
        <div className="space-y-2">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center space-x-3 text-left px-4 py-3 rounded-xl hover:bg-white/80 hover:shadow-md text-gray-700 hover:text-blue-600 transition-all duration-200 group"
          >
            <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="font-medium">New Chat</span>
          </button>
          
          {/* Conversations List */}
          <div className="border-t border-gray-200/70 my-4"></div>
          
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv)}
                onContextMenu={(e) => handleContextMenu(e, conv)}
                className={`w-full flex items-center space-x-3 text-left px-4 py-3 rounded-xl hover:bg-white/80 hover:shadow-md transition-all duration-200 group ${
                  currentConversationId === conv.id 
                    ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="truncate font-medium">{conv.title}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200 sticky bottom-0">
          <div 
            onClick={handleSignOut}
            className="flex items-center space-x-3 p-3 rounded-xl hover:bg-blue-50/80 transition-all duration-200 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md ring-2 ring-white transition-transform duration-200 group-hover:scale-105">
              <span className="text-white font-medium">{user.email[0].toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{user.email}</p>
              <p className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors">Sign out</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-all duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white/90 backdrop-blur-sm rounded-lg shadow-lg py-2 w-48 border border-gray-200 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleDeleteConversation(contextMenu.conversation)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50/80 flex items-center space-x-2 group transition-colors duration-200"
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete Conversation</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar; 