import { Request, Response, NextFunction } from 'express';
import { getDemoUserId } from '../demoUser';

export function requireUser(req: Request, res: Response, next: NextFunction) {
  getDemoUserId()
    .then((id) => {
      req.userId = id;
      next();
    })
    .catch((err) => {
      console.error('requireUser:', err);
      next(err);
    });
}
