import { Request, Response, NextFunction } from 'express';

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
}
