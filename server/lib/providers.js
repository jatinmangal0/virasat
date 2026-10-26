// External services. Both are injectable so tests never touch the network.

// SMS: real delivery through Twilio when its three env vars are set.
// Without them the server runs in demo mode: the code is logged and returned to the browser.
export function makeSmsSender(env = process.env) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = env;
  if (sid && token && from) {
    return {
      mode: 'live',
      async send(phone, text) {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, From: from, Body: text }),
        });
        if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
      },
    };
  }
  return {
    mode: 'demo',
    async send(phone, text) {
      console.log(`[virasat] demo SMS to ${phone}: ${text}`);
    },
  };
}

// Google: the browser gets an ID token from Google Identity Services; we ask Google to
// check it and confirm it was issued for our client ID.
export function makeGoogleVerifier(clientId) {
  return async function verify(idToken) {
    if (!clientId) throw new Error('Google sign-in is not configured');
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!res.ok) throw new Error('Google rejected the token');
    const p = await res.json();
    if (p.aud !== clientId) throw new Error('Token was issued for a different app');
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) throw new Error('Bad issuer');
    if (Number(p.exp) * 1000 < Date.now()) throw new Error('Token expired');
    return {
      sub: p.sub,
      email: p.email_verified === 'true' || p.email_verified === true ? p.email.toLowerCase() : null,
      name: p.name || p.given_name || 'Explorer',
      picture: p.picture || null,
    };
  };
}
