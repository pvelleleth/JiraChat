import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';

function App() {
  const [currentConversation, setCurrentConversation] = useState(null);

  const handleNewChat = (conversation) => {
    setCurrentConversation(conversation);
  };

  const handleSelectChat = (conversation) => {
    setCurrentConversation(conversation);
  };

  return (
    <div className="flex w-full h-screen bg-gray-50">
      <Sidebar 
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentConversationId={currentConversation?.id}
      />
      <ChatArea conversation={currentConversation} />
    </div>
  );
}

export default App;
