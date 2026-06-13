const EMAIL_TO = 'pronexusconstruction@yahoo.com';
const SITE_URL = 'https://pronexusconstruction.com';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
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

  const subject = formType === 'cleanbc'
    ? `CleanBC Intake - ${formData.fullName || 'No name'}`
    : `Contact Form - ${formData.name || formData.fullName || 'No name'}`;

  let body = '';
  for (const [key, val] of Object.entries(formData)) {
    body += `${key}: ${val}\n`;
  }

  try {
    await sendEmail(subject, body);
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

async function sendEmail(subject, body) {
  const mailgunKey = MAILGUN_API_KEY;
  const mailgunDomain = MAILGUN_DOMAIN;

  if (mailgunKey && mailgunDomain) {
    const formData = new URLSearchParams();
    formData.append('from', `ProNexus Website <noreply@${mailgunDomain}>`);
    formData.append('to', EMAIL_TO);
    formData.append('subject', subject);
    formData.append('text', body);

    const resp = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa('api:' + mailgunKey),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('Mailgun error: ' + text);
    }
    return;
  }

  const sendGridKey = SENDGRID_API_KEY;
  if (sendGridKey) {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sendGridKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: EMAIL_TO }] }],
        from: { email: `noreply@${new URL(SITE_URL).hostname}` },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('SendGrid error: ' + text);
    }
    return;
  }

  // Fallback: log to console (Worker logs)
  console.log('Email not sent - no API key configured');
  console.log('Subject:', subject);
  console.log('Body:', body);
}
