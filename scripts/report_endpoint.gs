const TURNSTILE_SECRET_PROPERTY = 'TURNSTILE_SECRET_KEY';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const token = String(payload.turnstile_token || '').trim();

    if (!token) {
      return jsonResponse_({
        status: 'error',
        message: 'Missing CAPTCHA token.',
      });
    }

    const verification = verifyTurnstileToken_(token, e.parameter.remoteip || '');
    if (!verification.success) {
      return jsonResponse_({
        status: 'error',
        message: 'CAPTCHA verification failed.',
      });
    }

    // Continue with the existing report handling here.
    // Example: validate fields, persist to Sheet, email notifications, etc.

    return jsonResponse_({
      status: 'success',
      message: 'Report accepted.',
    });
  } catch (error) {
    return jsonResponse_({
      status: 'error',
      message: error && error.message ? error.message : 'Unexpected server error.',
    });
  }
}

function verifyTurnstileToken_(token, remoteIp) {
  const secret = PropertiesService.getScriptProperties().getProperty(
    TURNSTILE_SECRET_PROPERTY,
  );

  if (!secret) {
    throw new Error('Missing Turnstile secret key.');
  }

  const response = UrlFetchApp.fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'post',
      payload: {
        secret: secret,
        response: token,
        remoteip: remoteIp,
      },
      muteHttpExceptions: true,
    },
  );

  const result = JSON.parse(response.getContentText() || '{}');
  return {
    success: Boolean(result.success),
    raw: result,
  };
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}