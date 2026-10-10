import { Request, Response, NextFunction } from 'express';

// Express 5 reparses query parameters on each getter access. Keep one request-local
// object so express-validator sanitizers remain visible to the controllers.
export const preserveRequestQuery = (req: Request, _res: Response, next: NextFunction): void => {
  Object.defineProperty(req, 'query', {
    value: req.query,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
};
