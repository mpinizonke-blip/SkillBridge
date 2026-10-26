
import { useState, type FormEvent, type CSSProperties } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'SEEKER',
    skills: ''
  });

  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const input: CSSProperties = {
    width: '100%',
    padding: '12px',
    marginTop: 6,
    marginBottom: 16,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    boxSizing: 'border-box'
  };

  const update = (key: keyof typeof form, value: string) => {
    setForm(previous => ({ ...previous, [key]: value }));
  };

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setSuccess(false);

    if (form.password !== form.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    if (form.password.length < 12) {
      setMessage('Password must contain at least 12 characters.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          skills: form.role === 'SEEKER' ? form.skills : ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccess(true);
      window.location.assign('/?registered=1');
      setMessage('Account created successfully! You can now sign in.');
      setForm(previous => ({
        ...previous,
        password: '',
        confirmPassword: ''
      }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fb',
      fontFamily: 'Arial, sans-serif',
      color: '#142338',
      paddingBottom: 40
    }}>
      <header style={{
        background: '#122c45',
        padding: '22px 6%',
        color: 'white'
      }}>
        <Link href="/" style={{
          color: 'white',
          textDecoration: 'none',
          fontSize: 24,
          fontWeight: 'bold'
        }}>
          SkillBridge <span style={{ color: '#66e2b9' }}>SA</span>
        </Link>
      </header>

      <main style={{
        maxWidth: 480,
        margin: '45px auto',
        padding: 25,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 6px 25px #14233815'
      }}>
        <h1>Create your account</h1>
        <p>Join SkillBridge SA and connect your skills to opportunity.</p>

        <form onSubmit={register}>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            style={input}
            required
            maxLength={100}
            value={form.name}
            onChange={e => update('name', e.target.value)}
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            style={input}
            required
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />

          <label htmlFor="role">I am a</label>
          <select
            id="role"
            style={input}
            value={form.role}
            onChange={e => update('role', e.target.value)}
          >
            <option value="SEEKER">Job Seeker</option>
            <option value="EMPLOYER">Employer</option>
          </select>

          {form.role === 'SEEKER' && (
            <>
              <label htmlFor="skills">Your skills (separated by commas)</label>
              <input
                id="skills"
                style={input}
                placeholder="Excel, Communication, Python"
                value={form.skills}
                onChange={e => update('skills', e.target.value)}
              />
            </>
          )}

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            style={input}
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            value={form.password}
            onChange={e => update('password', e.target.value)}
          />

          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            style={input}
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={e => update('confirmPassword', e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#0c806c',
              color: 'white',
              padding: 14,
              border: 0,
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              width: '100%',
              fontWeight: 'bold',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {message && (
          <p role="status" style={{
            color: success ? '#07664e' : '#b42318',
            marginTop: 18
          }}>
            {message}
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 22 }}>
          Already have an account? <Link href="/">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
