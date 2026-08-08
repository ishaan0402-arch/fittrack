import { OAuth2Client } from "google-auth-library";

export function googleSignInConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID) && !process.env.GOOGLE_CLIENT_ID!.startsWith("get_one_at_");
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

// Verifies the ID token Google Identity Services hands the frontend after a
// successful "Sign in with Google" — this is the whole trust boundary, so
// it must go through Google's own library (checks signature, audience,
// issuer, expiry) rather than just decoding the JWT payload.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google token did not include the expected identity fields");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    name: payload.name ?? null,
  };
}
