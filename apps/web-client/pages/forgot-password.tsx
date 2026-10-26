import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(API + '/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim() })
      });

      if (!response.ok) {
        throw new Error('Unable to process your request right now.');
      }

      setMessage(
        'If an account exists with that email, a password reset link will be sent.'
      );
      setEmail('');
    } catch {
      setError(
        'Something went wrong. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Forgot Password | SkillBridge SA</title>
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
            Forgot Password?
          </h1>

          <p style={{ color: '#555', lineHeight: 1.6 }}>
            Enter your registered email address. If an account
            exists, we will send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email" style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600
            }}>
              Email address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              maxLength={254}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 6,
                marginBottom: 18,
                fontSize: 15
              }}
            />

            <button
              type="submit"
              disabled={loading}
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
              {loading ? 'Sending request...' : 'Send Reset Link'}
            </button>
          </form>

          {message && (
            <p role="status" style={{
              color: '#176b3a',
              marginTop: 18,
              lineHeight: 1.6
            }}>
              {message}
            </p>
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
        </section>
      </main>
    </>
  );
}