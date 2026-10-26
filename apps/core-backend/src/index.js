'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes, UniqueConstraintError } = require('sequelize');

// --------------------------------------------------
// 1. ENVIRONMENT AND DATABASE CONFIGURATION
// --------------------------------------------------

if (!process.env.DB_PASSWORD || !process.env.JWT_SECRET) {
  console.error('Set DB_PASSWORD and JWT_SECRET in .env');
  process.exit(1);
}

const db = new Sequelize(
  process.env.DB_NAME || 'skillbridge_sa',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: false
  }
);

// --------------------------------------------------
// 2. DATABASE MODELS
// --------------------------------------------------

const User = db.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('SEEKER', 'EMPLOYER', 'ADMIN'),
    allowNull: false
  },
  skills: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  educationLevel: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  academicAverage: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  experienceYears: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  availability: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  bio: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
});

const Job = db.define('Job', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  skills: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  experienceLevel: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ENTRY'
  },
  minimumExperienceYears: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 }
  },
  educationRequirement: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ANY'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING'
  }
});

const Application = db.define('Application', {
  status: {
    type: DataTypes.ENUM(
      'APPLIED',
      'SHORTLISTED',
      'ACCEPTED',
      'DECLINED'
    ),
    defaultValue: 'APPLIED'
  }
});

// --------------------------------------------------
// 3. DATABASE RELATIONSHIPS
// --------------------------------------------------

User.hasMany(Job, { foreignKey: 'employerId' });

Job.belongsTo(User, {
  as: 'employer',
  foreignKey: 'employerId'
});

User.hasMany(Application, {
  foreignKey: 'seekerId'
});

Application.belongsTo(User, {
  as: 'seeker',
  foreignKey: 'seekerId'
});

Job.hasMany(Application, {
  foreignKey: 'jobId'
});

Application.belongsTo(Job, {
  foreignKey: 'jobId'
});

// --------------------------------------------------
// 4. EXPRESS CONFIGURATION
// --------------------------------------------------

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

app.use(express.json({ limit: '30kb' }));

const secret = process.env.JWT_SECRET;

const clean = value => String(value || '').trim();

const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(error => {
    console.error(error);

    if (res.headersSent) return;

    res.status(500).json({
      error: 'Server error'
    });
  });

// --------------------------------------------------
// 5. AUTHENTICATION AND AUTHORISATION
// --------------------------------------------------

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer /, '');

    req.user = jwt.verify(token, secret);

    next();
  } catch {
    res.status(401).json({
      error: 'Please log in'
    });
  }
}

const permit = (...roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    error: 'Not permitted'
  });
};

// --------------------------------------------------
// 6. HEALTH CHECK
// --------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// --------------------------------------------------
// 7. USER REGISTRATION
// --------------------------------------------------

app.post('/api/auth/register', wrap(async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role;
  const skills = clean(req.body.skills);

  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Name, email and password are required'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Enter a valid email address'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters'
    });
  }

  // Public registration cannot create Admin accounts.
  if (!['SEEKER', 'EMPLOYER'].includes(role)) {
    return res.status(400).json({
      error: 'Invalid account type'
    });
  }

  const existing = await User.findOne({
    where: { email }
  });

  if (existing) {
    return res.status(409).json({
      error: 'Email already registered'
    });
  }

  try {
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      skills
    });

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills
      }
    });
  } catch (error) {
    // Handles two simultaneous registrations using one email.
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    throw error;
  }
}));

// --------------------------------------------------
// 8. USER LOGIN
// --------------------------------------------------

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  const user = await User.findOne({
    where: { email }
  });

  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    secret,
    {
      expiresIn: '8h'
    }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      skills: user.skills
    }
  });
}));

// --------------------------------------------------
// --------------------------------------------------
// JOB SEEKER PROFILE
// --------------------------------------------------

app.get('/api/profile', auth, permit('SEEKER'), wrap(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: [
      'id', 'name', 'email', 'role', 'skills',
      'location', 'educationLevel', 'academicAverage',
      'experienceYears', 'availability', 'bio'
    ]
  });

  if (!user) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(user);
}));

app.patch('/api/profile', auth, permit('SEEKER'), wrap(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const fields = [
    'name', 'skills', 'location', 'educationLevel',
    'availability', 'bio'
  ];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== 'string') {
        return res.status(400).json({ error: 'Invalid ' + field });
      }
      user[field] = req.body[field].trim();
    }
  }

  if (req.body.academicAverage !== undefined) {
    const value = req.body.academicAverage;

    if (value === null || value === '') {
      user.academicAverage = null;
    } else if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      return res.status(400).json({
        error: 'Academic average must be between 0 and 100'
      });
    } else {
      user.academicAverage = value;
    }
  }

  if (req.body.experienceYears !== undefined) {
    const years = req.body.experienceYears;

    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 60
    ) {
      return res.status(400).json({
        error: 'Enter valid years of experience'
      });
    }

    user.experienceYears = years;
  }

  await user.save();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    skills: user.skills,
    location: user.location,
    educationLevel: user.educationLevel,
    academicAverage: user.academicAverage,
    experienceYears: user.experienceYears,
    availability: user.availability,
    bio: user.bio
  });
}));
// 9. GET JOBS
// --------------------------------------------------

