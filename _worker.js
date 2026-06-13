const EMAIL_TO = 'pronexusconstruction@yahoo.com';
const ALLOWED_ORIGINS = [
  'https://fiveriver-studios.github.io',
  'https://www.fiveriver-studios.github.io',
  'https://pronexusconstruction.com',
  'https://www.pronexusconstruction.com',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const contentType = request.headers.get('content-type') || '';

    let formData;
    if (contentType.includes('application/json')) {
      formData = await request.json();
    } else {
      const form = await request.formData();
      formData = {};
      for (const [key, val] of form.entries()) {
        formData[key] = val;
      }
    }

    const formType = formData.formType || 'contact';
    delete formData.formType;

    const name = formData.name || formData.fullName || 'No name';
    const subject = formType === 'cleanbc' ? `CleanBC Intake - ${name}` : `Contact Form - ${name}`;

    let body = '';
    for (const [key, val] of Object.entries(formData)) {
      body += `${key}: ${val}\n`;
    }

    try {
      const emailResult = await sendEmail(subject, body, env);
      return new Response(JSON.stringify({ success: true, info: emailResult }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
  },
};

async function sendEmail(subject, body, env) {
  const sendGridKey = env.SENDGRID_API_KEY;
  if (sendGridKey) {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sendGridKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: EMAIL_TO }] }],
        from: { email: 'noreply@pronexusconstruction.com' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    if (!resp.ok) throw new Error('SendGrid error: ' + (await resp.text()));
    return 'Sent via SendGrid';
  }

  const mailgunKey = env.MAILGUN_API_KEY;
  const mailgunDomain = env.MAILGUN_DOMAIN;
  if (mailgunKey && mailgunDomain) {
    const fd = new URLSearchParams();
    fd.append('from', `ProNexus Website <noreply@${mailgunDomain}>`);
    fd.append('to', EMAIL_TO);
    fd.append('subject', subject);
    fd.append('text', body);
    const resp = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa('api:' + mailgunKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: fd,
    });
    if (!resp.ok) throw new Error('Mailgun error: ' + (await resp.text()));
    return 'Sent via Mailgun';
  }

  return 'Logged (no email API configured)';
}
