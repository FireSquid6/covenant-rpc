'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client, isAuthenticated, logout } from '../client/client';

/**
 * Home page component
 *
 * Displays a personalized greeting for authenticated users.
 * Redirects to login if not authenticated.
 */
export default function HomePage() {
  const router = useRouter();
  const hello = client.useQuery('getHello', null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Don't render anything while checking authentication
  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Covenant Hello World</h1>

        {hello.loading && (
          <div className="loading">Loading your greeting...</div>
        )}

        {hello.error && (
          <div className="error">
            <strong>Error:</strong> {hello.error.message}
          </div>
        )}

        {!hello.loading && !hello.error && hello.data && (
          <>
            <div className="greeting">
              <h2>{hello.data.message}</h2>
              <p>Logged in as: {hello.data.username}</p>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#444' }}>
                About This Example
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
                This is a minimal Covenant RPC example demonstrating:
              </p>
              <ul style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.6', marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Authentication with username/password</li>
                <li>Secure context-based authorization</li>
                <li>Type-safe queries with React hooks</li>
                <li>Error handling and loading states</li>
              </ul>
            </div>

            <button className="secondary" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
