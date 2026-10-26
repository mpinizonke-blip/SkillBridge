import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function ResetPassword() {
  const router = useRouter();
  const token = typeof router.query.token === 'string'
    ? router.query.token
    : '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError('This password reset link is invalid or missing.');
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError('Password must contain between 12 and 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API + '/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to reset your password.'
        );
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      setMessage('Your password has been updated successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password | SkillBridge SA</title>
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main style={{
        minHeight: '100vh',
        background: '#f3f6fb',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        fontFamily: 'Arial, sans-serif'
      }}>
        <section style={{
          background: '#ffffff',
          padding: 32,
          borderRadius: 12,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          <h1 style={{ color: '#17365d', marginTop: 0 }}>
            Reset Password
          </h1>

          {success ? (
            <>
              <p role="status" style={{ color: '#176b3a' }}>
                {message}
              </p>

              <p>
                You can now sign in using your new password.
              </p>

              <Link href="/">
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <p style={{ color: '#555', lineHeight: 1.6 }}>
                Enter your new password below.
                It must contain at least 12 characters.
              </p>

              {router.isReady && !/^[a-f0-9]{64}$/.test(token) ? (
                <p role="alert" style={{ color: '#b42318' }}>
                  This password reset link is invalid or missing.
                </p>
              ) : (
                <form onSubmit={handleSubmit}>
                  <label htmlFor="password" style={{
                    display: 'block',
                    marginBottom: 8,
                    fontWeight: 600
                  }}>
                    New password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 12,
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      marginBottom: 18
                    }}
                  />

                  <label htmlFor="confirmPassword" style={{
                    display: 'block',
                    marginBottom: 8,
                    fontWeight: 600
                  }}>
                    Confirm new password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 12,
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      marginBottom: 18
                    }}
                  />

                  <button
                    type="submit"
                    disabled={loading || !router.isReady}
                    style={{
                      width: '100%',
                      padding: 13,
                      background: '#17365d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 16,
                      cursor: loading ? 'wait' : 'pointer',
                      opacity: loading ? 0.7 : 1
                    }}
                  >
                    {loading ? 'Updating password...' : 'Reset Password'}
                  </button>
                </form>
              )}

              {error && (
                <p role="alert" style={{
                  color: '#b42318',
                  marginTop: 18
                }}>
                  {error}
                </p>
              )}

              <p style={{ textAlign: 'center', marginTop: 24 }}>
                <Link href="/">
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}