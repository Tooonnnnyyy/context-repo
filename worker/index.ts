import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

interface Env { DB: D1Database; ASSETS: Fetcher; BETTER_AUTH_SECRET: string; APP_ORIGIN?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; RESEND_API_KEY?: string; EMAIL_FROM?: string; ENVIRONMENT?: string }

/** Sends the email-verification link through Resend when a key is configured. Returns false (never throws) so
 *  a transient email failure does not surface a raw provider error to the sign-up response. */
async function sendVerificationEmail(env: Env, to: string, url: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Context <onboarding@resend.dev>',
        to: [to],
        subject: 'Verify your Context email',
        text: `Welcome to Context. Confirm your email to finish signing up: ${url}\n\nIf you did not create this account, ignore this email.`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function auth(env: Env, origin: string) {
  const emailVerificationEnabled = Boolean(env.RESEND_API_KEY);
  return betterAuth({
    appName: 'Context',
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema, transaction: false }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: emailVerificationEnabled, autoSignIn: true },
    // Google sign-in links to an existing account only when that account's email is verified. A password
    // sign-up leaves emailVerified=false until the link is confirmed, so a pre-registered address cannot be
    // captured by its real owner's Google sign-in (requireLocalEmailVerified, fails closed).
    account: { accountLinking: { enabled: true, requireLocalEmailVerified: true, allowDifferentEmails: false } },
    emailVerification: emailVerificationEnabled
      ? {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) => { await sendVerificationEmail(env, user.email, url); },
        }
      : undefined,
    user: { deleteUser: { enabled: true } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    trustedOrigins: [origin],
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : undefined,
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      useSecureCookies: origin.startsWith('https:'),
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    rateLimit: {
      enabled: true, window: 60, max: 100, storage: 'database',
      customRules: { '/sign-up/email': { window: 60, max: 5 }, '/sign-in/email': { window: 60, max: 8 } },
    },
    logger: { level: 'error' },
  })
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const origin = env.APP_ORIGIN || url.origin
    let response: Response
    if (url.pathname === '/api/health') {
      response = Response.json({ service: 'context', version: '0.1.0', environment: env.ENVIRONMENT || 'local', accounts: Boolean(env.DB && env.BETTER_AUTH_SECRET), google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), notes: 'browser-local' })
    } else if (url.pathname.startsWith('/api/auth/')) {
      if (!env.DB || !env.BETTER_AUTH_SECRET) response = Response.json({ message: 'Accounts are not configured on this deployment. You can use a local workspace.' }, { status: 503 })
      else if (request.method !== 'GET' && request.headers.get('origin') !== origin) response = Response.json({ message: 'This request must come from this site.' }, { status: 403 })
      else if (request.method !== 'GET' && Number(request.headers.get('content-length') || 0) > 16384) response = Response.json({ message: 'Request is too large.' }, { status: 413 })
      else if (request.method !== 'GET') {
        // Enforce the cap on the bytes actually read: a chunked body omits Content-Length,
        // so the header check above is only a fast path. Buffer once, re-check, then hand
        // the same bytes to the auth handler.
        const bytes = await request.arrayBuffer()
        if (bytes.byteLength > 16384) response = Response.json({ message: 'Request is too large.' }, { status: 413 })
        else response = await auth(env, origin).handler(new Request(request, { body: bytes.byteLength ? bytes : undefined }))
      }
      else response = await auth(env, origin).handler(request)
    } else if (url.pathname.startsWith('/api/')) {
      response = Response.json({ message: 'Not found' }, { status: 404 })
    } else response = await env.ASSETS.fetch(request)
    const result = new Response(response.body, response)
    result.headers.set('X-Content-Type-Options', 'nosniff')
    result.headers.set('Referrer-Policy', 'no-referrer')
    result.headers.set('X-Frame-Options', 'DENY')
    result.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
    if (url.pathname.startsWith('/api/')) result.headers.set('Cache-Control', 'no-store')
    return result
  },
}
