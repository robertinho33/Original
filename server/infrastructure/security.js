'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const structuredDataHashes = [...readFileSync(join(__dirname, '../../index.html'), 'utf8')
  .matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => "'sha256-" + createHash('sha256').update(match[1].replace(/\r\n/g, '\n')).digest('base64') + "'");
const contentPolicy = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com " + structuredDataHashes.join(' '),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https: data: blob:",
  "connect-src 'self' https:",
  "frame-src https://www.google.com https://recaptcha.google.com",
  "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'", "form-action 'self'"
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', contentPolicy);
  if (req.secure || (req.get?.('x-forwarded-proto') || '').split(',')[0].trim() === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  next();
}

module.exports = { securityHeaders };
