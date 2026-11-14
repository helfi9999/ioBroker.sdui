'use strict';

function loginBody(config) {
  return {
    identifier: String(config.identifier || '').trim(),
    password: String(config.password || ''),
    showError: true,
    slink: String(config.slink || '').trim(),
    token: ''
  };
}

function parseLoginResponse(payload, nowMs = Date.now()) {
  if (payload?.status !== 'SUCCESS') throw new Error('Sdui login did not succeed');
  const data = payload?.data;
  if (!data || data.token_type !== 'Bearer' || typeof data.access_token !== 'string' || !data.access_token.trim()) {
    throw new Error('Unexpected Sdui login response (Bearer token missing)');
  }
  const seconds = Number(data.expires_in);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid token expiration');
  return { accessToken: data.access_token, expiresAt: nowMs + seconds * 1000 };
}

module.exports = { loginBody, parseLoginResponse };
