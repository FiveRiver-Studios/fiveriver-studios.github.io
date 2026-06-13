const EMAIL_TO = 'pronexusconstruction@yahoo.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/forms' && request.method === 'POST') {
      return handleForm(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleForm(request, env) {
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
    await sendEmail(subject, body, env);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

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
    return;
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
    return;
  }

  console.log('Email not sent - no API key configured');
  console.log('Subject:', subject);
  console.log('Body:', body);
}