app.get('/api/jobs', auth, wrap(async (req, res) => {
  const where =
    req.user.role === 'ADMIN'
      ? {}
      : req.user.role === 'EMPLOYER'
        ? { employerId: req.user.id }
        : { status: 'APPROVED' };

  const jobs = await Job.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });

  res.json(jobs);
}));

// --------------------------------------------------
// 10. EMPLOYER POSTS JOB
// --------------------------------------------------

app.post(
  '/api/jobs',
  auth,
  permit('EMPLOYER'),
  wrap(async (req, res) => {
    const {
      title,
      company,
      location,
      type,
      description,
      skills,
      experienceLevel = 'ENTRY',
      minimumExperienceYears = 0,
      educationRequirement = 'ANY'
    } = req.body;

    const validLevels = [
      'NONE', 'ENTRY', 'JUNIOR', 'MID', 'SENIOR'
    ];
    const validEducation = [
      'ANY', 'MATRIC', 'CERTIFICATE',
      'DIPLOMA', 'DEGREE', 'POSTGRAD'
    ];
    const years = Number(minimumExperienceYears);

    if (
      !validLevels.includes(experienceLevel) ||
      !validEducation.includes(educationRequirement) ||
      !Number.isSafeInteger(years) ||
      years < 0 ||
      years > 50
    ) {
      return res.status(400).json({
        error: 'Invalid experience or education requirements'
      });
    }

    if (
      [title, company, location, type, description]
        .some(value => !clean(value))
    ) {
      return res.status(400).json({
        error: 'Complete all required fields'
      });
    }

    const job = await Job.create({
      title: clean(title),
      company: clean(company),
      location: clean(location),
      type: clean(type),
      description: clean(description),
      skills: clean(skills),
      experienceLevel,
      minimumExperienceYears: years,
      educationRequirement,
      employerId: req.user.id
    });

    res.status(201).json(job);
  })
);

// --------------------------------------------------
// 11. ADMIN APPROVES OR REJECTS JOB
// --------------------------------------------------

app.patch(
  '/api/jobs/:id/verify',
  auth,
  permit('ADMIN'),
  wrap(async (req, res) => {
    const job = await Job.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(req.body.status)) {
      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    job.status = req.body.status;

    await job.save();

    res.json(job);
  })
);

// --------------------------------------------------
// 12. JOB SEEKER APPLIES FOR JOB
// --------------------------------------------------

app.post(
  '/api/jobs/:id/apply',
  auth,
  permit('SEEKER'),
  wrap(async (req, res) => {
    const job = await Job.findByPk(req.params.id);

    if (!job || job.status !== 'APPROVED') {
      return res.status(404).json({
        error: 'Opportunity unavailable'
      });
    }

    const [application, created] =
      await Application.findOrCreate({
        where: {
          jobId: job.id,
          seekerId: req.user.id
        },
        defaults: {
          status: 'APPLIED'
        }
      });

    if (!created) {
      return res.status(409).json({
        error: 'Already applied'
      });
    }

    res.status(201).json(application);
  })
);

// --------------------------------------------------
// 13. GET APPLICATIONS
// --------------------------------------------------

