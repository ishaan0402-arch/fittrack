import rateLimit from "express-rate-limit";

// Applied globally as a coarse ceiling against runaway/bot traffic —
// generous enough that normal usage (polling /auth/me, refreshing the
// diary, etc.) never comes close.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// Credential-guessing surface (login, signup, password reset, Google
// token exchange) — tight enough to make brute-forcing impractical
// without blocking a real user who mistypes their password a few times.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

// AI routes hit a paid, per-request API (Claude) — this is as much about
// cost control as abuse prevention once a real ANTHROPIC_API_KEY is set.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Try again in a few minutes." },
});
