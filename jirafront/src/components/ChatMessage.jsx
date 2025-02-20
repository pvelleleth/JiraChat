import React from 'react';
import ReactMarkdown from 'react-markdown';

const formatMessage = (message) => {
  // Clean up the message by removing escape characters and extra whitespace
  message = message.replace(/^"|"$/g, ''); // Remove leading and trailing double quotes
  /*
  const cleanMessage = message
    .replace(/\\n/g, '\n') // Replace \n with actual newlines
    .replace(/\\/g, '') // Remove remaining backslashes
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newlines
    .trim();
  */
  const cleanMessage = message
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
            ? 'bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm hover:shadow-md'
            : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg'
        } transition-all duration-200 hover:scale-[1.01]`}
      >
        {isBot && (
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm ring-2 ring-white">
              <span className="text-white text-base font-medium">J</span>
            </div>
            <div>
              <span className="text-base font-medium bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">Jira Assistant</span>
              <p className="text-sm text-gray-500">AI Powered</p>
            </div>
          </div>
        )}
        <div className={`relative ${isBot ? 'text-gray-700' : 'text-white'}`}>
          {isBot ? (
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent" {...props} />,
                  p: ({node, ...props}) => <p className="text-base leading-relaxed mb-4" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-3 mb-4" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-3 mb-4" {...props} />,
                  li: ({node, ...props}) => <li className="text-base leading-relaxed" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline ? (
                      <code className="bg-blue-50/50 px-2 py-0.5 rounded text-base font-mono text-blue-700" {...props} />
                    ) : (
                      <code className="block bg-blue-50/50 p-4 rounded-lg text-base font-mono my-4 text-blue-700 whitespace-pre-wrap" {...props} />
                    ),
                  a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-700 underline" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-200 pl-4 italic text-gray-600 text-base" {...props} />,
                  table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200" {...props} /></div>,
                  th: ({node, ...props}) => <th className="px-4 py-3 bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider" {...props} />,
                  td: ({node, ...props}) => <td className="px-4 py-3 whitespace-nowrap text-base text-gray-500" {...props} />,
                }}
              >
                {formattedContent.introduction}
              </ReactMarkdown>
              {formattedContent.items.length > 0 && (
                <ul className="space-y-3">
                  {formattedContent.items.map((item, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-500 mt-1.5 text-lg">•</span>
                      <span className="text-base leading-relaxed">{item.trim()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-base leading-relaxed">{message}</p>
          )}
          <div className={`absolute -bottom-4 ${isBot ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <div className="flex items-center space-x-2 text-gray-400">
              <button className="p-1 hover:text-blue-600 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5h8a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              </button>
              <button className="p-1 hover:text-blue-600 transition-colors duration-200">
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