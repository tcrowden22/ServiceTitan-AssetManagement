import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Lock, ArrowRight } from 'lucide-react';

const Register = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);

    try {
      // Register
      const regResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });

      const regData = await regResponse.json();

      if (!regResponse.ok) {
        throw new Error(regData.message || 'Registration failed');
      }

      // Auto login after register
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      
      const loginData = await loginResponse.json();
      
      if (!loginResponse.ok) {
        throw new Error('Auto-login failed. Please sign in manually.');
      }

      login({ id: loginData.id, username: loginData.username, role: loginData.role }, loginData.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Get started with AssetGuard</p>
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
              placeholder="Choose a username"
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
              placeholder="Create a password"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-brand-dark border-transparent focus:bg-white dark:focus:bg-brand-darker focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/10 rounded-2xl transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Confirm password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-gold text-black rounded-xl font-bold hover:bg-brand-gold-hover transition-all shadow-lg shadow-brand-gold/20 disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-brand-gold dark:text-brand-gold font-bold hover:underline">
          Sign In
        </button>
      </p>
    </div>
  );
};

export default Register;

