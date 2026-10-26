const {
  sendApplicationStatusEmail,
  sendPasswordResetEmail
} = require('./emailService');
'use strict';

require('dotenv').config();

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG and WebP images are allowed'));
    }
  }
});
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG and PNG documents are allowed'));
    }
  }
});
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
  profilePictureUrl: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  profilePicturePublicId: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
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
const Certificate = db.define('Certificate', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  issuer: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  originalFilename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cloudinaryPublicId: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  resourceType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false
  }
});
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
User.hasMany(Certificate, {
  foreignKey: 'seekerId'
});

Certificate.belongsTo(User, {
  as: 'seeker',
  foreignKey: 'seekerId'
});
const PasswordResetToken = db.define('PasswordResetToken', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
});
// 4. EXPRESS CONFIGURATION
// --------------------------------------------------

const app = express();

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'].filter(Boolean)
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

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer /, '');

    req.user = jwt.verify(token, secret);

    const account = await User.findByPk(req.user.id);

    if (!account) {
      return res.status(401).json({
        error: 'Please log in'
      });
    }

    const currentVersion = crypto
      .createHash('sha256')
      .update(account.passwordHash)
      .digest('hex');

    if (req.user.passwordVersion !== currentVersion) {
      return res.status(401).json({
        error: 'Please log in again'
      });
    }

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
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests. Please try again later.'
  }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Please try again later.'
  }
});

const passwordResetResponse = {
  message: 'If an account exists with that email, a password reset link will be sent.'
};

app.post('/api/auth/forgot-password', forgotPasswordLimiter, wrap(async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();

  if (!email || email.length > 254) {
    return res.status(400).json({
      error: 'Please enter a valid email address.'
    });
  }

  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.json(passwordResetResponse);
  }

  const recentRequest = await PasswordResetToken.findOne({
    where: {
      userId: user.id,
      createdAt: {
        [Sequelize.Op.gt]: new Date(Date.now() - 5 * 60 * 1000)
      }
    }
  });

  if (recentRequest) {
    return res.json(passwordResetResponse);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt
  });

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    console.error('Password reset requires FRONTEND_URL.');
    return res.json(passwordResetResponse);
  }

  const resetUrl =
    frontendUrl.replace(/\/$/, '') +
    '/reset-password?token=' +
    encodeURIComponent(token);

  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetUrl
  });

  return res.json(passwordResetResponse);
}));
app.post('/api/auth/reset-password', resetPasswordLimiter, wrap(async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({
      error: 'Invalid or expired password reset link.'
    });
  }

  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({
      error: 'Password must contain between 12 and 128 characters.'
    });
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const passwordHash = await bcrypt.hash(password, 12);

  const updated = await db.transaction(async transaction => {
    const resetRecord = await PasswordResetToken.findOne({
      where: { tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!resetRecord || resetRecord.expiresAt <= new Date()) {
      return false;
    }

    const user = await User.findByPk(resetRecord.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user) {
      return false;
    }

    user.passwordHash = passwordHash;
    await user.save({ transaction });

    await PasswordResetToken.destroy({
      where: { userId: user.id },
      transaction
    });

    return true;
  });

  if (!updated) {
    return res.status(400).json({
      error: 'Invalid or expired password reset link.'
    });
  }

  return res.json({
    message: 'Password updated successfully. You can now sign in.'
  });
}));
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
      role: user.role,
      passwordVersion: crypto
        .createHash('sha256')
        .update(user.passwordHash)
        .digest('hex')
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

