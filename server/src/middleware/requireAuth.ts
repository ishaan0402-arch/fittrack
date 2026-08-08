import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, verifyAuthToken } from "../auth.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  const userId = token ? verifyAuthToken(token) : null;

  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.userId = userId;
  next();
}
