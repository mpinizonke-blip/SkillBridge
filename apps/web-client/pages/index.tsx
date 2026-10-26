import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent
} from 'react';
import Link from 'next/link';

const API =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

type User = {
  name: string;
  role: string;
  skills: string;
};

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  skills: string;
  status: string;
  experienceLevel: string;
  minimumExperienceYears: number;
  educationRequirement: string;
};

type Application = {
  id: number;
  jobId: number;
  status: string;
  Job?: {
    title: string;
  };
  seeker?: {
    name: string;
    skills: string;
  };
};

type SeekerProfile = {
  name: string;
  skills: string;
  location: string;
  educationLevel: string;
  academicAverage: number | null;
  experienceYears: number;
  availability: string;
  bio: string;
};

const emptyProfile: SeekerProfile = {
  name: '',
  skills: '',
  location: '',
  educationLevel: '',
  academicAverage: null,
  experienceYears: 0,
  availability: '',
  bio: ''
};
type Match = {
  job: Job;
  score: number;
  matchedSkills: string[];
};

export default function Home() {
  const [profile, setProfile] = useState<SeekerProfile>(emptyProfile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Micro-internship',
    description: '',
    skills: '',
    experienceLevel: 'ENTRY',
    minimumExperienceYears: 0,
    educationRequirement: 'ANY'
  });

  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    authToken = token
  ) {
    const response = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + authToken
      },
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed.');
    }

    return data;
  }

  async function load(authToken = token, role = user?.role) {
    if (!authToken) return;

    try {
      const [jobData, applicationData] = await Promise.all([
        request('/api/jobs', 'GET', undefined, authToken),
        request('/api/applications', 'GET', undefined, authToken)
      ]);

      setJobs(jobData);
      setApplications(applicationData);

      if (role === 'SEEKER') {
        await loadProfile(authToken);
        const matchData = await request(
          '/api/matches',
          'GET',
          undefined,
          authToken
        );
        setMatches(matchData);
      } else {
        setMatches([]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load dashboard.'
      );
    }
  }

  useEffect(() => {
    if (token && user) {
      void load(token, user.role);
    }
  }, [token, user?.role]);

  async function loadProfile(authToken = token) {
    try {
      const data = await request(
        '/api/profile',
        'GET',
        undefined,
        authToken
      );
      setProfile({
        name: data.name || '',
        skills: data.skills || '',
        location: data.location || '',
        educationLevel: data.educationLevel || '',
        academicAverage: data.academicAverage ?? null,
        experienceYears: data.experienceYears ?? 0,
        availability: data.availability || '',
        bio: data.bio || ''
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to load profile.'
      );
    }
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const saved = await request('/api/profile', 'PATCH', profile);
      setProfile(saved);
      setUser(previous => previous ? {
        ...previous,
        name: saved.name,
        skills: saved.skills
      } : previous);
      setMessage('Your profile has been saved successfully.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid response from the server.');
      }

      setToken(data.token);
      setUser(data.user);
      setPassword('');
      setMessage('Welcome, ' + data.user.name + '!');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign in.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function action(
    path: string,
    method = 'POST',
    body?: unknown
  ) {
    try {
      await request(path, method, body);
      setMessage('Saved successfully.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Action failed.'
      );
    }
  }

  function logout() {
    setToken('');
    setUser(null);
    setPassword('');
    setJobs([]);
    setApplications([]);
    setMatches([]);
    setMessage('You have signed out.');
  }

  const css: Record<string, CSSProperties> = {
    page: {
      fontFamily: 'Inter, Arial, system-ui, sans-serif',
      background: '#f5f7fb',
      minHeight: '100vh',
      color: '#142338'
    },
    nav: {
      background: '#122c45',
      color: 'white',
      padding: '22px 6%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12
    },
    main: {
      maxWidth: 1120,
      margin: 'auto',
      padding: '36px 20px'
    },
    card: {
      background: 'white',
      border: '1px solid #e3e8ef',
      borderRadius: 16,
      padding: 24,
      marginBottom: 18,
      boxShadow: '0 6px 20px #14233808'
    },
    input: {
      padding: 12,
      borderRadius: 9,
      border: '1px solid #cbd5e1',
      width: '100%',
      margin: '6px 0 12px',
      boxSizing: 'border-box'
    },
    button: {
      background: '#0c806c',
      color: 'white',
      border: 0,
      borderRadius: 9,
      padding: '11px 18px',
      cursor: 'pointer',
      fontWeight: 700,
      marginRight: 8
    },
    tag: {
      background: '#e8f7f1',
      color: '#07664e',
      borderRadius: 20,
      padding: '5px 10px',
      fontSize: 12
    }
  };

  return (
    <div style={css.page}>
      <header style={css.nav}>
        <div>
          <strong style={{ fontSize: 24 }}>
            SkillBridge{' '}
            <span style={{ color: '#66e2b9' }}>SA</span>
          </strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            From skills to opportunity
          </div>
        </div>

        {user && (
          <div>
            {user.name} Â· {user.role}
            <button
              style={{
                ...css.button,
                background: '#34516b',
                marginLeft: 12
              }}
              onClick={logout}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main style={css.main}>
        {!user ? (
          <>
            <h1>Find your next opportunity.</h1>
            <p>
              Micro-internships, vacation work and entry-level
              jobs for South African youth.
            </p>

            <section
              style={{
                ...css.card,
                maxWidth: 480
              }}
            >
              <h2>Sign in to SkillBridge SA</h2>
              <p>
                Welcome back! Enter your registered account details.
              </p>

              <form onSubmit={login}>
                <label htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  style={css.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  autoComplete="email"
                  required
                />

                <label htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  style={css.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="submit"
                  style={{
                    ...css.button,
                    width: '100%',
                    opacity: loading ? 0.7 : 1
                  }}
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <p
                style={{
                  textAlign: 'center',
                  marginTop: 20
                }}
              >
                Don't have an account?{' '}
                <Link href="/register">
                  Create an account
                </Link>
              </p>
            </section>
          </>
        ) : (
          <>
            <h1>
              {user.role === 'SEEKER'
                ? 'Discover opportunities'
                : user.role === 'EMPLOYER'
                ? 'Employer dashboard'
                : 'Admin review dashboard'}
            </h1>

            <p>
              Real-time actions backed by PostgreSQL.
              Demo opportunities are fictional.
            </p>

            {user.role === 'SEEKER' && (
              <section style={css.card}>
                <h2>My Profile</h2>
                <p>Complete your profile to help employers understand your qualifications and experience.</p>
                <form onSubmit={saveProfile}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                    gap: 12
                  }}>
                    {([
                      ['name', 'Full name'],
                      ['location', 'Location'],
                      ['educationLevel', 'Highest qualification'],
                      ['availability', 'Availability']
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          style={css.input}
                          value={profile[key]}
                          onChange={e => setProfile({
                            ...profile,
                            [key]: e.target.value
                          })}
                          required={key === 'name'}
                        />
                      </label>
                    ))}
                    <label>
                      Academic average (%)
                      <input
                        style={css.input}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={profile.academicAverage ?? ''}
                        onChange={e => setProfile({
                          ...profile,
                          academicAverage: e.target.value === ''
                            ? null
                            : Number(e.target.value)
                        })}
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      Years of experience
                      <input
                        style={css.input}
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        value={profile.experienceYears}
                        onChange={e => setProfile({
                          ...profile,
                          experienceYears: Number(e.target.value)
                        })}
                      />
                    </label>
                  </div>
                  <label>
                    Skills (separate with commas)
                    <input
                      style={css.input}
                      value={profile.skills}
                      onChange={e => setProfile({
                        ...profile,
                        skills: e.target.value
                      })}
                      placeholder="Excel, communication, customer service"
                    />
                  </label>
                  <label>
                    About me
                    <textarea
                      style={css.input}
                      rows={4}
                      value={profile.bio}
                      onChange={e => setProfile({
                        ...profile,
                        bio: e.target.value
                      })}
                      placeholder="Tell employers about yourself."
                    />
                  </label>
                  <button
                    type="submit"
                    style={css.button}
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </section>
            )}
            {user.role === 'EMPLOYER' && (
              <section style={css.card}>
                <h2>Post an opportunity</h2>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void action('/api/jobs', 'POST', form);
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit,minmax(200px,1fr))',
                      gap: 12
                    }}
                  >
                    {(
                      [
                        'title',
                        'company',
                        'location',
                        'type',
                        'skills'
                      ] as const
                    ).map(key => (
                      <label key={key}>
                        {key}
                        <input
                          style={css.input}
                          value={form[key]}
                          onChange={e =>
                            setForm({
                              ...form,
                              [key]: e.target.value
                            })
                          }
                          required={key !== 'skills'}
                          placeholder={
                            key === 'skills'
                              ? 'e.g. communication, excel'
                              : key
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(200px,1fr))',
                    gap: 12,
                    marginTop: 12
                  }}>
                    <label>
                      Experience level
                      <select
                        style={css.input}
                        value={form.experienceLevel}
                        onChange={e => setForm({
                          ...form,
                          experienceLevel: e.target.value
                        })}
                      >
                        <option value="NONE">No experience required</option>
                        <option value="ENTRY">Entry level</option>
                        <option value="JUNIOR">Junior</option>
                        <option value="MID">Mid-level</option>
                        <option value="SENIOR">Senior</option>
                      </select>
                    </label>

                    <label>
                      Minimum years of experience
                      <input
                        style={css.input}
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={form.minimumExperienceYears}
                        onChange={e => setForm({
                          ...form,
                          minimumExperienceYears: Number(e.target.value)
                        })}
                        required
                      />
                    </label>

                    <label>
                      Education requirement
                      <select
                        style={css.input}
                        value={form.educationRequirement}
                        onChange={e => setForm({
                          ...form,
                          educationRequirement: e.target.value
                        })}
                      >
                        <option value="ANY">No qualification required</option>
                        <option value="MATRIC">Matric / Grade 12</option>
                        <option value="CERTIFICATE">Certificate</option>
                        <option value="DIPLOMA">Diploma</option>
                        <option value="DEGREE">Degree</option>
                        <option value="POSTGRAD">Postgraduate</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Description
                    <textarea
                      style={css.input}
                      value={form.description}
                      onChange={e =>
                        setForm({
                          ...form,
                          description: e.target.value
                        })
                      }
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    style={css.button}
                  >
                    Submit for admin approval
                  </button>
                </form>
              </section>
            )}

            {user.role === 'SEEKER' && (
              <section style={css.card}>
                <h2>Skills matching</h2>

                <p>
                  Your skills:{' '}
                  <b>{user.skills || 'Not set'}</b>
                </p>

                {matches.slice(0, 3).map(match => (
                  <div
                    key={match.job.id}
                    style={{ marginBottom: 9 }}
                  >
                    <b>{match.job.title}</b>
                    {' â€” '}
                    {match.score}% skills overlap{' '}
                    <small>
                      (
                      {match.matchedSkills.join(', ') ||
                        'No matching skills listed'}
                      )
                    </small>
                  </div>
                ))}

                <small>
                  Transparent keyword overlap; not AI and not
                  a hiring decision.
                </small>
              </section>
            )}

            <h2>
              {user.role === 'ADMIN'
                ? 'Review opportunities'
                : 'Opportunities'}
            </h2>

            {jobs.map(job => (
              <section
                key={job.id}
                style={css.card}
              >
                <span style={css.tag}>
                  {job.type} Â· {job.status}
                </span>

                <h3>{job.title}</h3>

                <p>
                  <b>{job.company}</b>
                  {' Â· '}
                  {job.location}
                </p>

                <p>{job.description}</p>

                <p style={{ fontSize: 14 }}>
                  <b>Experience:</b>{' '}
                  {({
                    NONE: 'No experience required',
                    ENTRY: 'Entry level',
                    JUNIOR: 'Junior',
                    MID: 'Mid-level',
                    SENIOR: 'Senior'
                  } as Record<string, string>)[job.experienceLevel] ||
                    'Entry level'}
                  {' | '}
                  <b>Minimum years:</b>{' '}
                  {job.minimumExperienceYears ?? 0}
                  {' | '}
                  <b>Education:</b>{' '}
                  {({
                    ANY: 'No qualification required',
                    MATRIC: 'Matric / Grade 12',
                    CERTIFICATE: 'Certificate',
                    DIPLOMA: 'Diploma',
                    DEGREE: 'Degree',
                    POSTGRAD: 'Postgraduate'
                  } as Record<string, string>)[job.educationRequirement] ||
                    'No qualification required'}
                </p>

                <small>
                  Skills: {job.skills || 'Not specified'}
                </small>

                <div style={{ marginTop: 15 }}>
                  {user.role === 'SEEKER' && (
                    <button
                      type="button"
                      style={{
                        ...css.button,
                        ...(applications.some(
                          application => Number(application.jobId) === Number(job.id)
                        )
                          ? {
                              background: '#e2e8f0',
                              color: '#475569',
                              cursor: 'not-allowed'
                            }
                          : {})
                      }}
                      disabled={applications.some(
                        application => Number(application.jobId) === Number(job.id)
                      )}
                      onClick={() =>
                        void action('/api/jobs/' + job.id + '/apply')
                      }
                    >
                      {applications.some(
                        application => Number(application.jobId) === Number(job.id)
                      )
                        ? 'âœ“ Already Applied'
                        : 'Apply now'}
                    </button>
                  )}

                  {user.role === 'ADMIN' &&
                    job.status === 'PENDING' && (
                      <>
                        <button
                          style={css.button}
                          onClick={() =>
                            void action(
                              '/api/jobs/' +
                                job.id +
                                '/verify',
                              'PATCH',
                              { status: 'APPROVED' }
                            )
                          }
                        >
                          Approve
                        </button>

                        <button
                          style={{
                            ...css.button,
                            background: '#9f3345'
                          }}
                          onClick={() =>
                            void action(
                              '/api/jobs/' +
                                job.id +
                                '/verify',
                              'PATCH',
                              { status: 'REJECTED' }
                            )
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                </div>
              </section>
            ))}

            <h2>
              {user.role === 'SEEKER'
                ? 'My applications'
                : 'Applications'}
            </h2>

            {applications.length === 0 && (
              <p>No applications yet.</p>
            )}

            {applications.map(application => (
              <section
                key={application.id}
                style={css.card}
              >
                <b>{application.Job?.title}</b>
                {' Â· '}
                <span style={css.tag}>
                  {application.status}
                </span>

                {user.role !== 'SEEKER' && (
                  <p>
                    Candidate: {application.seeker?.name}
                    {' Â· '}
                    Skills: {application.seeker?.skills}
                  </p>
                )}

                {user.role === 'SEEKER' &&
                  application.status === 'APPLIED' && (
                    <button
                      type="button"
                      style={{
                        ...css.button,
                        background: '#b91c1c',
                        marginTop: 10
                      }}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Are you sure you want to withdraw this application?'
                          )
                        ) {
                          void action(
                            '/api/applications/' + application.id,
                            'DELETE'
                          );
                        }
                      }}
                    >
                      Withdraw Application
                    </button>
                  )}

                {user.role === 'SEEKER' && (
              <section style={css.card}>
                <h2>My Profile</h2>
                <p>Complete your profile to help employers understand your qualifications and experience.</p>
                <form onSubmit={saveProfile}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                    gap: 12
                  }}>
                    {([
                      ['name', 'Full name'],
                      ['location', 'Location'],
                      ['educationLevel', 'Highest qualification'],
                      ['availability', 'Availability']
                    ] as const).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          style={css.input}
                          value={profile[key]}
                          onChange={e => setProfile({
                            ...profile,
                            [key]: e.target.value
                          })}
                          required={key === 'name'}
                        />
                      </label>
                    ))}
                    <label>
                      Academic average (%)
                      <input
                        style={css.input}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={profile.academicAverage ?? ''}
                        onChange={e => setProfile({
                          ...profile,
                          academicAverage: e.target.value === ''
                            ? null
                            : Number(e.target.value)
                        })}
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      Years of experience
                      <input
                        style={css.input}
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        value={profile.experienceYears}
                        onChange={e => setProfile({
                          ...profile,
                          experienceYears: Number(e.target.value)
                        })}
                      />
                    </label>
                  </div>
                  <label>
                    Skills (separate with commas)
                    <input
                      style={css.input}
                      value={profile.skills}
                      onChange={e => setProfile({
                        ...profile,
                        skills: e.target.value
                      })}
                      placeholder="Excel, communication, customer service"
                    />
                  </label>
                  <label>
                    About me
                    <textarea
                      style={css.input}
                      rows={4}
                      value={profile.bio}
                      onChange={e => setProfile({
                        ...profile,
                        bio: e.target.value
                      })}
                      placeholder="Tell employers about yourself."
                    />
                  </label>
                  <button
                    type="submit"
                    style={css.button}
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </section>
            )}
            {user.role === 'EMPLOYER' && (
                  <div style={{ marginTop: 10 }}>
                    {[
                      'SHORTLISTED',
                      'ACCEPTED',
                      'DECLINED'
                    ].map(status => (
                      <button
                        key={status}
                        style={css.button}
                        onClick={() =>
                          void action(
                            '/api/applications/' +
                              application.id,
                            'PATCH',
                            { status }
                          )
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        )}

        {message && (
          <div
            role="status"
            style={{
              ...css.card,
              background: '#e9f7f2',
              position: 'sticky',
              bottom: 10
            }}
          >
            {message}

            <button
              onClick={() => setMessage('')}
              style={{
                float: 'right',
                border: 0,
                background: 'transparent',
                cursor: 'pointer'
              }}
              aria-label="Dismiss message"
            >
              Ã—
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