app.post(
  '/api/profile/picture',
  auth,
  permit('SEEKER'),
  (req, res, next) => {
    profileUpload.single('picture')(req, res, error => {
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    });
  },
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an image' });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'skillbridge/profile-pictures',
          resource_type: 'image',
          overwrite: false
        },
        (error, uploaded) => {
          if (error) reject(error);
          else resolve(uploaded);
        }
      );

      stream.end(req.file.buffer);
    });

    const previousPictureId = user.profilePicturePublicId;

    user.profilePictureUrl = result.secure_url;
    user.profilePicturePublicId = result.public_id;

    await user.save();

    if (previousPictureId) {
      try {
        await cloudinary.uploader.destroy(previousPictureId);
      } catch (error) {
        console.error('Previous picture cleanup failed:', error);
      }
    }

    res.json({ profilePictureUrl: user.profilePictureUrl });
  })
);
app.post(
  '/api/certificates',
  auth,
  permit('SEEKER'),
  (req, res, next) => {
    certificateUpload.single('document')(req, res, error => {
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    });
  },
  wrap(async (req, res) => {
    const title = clean(req.body.title);
    const issuer = clean(req.body.issuer);

    if (!title || title.length > 150 || issuer.length > 150) {
      return res.status(400).json({
        error: 'Enter a valid certificate title and issuer'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Please select a certificate'
      });
    }

    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    const isPdf =
      buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const valid =
      (mimeType === 'application/pdf' && isPdf) ||
      (mimeType === 'image/jpeg' && isJpeg) ||
      (mimeType === 'image/png' && isPng);

    if (!valid) {
      return res.status(400).json({
        error: 'The selected file is not a valid PDF, JPG or PNG'
      });
    }

    const resourceType = isPdf ? 'raw' : 'image';

    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'skillbridge/private-certificates',
          resource_type: resourceType,
          type: 'authenticated',
          overwrite: false
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(buffer);
    });

    try {
      const certificate = await Certificate.create({
        title,
        issuer,
        originalFilename: req.file.originalname.slice(0, 255),
        cloudinaryPublicId: uploaded.public_id,
        resourceType,
        mimeType,
        seekerId: req.user.id
      });

      res.status(201).json({
        id: certificate.id,
        title: certificate.title,
        issuer: certificate.issuer,
        originalFilename: certificate.originalFilename,
        createdAt: certificate.createdAt
      });
    } catch (error) {
      try {
        await cloudinary.uploader.destroy(uploaded.public_id, {
          resource_type: resourceType,
          type: 'authenticated'
        });
      } catch (cleanupError) {
        console.error('Certificate cleanup failed:', cleanupError);
      }

      throw error;
    }
  })
);
app.get(
  '/api/certificates',
  auth,
  permit('SEEKER'),
  wrap(async (req, res) => {
    const certificates = await Certificate.findAll({
      where: {
        seekerId: req.user.id
      },
      attributes: [
        'id',
        'title',
        'issuer',
        'originalFilename',
        'mimeType',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(certificates);
  })
);
app.get(
  '/api/certificates/:id/file',
  auth,
  permit('SEEKER', 'EMPLOYER'),
  wrap(async (req, res) => {
    const certificate = await Certificate.findByPk(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    let authorised =
      req.user.role === 'SEEKER' &&
      Number(certificate.seekerId) === Number(req.user.id);

    if (req.user.role === 'EMPLOYER') {
      const application = await Application.findOne({
        where: {
          seekerId: certificate.seekerId
        },
        include: [{
          model: Job,
          required: true,
          where: {
            employerId: req.user.id
          }
        }]
      });

      authorised = Boolean(application);
    }

    if (!authorised) {
      return res.status(403).json({
        error: 'You cannot access this document'
      });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    const signedUrl = cloudinary.utils.private_download_url(
      certificate.cloudinaryPublicId,
      certificate.resourceType === 'raw' ? '' :
        certificate.mimeType === 'image/png' ? 'png' : 'jpg',
      {
        resource_type: certificate.resourceType,
        type: 'authenticated',
        expires_at: expiresAt,
        attachment: true
      }
    );

    res.json({
      url: signedUrl,
      expiresInSeconds: 60
    });
  })
);
app.get(
  '/api/applicants/:seekerId/profile',
  auth,
  permit('EMPLOYER'),
  wrap(async (req, res) => {
    const seekerId = Number(req.params.seekerId);

    if (!Number.isSafeInteger(seekerId) || seekerId < 1) {
      return res.status(400).json({
        error: 'Invalid applicant'
      });
    }

    const application = await Application.findOne({
      where: { seekerId },
      include: [{
        model: Job,
        required: true,
        where: { employerId: req.user.id }
      }]
    });

    if (!application) {
      return res.status(403).json({
        error: 'You can only view applicants for your jobs'
      });
    }

    const seeker = await User.findOne({
      where: { id: seekerId, role: 'SEEKER' },
      attributes: [
        'id',
        'name',
        'skills',
        'location',
        'educationLevel',
        'academicAverage',
        'experienceYears',
        'availability',
        'bio',
        'profilePictureUrl'
      ]
    });

    if (!seeker) {
      return res.status(404).json({
        error: 'Applicant not found'
      });
    }

    const certificates = await Certificate.findAll({
      where: { seekerId },
      attributes: [
        'id',
        'title',
        'issuer',
        'originalFilename',
        'mimeType',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      profile: seeker,
      certificates
    });
  })
);
app.get('/api/profile', auth, permit('SEEKER'), wrap(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: [
      'id', 'name', 'email', 'role', 'skills',
      'location', 'educationLevel', 'academicAverage',
      'experienceYears', 'availability', 'bio', 'profilePictureUrl'
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
    bio: user.bio,
    profilePictureUrl: user.profilePictureUrl
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
// --------------------------------------------------
// EMPLOYER CLOSES AN UNAVAILABLE OPPORTUNITY
// --------------------------------------------------

app.patch(
  '/api/jobs/:id/close',
  auth,
  permit('EMPLOYER'),
  wrap(async (req, res) => {
    const job = await Job.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: 'Opportunity not found'
      });
    }

    if (Number(job.employerId) !== Number(req.user.id)) {
      return res.status(403).json({
        error: 'You can only close your own opportunities'
      });
    }

    if (job.status === 'CLOSED') {
      return res.status(409).json({
        error: 'Opportunity is already closed'
      });
    }

    job.status = 'CLOSED';
    await job.save();

    res.json({
      message: 'Opportunity closed successfully',
      job
    });
  })
);
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
        attributes: [
          'id',
          'name',
          'skills',
          'educationLevel',
          'academicAverage',
          'experienceYears',
          'availability',
          'location'
        ]
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

    const previousStatus = application.status;

    application.status = req.body.status;

    await application.save();

    res.json(application);

    if (previousStatus !== application.status) {
      try {
        const applicant = await User.findByPk(application.seekerId);

        if (applicant && applicant.email) {
          void sendApplicationStatusEmail({
            email: applicant.email,
            name: applicant.name,
            jobTitle: application.Job?.title,
            status: application.status
          });
        }
      } catch (error) {
        console.error(
          'Unable to prepare application email notification:',
          error.message
        );
      }
    }
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
  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "profilePictureUrl"
    TEXT DEFAULT '';
  `);

  await db.query(`
    ALTER TABLE public."Users"
    ADD COLUMN IF NOT EXISTS "profilePicturePublicId"
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
