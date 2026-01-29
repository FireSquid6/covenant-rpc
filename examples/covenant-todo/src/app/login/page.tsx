'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { client, setAuthToken } from '@/client/client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('testuser');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await client.mutate('login', {
        username,
        password,
      });

      if (result.success) {
        // Store the auth token
        setAuthToken(result.data.token);
        // Redirect to main page
        router.push('/');
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Login to Todo App</h1>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}

        <input
          type="text"
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />

        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />

        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
        Default credentials: testuser / password
      </p>
    </div>
  );
}