app.get('/api/applications', auth, wrap(async (req, res) => {
  let where = {};

  if (req.user.role === 'SEEKER') {
    where = {
      seekerId: req.user.id
    };
  }

  if (req.user.role === 'EMPLOYER') {
    const jobs = await Job.findAll({
      where: {
        employerId: req.user.id
      },
      attributes: ['id']
    });

    where = {
      jobId: jobs.map(job => job.id)
    };
  }

  const applications = await Application.findAll({
    where,
    include: [
      { model: Job },
      {
        model: User,
        as: 'seeker',
        attributes: ['id', 'name', 'skills']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  res.json(applications);
}));

// --------------------------------------------------
// --------------------------------------------------
// WITHDRAW APPLICATION
// --------------------------------------------------

app.delete(
  '/api/applications/:id',
  auth,
  permit('SEEKER'),
  wrap(async (req, res) => {
    const application = await Application.findByPk(req.params.id);

    if (!application) {
      return res.status(404).json({
        error: 'Application not found'
      });
    }

    if (application.seekerId !== req.user.id) {
      return res.status(403).json({
        error: 'You cannot withdraw another user application'
      });
    }

    if (application.status !== 'APPLIED') {
      return res.status(400).json({
        error: 'Only pending applications can be withdrawn'
      });
    }

    await application.destroy();

    res.json({
      message: 'Application withdrawn successfully'
    });
  })
);
// 14. EMPLOYER UPDATES APPLICATION STATUS
// --------------------------------------------------

app.patch(
  '/api/applications/:id',
  auth,
  permit('EMPLOYER'),
  wrap(async (req, res) => {
    const application = await Application.findByPk(
      req.params.id,
      {
        include: [Job]
      }
    );

    if (!application) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    if (application.Job.employerId !== req.user.id) {
      return res.status(403).json({
        error: 'Not your opportunity'
      });
    }

    if (
      !['SHORTLISTED', 'ACCEPTED', 'DECLINED']
        .includes(req.body.status)
    ) {
      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    application.status = req.body.status;

    await application.save();

    res.json(application);
  })
);

// --------------------------------------------------
// 15. SKILLS MATCHING
// --------------------------------------------------

app.get(
  '/api/matches',
  auth,
  permit('SEEKER'),
  wrap(async (req, res) => {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const ownSkills = new Set(
      clean(user.skills)
        .toLowerCase()
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean)
    );

    const jobs = await Job.findAll({
      where: {
        status: 'APPROVED'
      }
    });

    const matches = jobs.map(job => {
      const requiredSkills = clean(job.skills)
        .toLowerCase()
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean);

      const matchedSkills = requiredSkills.filter(
        skill => ownSkills.has(skill)
      );

      const score = requiredSkills.length
        ? Math.round(
            100 * matchedSkills.length / requiredSkills.length
          )
        : 0;

      return {
        job,
        score,
        matchedSkills,
        requiredSkills
      };
    });

    matches.sort((a, b) => b.score - a.score);

    res.json(matches);
  })
);

// --------------------------------------------------
// 16. OPTIONAL DEMO DATA
// --------------------------------------------------

async function seed() {
  if (process.env.SEED_DEMO !== 'true') return;

  const accounts = [
    [
      'Demo Seeker',
      'seeker@skillbridge.local',
      'SEEKER',
      'communication, excel, customer service'
    ],
    [
      'Demo Employer',
      'employer@skillbridge.local',
      'EMPLOYER',
      ''
    ],
    [
      'Demo Admin',
      'admin@skillbridge.local',
      'ADMIN',
      ''
    ]
  ];

  const users = [];

  for (const [name, email, role, skills] of accounts) {
    const [user] = await User.findOrCreate({
      where: { email },
      defaults: {
        name,
        role,
        skills,
        passwordHash: await bcrypt.hash(
          process.env.DEMO_PASSWORD || 'ChangeMe123!',
          12
        )
      }
    });

    users.push(user);
  }

  if (await Job.count() === 0) {
    await Job.create({
      title: 'Vacation Work Assistant',
      company: 'Cape Community Hub',
      location: 'Cape Town',
      type: 'Vacation work',
      description:
        'Help with reception, records and customer support. Fictional demo opportunity.',
      skills: 'communication, excel',
      status: 'APPROVED',
      employerId: users[1].id
    });

    await Job.create({
      title: 'Digital Skills Micro-Internship',
      company: 'Youth Digital Studio',
      location: 'Remote',
      type: 'Micro-internship',
      description:
        'Support a small team with content and basic digital tasks. Fictional demo opportunity.',
      skills: 'communication, design',
      status: 'APPROVED',
      employerId: users[1].id
    });
  }
}

// --------------------------------------------------
// 17. START SERVER
// --------------------------------------------------

(async () => {
  await db.authenticate();

  await db.query(`
    ALTER TABLE public."Jobs"
    ADD COLUMN IF NOT EXISTS "experienceLevel"
    VARCHAR(255) NOT NULL DEFAULT 'ENTRY';
  `);

  await db.query(`
    ALTER TABLE public."Jobs"
    ADD COLUMN IF NOT EXISTS "minimumExperienceYears"
    INTEGER NOT NULL DEFAULT 0;
  `);

  await db.query(`
    ALTER TABLE public."Jobs"
    ADD COLUMN IF NOT EXISTS "educationRequirement"
    VARCHAR(255) NOT NULL DEFAULT 'ANY';
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "location"
    VARCHAR(255) DEFAULT '';
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "educationLevel"
    VARCHAR(255) DEFAULT '';
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "academicAverage"
    DOUBLE PRECISION;
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "experienceYears"
    INTEGER DEFAULT 0;
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "availability"
    VARCHAR(255) DEFAULT '';
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "bio"
    TEXT DEFAULT '';
  `);
  await db.sync();
  await seed();

  app.listen(
    process.env.PORT || 4001,
    () => console.log('SkillBridge API ready')
  );
})().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
