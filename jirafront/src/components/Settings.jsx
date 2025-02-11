import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router';

const supabase = createClient('https://auwuojgyebcqiprkhizf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3Vvamd5ZWJjcWlwcmtoaXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MTI3MzcsImV4cCI6MjA1Mjk4ODczN30.U1CukrPhrGKmAx5jFvn8c-M8blFDqpRXZMwYngCoM1M');

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    jiraToken: '',
    jiraDomain: '',
    jiraEmail: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      // Fetch user's Jira settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSettings({
          jiraToken: data.jira_token || '',
          jiraDomain: data.jira_domain || '',
          jiraEmail: data.jira_email || ''
        });
      }
    };
    getUser();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // First, store the Jira token in the vault
      const { data: secret, error: vaultError } = await supabase.rpc(
        'create_jira_token_secret',
        { 
          user_id: user.id,
          token: settings.jiraToken
        }
      );

      if (vaultError) throw vaultError;

      // Then store the other settings in the user_settings table
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          jira_domain: settings.jiraDomain,
          jira_email: settings.jiraEmail,
          jira_token_secret_id: secret // ID of the vault secret
        });

      if (settingsError) throw settingsError;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:8000/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jira_token: settings.jiraToken,
          jira_domain: settings.jiraDomain,
          jira_email: settings.jiraEmail
        })
      });

      if (!response.ok) throw new Error('Failed to sync with Jira');

      setMessage({ type: 'success', text: 'Successfully synced with Jira!' });
    } catch (error) {
      console.error('Error syncing with Jira:', error);
      setMessage({ type: 'error', text: 'Failed to sync with Jira. Please check your settings and try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-200">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-8">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>

          {/* User Info */}
          {user && (
            <div className="mb-8 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md ring-2 ring-white">
                  <span className="text-white text-lg font-medium">{user.email[0].toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{user.email}</h2>
                  <p className="text-sm text-gray-500">Logged in with Supabase</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jira Domain
              </label>
              <input
                type="text"
                value={settings.jiraDomain}
                onChange={(e) => setSettings(prev => ({ ...prev, jiraDomain: e.target.value }))}
                placeholder="your-domain.atlassian.net"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jira Email
              </label>
              <input
                type="email"
                value={settings.jiraEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, jiraEmail: e.target.value }))}
                placeholder="your.email@company.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jira API Token
              </label>
              <input
                type="password"
                value={settings.jiraToken}
                onChange={(e) => setSettings(prev => ({ ...prev, jiraToken: e.target.value }))}
                placeholder="Your Jira API token"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
              />
              <p className="mt-1 text-sm text-gray-500">
                You can generate an API token from your 
                <a 
                  href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 ml-1"
                >
                  Atlassian Account Settings
                </a>
              </p>
            </div>

            {message.text && (
              <div className={`p-4 rounded-lg ${
                message.type === 'error' 
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={isSaving}
                className={`flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>

              <button
                type="button"
                onClick={handleSync}
                disabled={isSaving}
                className={`flex-1 bg-white text-blue-600 border border-blue-200 px-6 py-3 rounded-xl hover:bg-blue-50 transition-all shadow-sm hover:shadow-md ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                }`}
              >
                {isSaving ? 'Syncing...' : 'Sync with Jira'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings; 