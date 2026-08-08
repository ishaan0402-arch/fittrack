import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't catch rejected promises from async route handlers, so an
// unhandled rejection crashes the whole process. This wraps a handler so any
// rejection gets passed to next(), reaching Express's error middleware instead.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
