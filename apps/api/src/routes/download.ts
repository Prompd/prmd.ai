import { Router } from 'express';
import { streamZip } from '../packager.js';
import { downloadRequestSchema } from '../validation.js';

export function downloadRouter(): Router {
  const router = Router();
  router.post('/download', (req, res) => {
    const parsed = downloadRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid request', details: parsed.error.flatten() });
      return;
    }
    streamZip(res, parsed.data.name, parsed.data.files);
  });
  return router;
}
