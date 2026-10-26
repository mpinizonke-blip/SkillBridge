const { Resend } = require('resend');

const subjects = {
  SHORTLISTED: "You've been shortlisted",
  ACCEPTED: "Your application has been accepted",
  DECLINED: "Application outcome update"
};

const messages = {
  SHORTLISTED:
    'Congratulations! An employer has shortlisted your application.',
  ACCEPTED:
    'Congratulations! The employer has accepted your application.',
  DECLINED:
    'Thank you for applying. Unfortunately, your application was not successful this time.'
};

async function sendApplicationStatusEmail({
  email,
  name,
  jobTitle,
  status
}) {
  if (!subjects[status] || !email) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log('Email notification skipped: email service not configured.');
    return;
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from,
      to: email,
      subject: `SkillBridge SA - ${subjects[status]}`,
      text: [
        `Hello ${name || 'Applicant'},`,
        '',
        messages[status],
        '',
        `Opportunity: ${jobTitle || 'Your application'}`,
        '',
        'Log in to SkillBridge SA to view your application status.',
        '',
        'Kind regards,',
        'SkillBridge SA Team'
      ].join('\n')
    });

    if (result.error) {
      console.error(
        'Email notification failed:',
        result.error.message
      );
      return;
    }

    console.log('Application notification submitted to email provider.');
  } catch (error) {
    console.error(
      'Email notification failed:',
      error.message
    );
  }
}

module.exports = { sendApplicationStatusEmail };