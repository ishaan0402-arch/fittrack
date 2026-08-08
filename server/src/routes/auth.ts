import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { AUTH_COOKIE, hashPassword, verifyPassword, signAuthToken } from "../auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { verifyGoogleIdToken, googleSignInConfigured } from "../googleAuth.js";

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matches the JWT's own expiry
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Shared by signup and "resend verification" — same shape as the password
// reset token flow, and for the same reason: no email provider is
// configured yet, so the link is logged and handed back in the response
// instead of actually emailed.
async function createEmailVerificationLink(userId: number, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );

  const link = `http://localhost:5173/verify-email?token=${token}`;
  console.log(`[email verification] ${email} -> ${link}`);
  return link;
}

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
    [email, passwordHash]
  );
  const user = result.rows[0];

  const devVerificationLink = await createEmailVerificationLink(user.id, user.email);

  res.cookie(AUTH_COOKIE, signAuthToken(user.id), COOKIE_OPTIONS);
  res.status(201).json({ id: user.id, email: user.email, devVerificationLink });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  // password_hash is null for Google-only accounts — bcrypt.compare would
  // throw on a null hash, so this must short-circuit before calling it.
  const valid = user?.password_hash ? await verifyPassword(password, user.password_hash) : false;

  if (!valid) {
    const isGoogleOnly = user && !user.password_hash;
    res.status(401).json({
      error: isGoogleOnly ? "This account signs in with Google, not a password." : "Invalid email or password",
    });
    return;
  }

  res.cookie(AUTH_COOKIE, signAuthToken(user.id), COOKIE_OPTIONS);
  res.json({ id: user.id, email: user.email });
}));

authRouter.post("/google", asyncHandler(async (req, res) => {
  if (!googleSignInConfigured()) {
    res.status(503).json({ error: "Google sign-in isn't set up yet — add a real GOOGLE_CLIENT_ID in server/.env." });
    return;
  }

  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: "idToken is required" });
    return;
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch (err) {
    console.warn("Google ID token verification failed:", (err as Error).message);
    res.status(401).json({ error: "Google sign-in failed — that token couldn't be verified." });
    return;
  }

  // Three cases: returning Google user, an existing email/password account
  // signing in with Google for the first time (link it), or a brand new user.
  let user = (await pool.query("SELECT id, email FROM users WHERE google_id = $1", [identity.googleId])).rows[0];

  if (!user) {
    const byEmail = await pool.query("SELECT id, email FROM users WHERE email = $1", [identity.email]);
    if (byEmail.rows.length > 0) {
      user = (
        await pool.query(
          `UPDATE users SET google_id = $1, email_verified = email_verified OR $2, name = COALESCE(name, $3)
           WHERE id = $4 RETURNING id, email`,
          [identity.googleId, identity.emailVerified, identity.name, byEmail.rows[0].id]
        )
      ).rows[0];
    } else {
      user = (
        await pool.query(
          `INSERT INTO users (email, google_id, email_verified, name)
           VALUES ($1, $2, $3, $4) RETURNING id, email`,
          [identity.email, identity.googleId, identity.emailVerified, identity.name]
        )
      ).rows[0];
    }
  }

  res.cookie(AUTH_COOKIE, signAuthToken(user.id), COOKIE_OPTIONS);
  res.json({ id: user.id, email: user.email });
}));

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, name, email_verified, google_id IS NOT NULL AS is_google FROM users WHERE id = $1",
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const profile = await pool.query(
    "SELECT 1 FROM user_profiles WHERE user_id = $1",
    [req.userId]
  );

  const user = result.rows[0];
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.email_verified,
    isGoogleAccount: user.is_google,
    hasProfile: profile.rows.length > 0,
  });
}));

authRouter.post("/verify-email", asyncHandler(async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "A token is required" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const result = await pool.query(
    `SELECT id, user_id FROM email_verification_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    res.status(400).json({ error: "This verification link is invalid or has expired." });
    return;
  }

  const { id: tokenId, user_id: userId } = result.rows[0];
  await pool.query("UPDATE users SET email_verified = true WHERE id = $1", [userId]);
  await pool.query("UPDATE email_verification_tokens SET used_at = now() WHERE id = $1", [tokenId]);

  res.json({ message: "Email verified" });
}));

authRouter.post("/resend-verification", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT email, email_verified FROM users WHERE id = $1", [req.userId]);
  const user = result.rows[0];
  if (!user || user.email_verified) {
    res.status(400).json({ error: "This account is already verified." });
    return;
  }

  const devVerificationLink = await createEmailVerificationLink(req.userId!, user.email);
  res.json({ message: "Verification link sent.", devVerificationLink });
}));

authRouter.post("/request-password-reset", asyncHandler(async (req, res) => {
  const { email } = req.body as { email?: string };
  const result = email
    ? await pool.query("SELECT id FROM users WHERE email = $1", [email])
    : { rows: [] };

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  if (result.rows.length === 0) {
    res.json({ message: "If that email has an account, a reset link has been sent." });
    return;
  }

  const userId = result.rows[0].id;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );

  const resetLink = `http://localhost:5173/reset-password?token=${token}`;

  // No email provider is configured yet, so this just logs the link instead
  // of sending it. Swap this for a real email send (e.g. Resend, SES, SMTP)
  // once credentials exist — see the note left for the user about this.
  console.log(`[password reset] ${email} -> ${resetLink}`);

  res.json({
    message: "If that email has an account, a reset link has been sent.",
    devResetLink: resetLink,
  });
}));

// Dev-only shortcut so local development doesn't require signing up/logging
// in every session. Double-gated: only registered when NODE_ENV isn't
// "production", and the dev server never sets that env var.
if (process.env.NODE_ENV !== "production") {
  authRouter.post("/dev-login", asyncHandler(async (_req, res) => {
    const DEV_EMAIL = "dev@fittrack.local";
    const existing = await pool.query("SELECT id, email FROM users WHERE email = $1", [
      DEV_EMAIL,
    ]);

    let user = existing.rows[0];
    if (!user) {
      const passwordHash = await hashPassword(crypto.randomBytes(16).toString("hex"));
      const created = await pool.query(
        "INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, true) RETURNING id, email",
        [DEV_EMAIL, passwordHash]
      );
      user = created.rows[0];

      // Give the dev user a default profile too, so bypassing login also
      // skips profile setup and drops straight into the app.
      await pool.query(
        `INSERT INTO user_profiles (user_id, height_cm, weight_kg, gender, age, activity_level)
         VALUES ($1, 178, 75, 'male', 30, 'moderately_active')`,
        [user.id]
      );
    }

    res.cookie(AUTH_COOKIE, signAuthToken(user.id), COOKIE_OPTIONS);
    res.json({ id: user.id, email: user.email });
  }));
}

authRouter.post("/reset-password", asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "A token and a password of at least 8 characters are required" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const result = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  const { id: tokenId, user_id: userId } = result.rows[0];
  const passwordHash = await hashPassword(newPassword);

  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
  await pool.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [tokenId]);

  res.json({ message: "Password updated" });
}));
