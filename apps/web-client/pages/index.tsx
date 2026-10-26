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
    id: number;
    name: string;
    skills: string;
    educationLevel?: string | null;
    academicAverage?: number | null;
    experienceYears?: number | null;
    availability?: string | null;
    location?: string | null;

  };
};

type SeekerProfile = {
  profilePictureUrl: string;
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
  profilePictureUrl: '',
  name: '',
  skills: '',
  location: '',
  educationLevel: '',
  academicAverage: null,
  experienceYears: 0,
  availability: '',
  bio: ''
};
type Certificate = {
  id: number;
  title: string;
  issuer: string;
  originalFilename: string;
  mimeType: string;
  createdAt: string;
};

type ApplicantProfile = {
  profile: SeekerProfile;
  certificates: Certificate[];
};
type Match = {
  job: Job;
  score: number;
  matchedSkills: string[];
};

function calculateApplicantMatch(application: Application, job: Job) {
  const requiredSkills = (job.skills || '')
    .split(',')
    .map(skill => skill.trim().toLowerCase())
    .filter(Boolean);

  const applicantSkills = (application.seeker?.skills || '')
    .split(',')
    .map(skill => skill.trim().toLowerCase())
    .filter(Boolean);

  const matchedSkills = requiredSkills.filter(skill =>
    applicantSkills.includes(skill)
  );

  const education = (application.seeker?.educationLevel || '')
    .toLowerCase();

  const educationRequirement = (job.educationRequirement || 'ANY')
    .toUpperCase();

  const educationRanks: Record<string, number> = {
    MATRIC: 1,
    CERTIFICATE: 2,
    DIPLOMA: 3,
    DEGREE: 4
  };

  function applicantEducationRank(value: string): number | null {
    if (!value.trim()) return null;
    if (/degree|bachelor|honours|master|phd|doctorate/.test(value)) return 4;
    if (/diploma/.test(value)) return 3;
    if (/certificate/.test(value)) return 2;
    if (/matric|grade 12|national senior certificate/.test(value)) return 1;
    return null;
  }

  const minimumExperience = Number(job.minimumExperienceYears || 0);
  const experience = application.seeker?.experienceYears;

  let weightedScore = 0;
  let availableWeight = 0;

  if (requiredSkills.length > 0) {
    weightedScore +=
      (matchedSkills.length / requiredSkills.length) * 60;
    availableWeight += 60;
  }

  if (minimumExperience > 0 && experience != null) {
    weightedScore +=
      (experience >= minimumExperience ? 1 : 0) * 20;
    availableWeight += 20;
  }

  if (educationRequirement !== 'ANY') {
    const requiredRank = educationRanks[educationRequirement];
    const candidateRank = applicantEducationRank(education);

    if (requiredRank != null && candidateRank != null) {
      weightedScore +=
        (candidateRank >= requiredRank ? 1 : 0) * 20;
      availableWeight += 20;
    }
  }

  return {
    score: availableWeight > 0
      ? Math.round((weightedScore / availableWeight) * 100)
      : null,
    matchedSkills,
    requiredSkillsCount: requiredSkills.length,
    educationKnown: educationRequirement === 'ANY' ||
      applicantEducationRank(education) !== null,
    experienceKnown: minimumExperience === 0 ||
      experience != null
  };
}
export default function Home() {
  const [skillbridgeInfoPage, setSkillbridgeInfoPage] =
    useState<'home' | 'about' | 'help'>('home');
  const [profile, setProfile] = useState<SeekerProfile>(emptyProfile);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateTitle, setCertificateTitle] = useState('');
  const [certificateIssuer, setCertificateIssuer] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantProfile | null>(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState<number | null>(null);
  const [loadingApplicant, setLoadingApplicant] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [jobField, setJobField] = useState('ALL');

  const filteredJobs = jobs.filter(job => {
    if (user?.role !== 'SEEKER') return true;

    const search = jobSearch.trim().toLowerCase();

    const searchableText = [
      job.title,
      job.company,
      job.description,
      job.skills,
      job.type
    ].join(' ').toLowerCase();

    const matchesSearch =
      !search || searchableText.includes(search);

    const fieldKeywords: Record<string, string[]> = {
      DATA: ['data', 'analytics', 'analyst', 'statistics', 'excel', 'sql'],
      IT: ['software', 'developer', 'programming', 'python', 'web', 'it support'],
      FINANCE: ['finance', 'accounting', 'banking', 'financial', 'bookkeeping'],
      ADMIN: ['administration', 'admin', 'reception', 'customer service', 'office', 'assistant'],
      DESIGN: ['design', 'creative', 'graphics', 'content', 'media'],
      EDUCATION: ['education', 'teaching', 'tutor', 'training', 'school']
    };

    const keywords = fieldKeywords[jobField] || [];

    const matchesField =
      jobField === 'ALL' ||
      keywords.some(keyword => searchableText.includes(keyword));

    return matchesSearch && matchesField;
  });
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicantFilters, setApplicantFilters] = useState({
    skills: '0',
    education: 'ANY',
    experience: '0',
    academicAverage: '0',
    status: 'ALL'
  });
  const [matches, setMatches] = useState<Match[]>([]);

  const employerJobGroups = jobs
    .map(job => {
      const rankedApplicants = applications
        .filter(application => application.jobId === job.id)
        .map(application => ({
          application,
          match: calculateApplicantMatch(application, job)
        }))
        .sort((a, b) => {
          if (a.match.score === null && b.match.score === null) {
            return a.application.id - b.application.id;
          }
          if (a.match.score === null) return 1;
          if (b.match.score === null) return -1;
          return b.match.score - a.match.score ||
            a.application.id - b.application.id;
        });

      const filteredApplicants = rankedApplicants.filter(({ application, match }) => {
        const seeker = application.seeker;

        if (
          applicantFilters.status !== 'ALL' &&
          application.status !== applicantFilters.status
        ) return false;

        if (
          match.requiredSkillsCount > 0 &&
          match.matchedSkills.length < Number(applicantFilters.skills)
        ) return false;

        if (
          applicantFilters.education !== 'ANY' &&
          !(seeker?.educationLevel || '').toLowerCase()
            .includes(applicantFilters.education.toLowerCase())
        ) return false;

        if (
          Number(applicantFilters.experience) > 0 &&
          (seeker?.experienceYears == null ||
            seeker.experienceYears < Number(applicantFilters.experience))
        ) return false;

        if (
          Number(applicantFilters.academicAverage) > 0 &&
          (seeker?.academicAverage == null ||
            seeker.academicAverage < Number(applicantFilters.academicAverage))
        ) return false;

        return true;
      });

      return {
        job,
        applicants: filteredApplicants,
        totalApplicants: rankedApplicants.length
      };
    })
    .filter(group => group.totalApplicants > 0);
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
        await loadCertificates(authToken);
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
    let cancelled = false;

    async function restoreSession() {
      const savedToken = sessionStorage.getItem('skillbridge_token');
      const savedUser = sessionStorage.getItem('skillbridge_user');

      if (!savedToken || !savedUser) return;

      try {
        const parsedUser = JSON.parse(savedUser);

        if (
          !parsedUser ||
          typeof parsedUser.name !== 'string' ||
          typeof parsedUser.role !== 'string'
        ) {
          sessionStorage.removeItem('skillbridge_token');
          sessionStorage.removeItem('skillbridge_user');
          return;
        }

        const response = await fetch(API + '/api/jobs', {
          headers: {
            Authorization: 'Bearer ' + savedToken
          }
        });

        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem('skillbridge_token');
          sessionStorage.removeItem('skillbridge_user');
          return;
        }

        if (!response.ok) return;

        if (!cancelled) {
          setToken(savedToken);
          setUser(parsedUser);
        }
      } catch {
        // Preserve the saved session if the network is temporarily unavailable.
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

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
        bio: data.bio || '',
        profilePictureUrl: data.profilePictureUrl || ''
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to load profile.'
      );
    }
  }

  async function uploadProfilePicture() {
    if (!pictureFile) {
      setMessage('Please choose a picture first.');
      return;
    }

    setUploadingPicture(true);

    try {
      const formData = new FormData();
      formData.append('picture', pictureFile);

      const response = await fetch(API + '/api/profile/picture', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Picture upload failed.');
      }

      setProfile(previous => ({
        ...previous,
        profilePictureUrl: data.profilePictureUrl
      }));

      setPictureFile(null);
      setMessage('Profile picture uploaded successfully!');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Picture upload failed.'
      );
    } finally {
      setUploadingPicture(false);
    }
  }
  async function loadCertificates(authToken = token) {
    try {
      const data = await request(
        '/api/certificates',
        'GET',
        undefined,
        authToken
      );
      setCertificates(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load certificates.'
      );
    }
  }

  async function uploadCertificate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!certificateFile) {
      setMessage('Please select a certificate.');
      return;
    }

    if (certificateFile.size > 5 * 1024 * 1024) {
      setMessage('The document must be 5 MB or smaller.');
      return;
    }

    setUploadingCertificate(true);

    try {
      const formData = new FormData();
      formData.append('title', certificateTitle);
      formData.append('issuer', certificateIssuer);
      formData.append('document', certificateFile);

      const response = await fetch(API + '/api/certificates', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Certificate upload failed.');
      }

      setCertificateTitle('');
      setCertificateIssuer('');
      setCertificateFile(null);
      await loadCertificates();
      setMessage('Certificate uploaded successfully!');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Certificate upload failed.'
      );
    } finally {
      setUploadingCertificate(false);
    }
  }

  async function viewCertificate(id: number) {
    try {
      const data = await request('/api/certificates/' + id + '/file');

      if (!data.url) {
        throw new Error('Document URL unavailable.');
      }

      const link = document.createElement('a');
      link.href = data.url;
      link.rel = 'noopener noreferrer';
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to open certificate.'
      );
    }
  }

  async function viewApplicantProfile(seekerId: number) {
    setLoadingApplicant(true);
    setSelectedApplicant(null);
    setSelectedApplicantId(seekerId);

    try {
      const data = await request(
        '/api/applicants/' + seekerId + '/profile'
      );
      setSelectedApplicant(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load applicant profile.'
      );
    } finally {
      setLoadingApplicant(false);
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

      sessionStorage.setItem('skillbridge_token', data.token);
      sessionStorage.setItem(
        'skillbridge_user',
        JSON.stringify(data.user)
      );
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
    sessionStorage.removeItem('skillbridge_token');
    sessionStorage.removeItem('skillbridge_user');
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

        <nav
          aria-label="Main navigation"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            style={{
              ...css.button,
              background: skillbridgeInfoPage === 'home'
                ? '#177e70' : '#34516b'
            }}
            onClick={() => setSkillbridgeInfoPage('home')}
          >
            Home
          </button>
          <button
            type="button"
            style={{
              ...css.button,
              background: skillbridgeInfoPage === 'about'
                ? '#177e70' : '#34516b'
            }}
            onClick={() => setSkillbridgeInfoPage('about')}
          >
            About Us
          </button>
          <button
            type="button"
            style={{
              ...css.button,
              background: skillbridgeInfoPage === 'help'
                ? '#177e70' : '#34516b'
            }}
            onClick={() => setSkillbridgeInfoPage('help')}
          >
            Help
          </button>
        </nav>
        {user && (
          <div>
            {user.role === 'SEEKER' && profile.profilePictureUrl && (
              <img
                src={profile.profilePictureUrl}
                alt="Profile"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  verticalAlign: 'middle',
                  marginRight: 10
                }}
              />
            )}            {user.name} - {user.role}
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
        {skillbridgeInfoPage === 'about' ? (
          <section style={css.card}>
            <h1>About SkillBridge SA</h1>
            <p><strong>From skills to opportunity.</strong></p>
            <p>
              SkillBridge SA is a youth employment and work-readiness
              platform designed to connect South African students and
              young job seekers with meaningful career opportunities.
            </p>
            <h2>Our Mission</h2>
            <p>
              To bridge the gap between education and employment by
              helping young people showcase their skills, qualifications
              and practical experience.
            </p>
            <h2>Why SkillBridge SA?</h2>
            <p>
              Many young people face the experience paradox: employers
              require experience, but gaining that experience often
              requires getting a job first.
            </p>
            <p>
              SkillBridge SA helps job seekers discover opportunities
              such as micro-internships, vacation work and entry-level
              jobs, while employers can find and review applicants.
            </p>
            <h2>Our Vision</h2>
            <p>
              A South Africa where young people have better access to
              opportunities that help them develop skills and build
              their careers.
            </p>
            <h2>Meet Team Hexcode</h2>
            <p>
              SkillBridge SA was developed by Zonke Mpini,
              Yamkelani Gqokoma, Siphamandla Klaas,
              Thembalethu Sambo and Inam Khwetana.
            </p>
            <button
              type="button"
              style={css.button}
              onClick={() => setSkillbridgeInfoPage('home')}
            >
              Back to Home
            </button>
          </section>
        ) : skillbridgeInfoPage === 'help' ? (
          <section style={css.card}>
            <h1>Help &amp; Support</h1>
            <p>
              Welcome to the SkillBridge SA Help Centre.
              Find answers to frequently asked questions below.
            </p>

            <h2>For Job Seekers</h2>
            <details>
              <summary>How do I create an account?</summary>
              <p>
                Select Register, enter your information and choose
                the Job Seeker account type.
              </p>
            </details>
            <details>
              <summary>How do I apply for an opportunity?</summary>
              <p>
                Sign in, browse or search available opportunities
                and select Apply on a suitable listing.
              </p>
            </details>
            <details>
              <summary>How do I upload certificates?</summary>
              <p>
                Open your job seeker profile and use the certificate
                upload feature. Supported formats are PDF, JPG and PNG,
                with a maximum file size of 5 MB.
              </p>
            </details>
            <details>
              <summary>How do I track my applications?</summary>
              <p>
                Check your dashboard to see whether an application
                is Applied, Shortlisted, Accepted or Declined.
              </p>
            </details>

            <h2>For Employers</h2>
            <details>
              <summary>How do I post an opportunity?</summary>
              <p>
                Sign in using an employer account and use the
                opportunity posting form on your dashboard.
              </p>
            </details>
            <details>
              <summary>How do I review applicants?</summary>
              <p>
                Open your employer dashboard to view applications,
                filter candidates, inspect available applicant
                profiles and update application statuses.
              </p>
            </details>
            <details>
              <summary>Can I close an opportunity?</summary>
              <p>
                Yes. Use Close Opportunity on an opportunity
                that you posted.
              </p>
            </details>

            <h2>Account &amp; Notifications</h2>
            <details>
              <summary>Why am I not receiving email notifications?</summary>
              <p>
                Email notifications depend on the email service
                configuration. You can always check your application
                status in your dashboard.
              </p>
            </details>

            <p style={{ marginTop: 24 }}>
              Need additional assistance? Please contact the
              SkillBridge SA team through its official support
              channel once available.
            </p>
            <button
              type="button"
              style={css.button}
              onClick={() => setSkillbridgeInfoPage('home')}
            >
              Back to Home
            </button>
          </section>
        ) : (
          <>
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 20
                }}>
                  {profile.profilePictureUrl ? (
                    <img
                      src={profile.profilePictureUrl}
                      alt="Your profile"
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: '#34516b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      No photo
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e =>
                        setPictureFile(e.target.files?.[0] || null)
                      }
                    />
                    <button
                      type="button"
                      style={css.button}
                      disabled={!pictureFile || uploadingPicture}
                      onClick={uploadProfilePicture}
                    >
                      {uploadingPicture ? 'Uploading...' : 'Upload Picture'}
                    </button>
                    <p style={{ fontSize: 12 }}>
                      JPG, PNG or WebP. Maximum 3 MB.
                    </p>
                  </div>
                </div>
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
            {user.role === 'SEEKER' && (
              <section style={css.card}>
                <h2>My Certificates</h2>
                <p>
                  Upload qualifications and supporting documents.
                  Documents are available to employers reviewing your applications.
                </p>

                <form onSubmit={uploadCertificate}>
                  <label>
                    Certificate title
                    <input
                      style={css.input}
                      value={certificateTitle}
                      onChange={e => setCertificateTitle(e.target.value)}
                      placeholder="e.g. National Senior Certificate"
                      maxLength={150}
                      required
                    />
                  </label>

                  <label>
                    Issuing organisation
                    <input
                      style={css.input}
                      value={certificateIssuer}
                      onChange={e => setCertificateIssuer(e.target.value)}
                      placeholder="e.g. Department of Basic Education"
                      maxLength={150}
                    />
                  </label>

                  <label>
                    Select document (PDF, JPG or PNG)
                    <input
                      style={css.input}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e =>
                        setCertificateFile(e.target.files?.[0] || null)
                      }
                      required
                    />
                  </label>

                  <p style={{fontSize:12}}>
                    Maximum file size: 5 MB.
                  </p>

                  <button
                    type="submit"
                    style={css.button}
                    disabled={uploadingCertificate}
                  >
                    {uploadingCertificate
                      ? 'Uploading...'
                      : 'Upload Certificate'}
                  </button>
                </form>

                <h3>Uploaded Documents</h3>

                {certificates.length === 0 && (
                  <p>No certificates uploaded yet.</p>
                )}

                {certificates.map(certificate => (
                  <div
                    key={certificate.id}
                    style={{
                      padding: 12,
                      marginBottom: 10,
                      border: '1px solid #ddd',
                      borderRadius: 8
                    }}
                  >
                    <strong>{certificate.title}</strong>
                    <p>
                      Issuer: {certificate.issuer || 'Not specified'}
                    </p>
                    <p>File: {certificate.originalFilename}</p>
                    <button
                      type="button"
                      style={css.button}
                      onClick={() => void viewCertificate(certificate.id)}
                    >
                      View / Download
                    </button>
                  </div>
                ))}
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
                    {' - '}
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

                        {user.role === 'SEEKER' && (
              <section style={css.card}>
                <h2>Find Opportunities</h2>

                <p>
                  Search for work matching your skills
                  and career interests.
                </p>

                <div style={{ marginBottom: 15 }}>
                  <label htmlFor="job-search">
                    Search by skill or job title
                  </label>

                  <input
                    id="job-search"
                    style={css.input}
                    type="search"
                    placeholder="e.g. Excel, Python, Data Analyst"
                    value={jobSearch}
                    onChange={event =>
                      setJobSearch(event.target.value)
                    }
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label htmlFor="job-field">
                    Field of interest
                  </label>

                  <select
                    id="job-field"
                    style={css.input}
                    value={jobField}
                    onChange={event =>
                      setJobField(event.target.value)
                    }
                  >
                    <option value="ALL">All fields</option>
                    <option value="DATA">Data Science & Analytics</option>
                    <option value="IT">IT & Software Development</option>
                    <option value="FINANCE">Business & Finance</option>
                    <option value="ADMIN">Administration & Customer Service</option>
                    <option value="DESIGN">Design & Creative</option>
                    <option value="EDUCATION">Education & Training</option>
                  </select>
                </div>

                <button
                  type="button"
                  style={css.button}
                  onClick={() => {
                    setJobSearch('');
                    setJobField('ALL');
                  }}
                >
                  Clear Search
                </button>

                <p style={{ marginTop: 15 }}>
                  Showing {filteredJobs.length} of {jobs.length} opportunities
                </p>
              </section>
            )}

            {user.role === 'SEEKER' && filteredJobs.length === 0 && (
              <p>
                No opportunities match your search.
                Try another skill or field of interest.
              </p>
            )}
{filteredJobs.map(job => (
              <section
                key={job.id}
                style={css.card}
              >
                <span style={css.tag}>
                  {job.type} - {job.status}
                </span>

                <h3>{job.title}</h3>

                <p>
                  <b>{job.company}</b>
                  {' - '}
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
                        ? 'Already Applied'
                        : 'Apply now'}
                    </button>
                  )}

                  {user.role === 'EMPLOYER' && job.status !== 'CLOSED' && (
  <button
    type="button"
    style={{
      ...css.button,
      background: '#9f3345',
      marginRight: 10
    }}
    onClick={() => {
      if (
        window.confirm(
          'Close this opportunity? Job seekers will no longer see it or be able to apply. Existing applications will be kept.'
        )
      ) {
        void action(
          '/api/jobs/' + job.id + '/close',
          'PATCH'
        );
      }
    }}
  >
    Close Opportunity
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

            {user.role === 'EMPLOYER' && (
  <section style={css.card}>
    <h3>Filter Applicants</h3>

    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      marginTop: 12
    }}>
      <label>
        <strong>Required skills matched</strong>
        <select
          value={applicantFilters.skills}
          onChange={e => setApplicantFilters(p => ({...p, skills: e.target.value}))}
          style={{display: 'block', width: '100%', padding: 8}}
        >
          <option value="0">Any</option>
          <option value="1">At least 1</option>
          <option value="2">At least 2</option>
          <option value="3">At least 3</option>
          <option value="4">At least 4</option>
        </select>
      </label>

      <label>
        <strong>Qualification</strong>
        <select
          value={applicantFilters.education}
          onChange={e => setApplicantFilters(p => ({...p, education: e.target.value}))}
          style={{display: 'block', width: '100%', padding: 8}}
        >
          <option value="ANY">Any</option>
          <option value="Matric">Matric</option>
          <option value="Certificate">Certificate</option>
          <option value="Diploma">Diploma</option>
          <option value="Degree">Degree</option>
        </select>
      </label>

      <label>
        <strong>Minimum experience</strong>
        <select
          value={applicantFilters.experience}
          onChange={e => setApplicantFilters(p => ({...p, experience: e.target.value}))}
          style={{display: 'block', width: '100%', padding: 8}}
        >
          <option value="0">Any</option>
          <option value="1">1+ years</option>
          <option value="2">2+ years</option>
          <option value="3">3+ years</option>
          <option value="5">5+ years</option>
        </select>
      </label>

      <label>
        <strong>Minimum academic average</strong>
        <select
          value={applicantFilters.academicAverage}
          onChange={e => setApplicantFilters(p => ({...p, academicAverage: e.target.value}))}
          style={{display: 'block', width: '100%', padding: 8}}
        >
          <option value="0">Any</option>
          <option value="50">50%+</option>
          <option value="60">60%+</option>
          <option value="70">70%+</option>
          <option value="75">75%+</option>
          <option value="80">80%+</option>
        </select>
      </label>

      <label>
        <strong>Application status</strong>
        <select
          value={applicantFilters.status}
          onChange={e => setApplicantFilters(p => ({...p, status: e.target.value}))}
          style={{display: 'block', width: '100%', padding: 8}}
        >
          <option value="ALL">All statuses</option>
          <option value="APPLIED">Applied</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
        </select>
      </label>
    </div>

    <button
      type="button"
      style={{...css.button, marginTop: 16}}
      onClick={() => setApplicantFilters({
        skills: '0',
        education: 'ANY',
        experience: '0',
        academicAverage: '0',
        status: 'ALL'
      })}
    >
      Clear Filters
    </button>
  </section>
)}
{user.role === 'EMPLOYER' ? (
  employerJobGroups.map(group => (
    <section key={group.job.id} style={{ marginBottom: 30 }}>
      <h3>{group.job.title}</h3>
      <p>
        {group.totalApplicants} applicants |
        Sorted by best match
      </p>

      {group.applicants.length === 0 && (
        <p>No applicants match the selected filters.</p>
      )}

      {group.applicants.map(({ application, match }, index) => (
        <>
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <strong>
            #{index + 1} - {application.seeker?.name || 'Applicant'}
          </strong>

          {index === 0 && match.score !== null && (
            <span
              style={{
                ...css.tag,
                marginLeft: 10,
                background: '#dcfce7',
                color: '#166534'
              }}
            >
              Top Match
            </span>
          )}

          <p>
            <strong>Job match: </strong>
            {match.score === null ? 'Not assessed' : `${match.score}%`}
          </p>

          <p>
            Matched {match.matchedSkills.length} of{' '}
            {match.requiredSkillsCount} required skills
          </p>

          {(!match.educationKnown || !match.experienceKnown) && (
            <p style={{ fontSize: 13, color: '#92400e' }}>
              Partial assessment: some qualification or experience
              information is unavailable.
            </p>
          )}
        </div>
              <section
                key={application.id}
                style={css.card}
              >
                <b>{application.Job?.title}</b>
                {' - '}
                <span style={css.tag}>
                  {application.status}
                </span>

                {user.role !== 'SEEKER' && (
                  <p>
                    Candidate: {application.seeker?.name}
                    {' - '}
                    Skills: {application.seeker?.skills}
                  </p>
                )}
                {user.role === 'EMPLOYER' && application.seeker?.id && (
                  <button
                    type="button"
                    style={{...css.button, marginTop: 10}}
                    disabled={loadingApplicant}
                    onClick={() =>
                      void viewApplicantProfile(application.seeker!.id)
                    }
                  >
                    {loadingApplicant ? 'Loading...' : 'View Profile'}
                  </button>
                )}

                {user.role === 'EMPLOYER' && selectedApplicant && selectedApplicantId === application.seeker?.id && (
              <section style={css.card}>
                <h2>Applicant Profile</h2>

                <button
                  type="button"
                  style={css.button}
                  onClick={() => { setSelectedApplicant(null); setSelectedApplicantId(null); }}
                >
                  Close Profile
                </button>

                {selectedApplicant.profile.profilePictureUrl && (
                  <img
                    src={selectedApplicant.profile.profilePictureUrl}
                    alt="Applicant profile"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: '50%',
                      display: 'block',
                      marginTop: 15
                    }}
                  />
                )}

                <h3>{selectedApplicant.profile.name}</h3>
                <p><strong>Location:</strong> {selectedApplicant.profile.location || 'Not provided'}</p>
                <p><strong>Skills:</strong> {selectedApplicant.profile.skills || 'Not provided'}</p>
                <p><strong>Education:</strong> {selectedApplicant.profile.educationLevel || 'Not provided'}</p>
                <p><strong>Academic average:</strong> {selectedApplicant.profile.academicAverage ?? 'Not provided'}</p>
                <p><strong>Experience:</strong> {selectedApplicant.profile.experienceYears} years</p>
                <p><strong>Availability:</strong> {selectedApplicant.profile.availability || 'Not provided'}</p>
                <p><strong>About:</strong> {selectedApplicant.profile.bio || 'Not provided'}</p>

                <h3>Certificates and Qualifications</h3>

                {selectedApplicant.certificates.length === 0 && (
                  <p>No certificates uploaded.</p>
                )}

                {selectedApplicant.certificates.map(certificate => (
                  <div
                    key={certificate.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 10
                    }}
                  >
                    <strong>{certificate.title}</strong>
                    <p>Issuer: {certificate.issuer || 'Not specified'}</p>
                    <p>File: {certificate.originalFilename}</p>

                    <button
                      type="button"
                      style={css.button}
                      onClick={() => void viewCertificate(certificate.id)}
                    >
                      View / Download Certificate
                    </button>
                  </div>
                ))}
              </section>
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
                          </>
      ))}
    </section>
  ))
) : (
  applications.map(application => (
    <section key={application.id} style={css.card}>
      <b>{application.Job?.title}</b>
      {' - '}
      <span style={css.tag}>{application.status}</span>

      {application.status === 'APPLIED' && (
        <button
          type="button"
          style={{
            ...css.button,
            background: '#b91c1c',
            marginTop: 10
          }}
          onClick={() => {
            if (window.confirm('Withdraw this application?')) {
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
    </section>
  ))
)}
          </>
        )}{message && (
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
              X
            </button>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}
