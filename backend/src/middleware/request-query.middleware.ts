import { Request, Response, NextFunction } from 'express';

// คงค่า req.query ให้แก้ไขได้ใน Express 5 เพื่อให้ sanitizer ของ express-validator ทำงานได้
export const preserveRequestQuery = (req: Request, _res: Response, next: NextFunction): void => {
  Object.defineProperty(req, 'query', {
    value: req.query,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
};
