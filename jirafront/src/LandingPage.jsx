import React from 'react';

const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-800">
      {/* Hero Section with Aurora Background */}
      <section className="relative flex flex-col items-center justify-center text-center h-screen overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-800 to-blue-600">
        {/* Aurora-like Decorative Blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-indigo-500 to-blue-400 rounded-full opacity-30 blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full opacity-20 blur-3xl animate-ping" />
        <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-gradient-to-br from-indigo-700 to-blue-500 rounded-full opacity-30 blur-3xl animate-pulse -translate-x-1/2" />
        
        {/* Hero Content */}
        <div className="relative z-10 px-6 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg leading-tight">
            JIRA Chat Bot
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-white drop-shadow-sm max-w-xl mx-auto">
            Streamline your JIRA workflows with an intelligent assistant that automates tasks and boosts your productivity.
          </p>
          <div className="mt-8">
            <a
              href="#get-started"
              className="inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="get-started" className="bg-white py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-700">Powerful Features</h2>
          <p className="text-gray-600 mt-4 mb-12">
            Transform JIRA interactions with AI-driven insights and automation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 bg-blue-50 rounded-xl shadow hover:shadow-lg transition-shadow">
              <div className="text-blue-600 mb-4 text-4xl">
                <i className="fas fa-comments"></i>
              </div>
              <h3 className="text-xl font-semibold text-blue-700 mb-2">Smart Conversations</h3>
              <p className="text-gray-600">
                Get immediate context-based chat support for your JIRA tasks and tickets.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="p-6 bg-blue-50 rounded-xl shadow hover:shadow-lg transition-shadow">
              <div className="text-blue-600 mb-4 text-4xl">
                <i className="fas fa-robot"></i>
              </div>
              <h3 className="text-xl font-semibold text-blue-700 mb-2">AI Automation</h3>
              <p className="text-gray-600">
                Automatically fill in ticket details, assign tasks, and schedule sprints with a simple command.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="p-6 bg-blue-50 rounded-xl shadow hover:shadow-lg transition-shadow">
              <div className="text-blue-600 mb-4 text-4xl">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3 className="text-xl font-semibold text-blue-700 mb-2">Analytics & Reporting</h3>
              <p className="text-gray-600">
                Gain real-time insights into project progress, bottlenecks, and user interactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-800 to-indigo-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold">Ready to Supercharge Your JIRA?</h2>
          <p className="mt-4 text-lg text-gray-100">
            Sign up now and experience seamless project management with an intelligent chatbot.
          </p>
          <div className="mt-8">
            <button className="bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
              Try for Free
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 mt-auto">
        <div className="max-w-5xl mx-auto text-center text-gray-500">
          <p>© {new Date().getFullYear()} JIRA Chat Bot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;