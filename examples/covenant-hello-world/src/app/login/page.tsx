'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { client, updateAuthToken } from '../../client/client';

/**
 * Login page component
 *
 * Allows users to authenticate with username and password.
 * On successful login, stores the auth token and redirects to home page.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Call the login mutation
      const result = await client.mutate('login', {
        username,
        password,
      });

      if (result.success) {
        // Store the auth token
        updateAuthToken(result.data.token);

        // Redirect to home page
        router.push('/');
      } else {
        // Display error message
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
      <div className="card">
        <h1>Login</h1>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
            <strong>Test credentials:</strong>
          </p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>
            Username: <code>testuser</code>
            <br />
            Password: <code>password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
