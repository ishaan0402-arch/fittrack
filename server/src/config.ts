// Centralized so the client origin isn't hardcoded in five different
// files — set CLIENT_ORIGIN in .env when deploying somewhere that isn't
// localhost:5173 (used for CORS, email links, and OAuth redirect targets).
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
