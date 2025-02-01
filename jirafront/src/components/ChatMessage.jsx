import React from 'react';
import ReactMarkdown from 'react-markdown';

const formatMessage = (message) => {
  // Clean up the message by removing escape characters and extra whitespace
  message = message.replace(/^"|"$/g, ''); // Remove leading and trailing double quotes
  const cleanMessage = message
    .replace(/\\n/g, '\n') // Replace \n with actual newlines
    .replace(/\\/g, '') // Remove remaining backslashes
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newlines
    .trim();

  // Split into introduction and items
  const parts = cleanMessage.split('\n\n');
  const introduction = parts[0];
  const itemsList = parts.slice(1).join('\n');
  
  return {
    introduction,
    items: itemsList.split('\n-').filter(item => item.trim())
  };
};

const ChatMessage = ({ type, message }) => {
  const isBot = type === 'bot';
  const formattedContent = isBot ? formatMessage(message) : { introduction: message, items: [] };

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} group`}>
      <div
        className={`max-w-[80%] rounded-2xl p-4 ${
          isBot
            ? 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg'
        } transition-all duration-200`}
      >
        {isBot && (
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-medium">J</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-800">Jira Assistant</span>
              <p className="text-xs text-gray-500">AI Powered</p>
            </div>
          </div>
        )}
        <div className={`relative ${isBot ? 'text-gray-700' : 'text-white'}`}>
          {isBot ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  // Customize heading styles
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2" {...props} />,
                  // Customize paragraph styles
                  p: ({node, ...props}) => <p className="text-sm leading-relaxed mb-2" {...props} />,
                  // Customize list styles
                  ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="text-sm leading-relaxed" {...props} />,
                  // Customize code block styles
                  code: ({node, inline, ...props}) => 
                    inline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props} />
                    ) : (
                      <code className="block bg-gray-100 p-2 rounded-lg text-sm font-mono my-2 whitespace-pre-wrap" {...props} />
                    ),
                }}
              >
                {formattedContent.introduction}
              </ReactMarkdown>
              {formattedContent.items.length > 0 && (
                <ul className="space-y-2">
                  {formattedContent.items.map((item, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-500 mt-1.5">•</span>
                      <span className="text-sm leading-relaxed">{item.trim()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message}</p>
          )}
          <div className={`absolute -bottom-4 ${isBot ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <div className="flex items-center space-x-2 text-gray-400">
              <button className="p-1 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5h8a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              </button>
              <button className="p-1 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 