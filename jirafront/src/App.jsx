import React from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';

function App() {
  return (
    <div className="flex w-full h-screen bg-gray-50">
      <Sidebar />
      <ChatArea />
    </div>
  );
}

export default App;
