import { useIdentity } from '../Identity';
/**
 * src/components/AuthPage.tsx
 * Authentication gate for Human Drift:
 * - Simple local authentication UI matching the existing dark theme
 * - Two tabs: "Sign in" and "Sign up"
 * - Handles credential validation, password confirmation, and inline error reporting
 * - Stores issued JWT in localStorage and notifies parent upon successful authentication
 * - Strictly adhering to design constraints: centered card, muted vs distinct tabs, no decorative clutter
 */

import React, { useState } from 'react';
import { authLogin, authSignup, setStoredToken } from '../api';

interface AuthPageProps {
  onAuthenticated: (username: string, token: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const { name: workspaceName } = useIdentity();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTabSwitch = (tab: 'signin' | 'signup') => {
    setActiveTab(tab);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please enter a username');
      return;
    }

    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (activeTab === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      if (activeTab === 'signin') {
        const res = await authLogin({ username: cleanUsername, password });
        setStoredToken(res.token);
        onAuthenticated(res.username, res.token);
      } else {
        const res = await authSignup({ username: cleanUsername, password });
        setStoredToken(res.token);
        onAuthenticated(res.username, res.token);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-base font-bold text-zinc-100 tracking-wide">
            {workspaceName}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Single local owner. Sign up once, then sign in.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => handleTabSwitch('signin')}
            className={`flex-1 pb-2.5 text-xs font-medium text-center transition-colors cursor-pointer ${
              activeTab === 'signin'
                ? 'text-zinc-100 border-b-2 border-zinc-300 font-semibold'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('signup')}
            className={`flex-1 pb-2.5 text-xs font-medium text-center transition-colors cursor-pointer ${
              activeTab === 'signup'
                ? 'text-zinc-100 border-b-2 border-zinc-300 font-semibold'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 outline-none"
              placeholder="Username"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
              required
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 outline-none"
              placeholder="Password"
            />
          </div>

          {activeTab === 'signup' && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded px-3 py-2 text-xs text-zinc-200 outline-none"
                placeholder="Confirm password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-medium py-2 px-4 rounded text-xs transition-colors cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading
              ? 'Please wait...'
              : activeTab === 'signin'
              ? 'Sign in'
              : 'Sign up'}
          </button>

          {/* Inline error below the button */}
          {error && (
            <p className="text-red-400 text-xs text-center mt-2.5">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
