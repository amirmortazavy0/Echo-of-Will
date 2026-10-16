import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { readAppData } from './storage';
// The request digest is captured before command validation adds defaults.
export function replayCapture(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST' || req.path !== '/api/sessions/quick-log') return next();
  const id = req.header('Idempotency-Key');
  if (!id) return next();
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(id)) return res.status(400).json({detail:'Invalid command identity'});
  const digest = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  const username = (req as any).user?.username;
  const prior = (readAppData() as any).command_receipts?.find((r:any)=>r.id===id);
  if (prior) {
    if (prior.username !== username || prior.digest !== digest) return res.status(409).json({detail:'Command identity belongs to a different owner or payload; pending record retained'});
    return res.status(201).json(prior.response);
  }
  (req as any).captureCommand = {id,digest,username};
  next();
}
