// VERSION: v1.0.0 | DATE: 2026-04-29 | AUTHOR: VeloHub Development Team
/**
 * Envio via Gmail API (conta de serviço + domain-wide delegation no Workspace).
 */
const { google } = require('googleapis');

/**
 * MIME simples UTF-8 (HTML).
 */
function buildRawRfc822({ from, to, subject, html }) {
  const subjectHeader = mimeEncodeSubject(subject);
  const body = html || '';
  const msg =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subjectHeader}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n` +
    `\r\n` +
    body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

  const b64 = Buffer.from(msg, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mimeEncodeSubject(subject) {
  const s = String(subject || '');
  const asciiSafe = /^[\x01-\x7F]+$/.test(s);
  if (asciiSafe) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

/**
 * @param {{ serviceAccountJson: object; delegatedUserEmail: string }}
 * @param {{ from: string; to: string; subject: string; html: string }}
 */
async function sendViaGmailApi({ serviceAccountJson, delegatedUserEmail }, { from, to, subject, html }) {
  if (!serviceAccountJson?.client_email || !serviceAccountJson?.private_key) {
    throw new Error('serviceAccountJson inválido (client_email / private_key ausentes)');
  }
  const auth = new google.auth.JWT({
    email: serviceAccountJson.client_email,
    key: serviceAccountJson.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: delegatedUserEmail
  });
  await auth.authorize();

  const gmail = google.gmail({ version: 'v1', auth });
  const raw = buildRawRfc822({
    from: String(from || '').trim(),
    to: String(to || '').trim(),
    subject: String(subject || '').trim(),
    html: html || ''
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });

  return { success: true };
}

module.exports = {
  sendViaGmailApi,
  buildRawRfc822
};
