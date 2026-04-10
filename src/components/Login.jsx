import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Lock, ArrowRight } from 'lucide-react';

const Login = ({ onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check for SAML error in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      const errorMessages = {
        'saml_failed': 'SAML authentication failed. Please try again.',
        'invalid_saml_response': 'Invalid SAML response. Please contact support.',
        'server_error': 'Server error during authentication. Please try again.'
      };
      setError(errorMessages[errorParam] || 'Authentication failed. Please try again.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      login({ id: data.id, username: data.username, role: data.role }, data.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSamlLogin = () => {
    // Redirect to SAML SSO endpoint
    window.location.href = '/api/auth/sso';
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sign in to manage your assets</p>
      </div>

      {error && (
        <div className="p-3 bg-brand-brown/10 dark:bg-brand-brown/20 text-brand-brown dark:text-brand-gold rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Username</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-brand-dark border-transparent focus:bg-white dark:focus:bg-brand-darker focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/10 rounded-2xl transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Enter your username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              required
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-brand-dark border-transparent focus:bg-white dark:focus:bg-brand-darker focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/10 rounded-2xl transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Enter your password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-gold text-black rounded-xl font-bold hover:bg-brand-gold-hover transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* SAML SSO Option */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-brand-dark text-gray-500 dark:text-gray-400">Or</span>
        </div>
      </div>

      <button
        onClick={handleSamlLogin}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-brand-darker border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-brand-dark transition-all"
      >
        <Shield className="w-5 h-5" />
        Sign in with Okta SSO
      </button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="text-brand-gold dark:text-brand-gold font-bold hover:underline">
          Create one
        </button>
      </p>
    </div>
  );
};

export default Login;

