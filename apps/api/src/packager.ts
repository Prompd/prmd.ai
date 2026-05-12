import archiver from 'archiver';
import type { Response } from 'express';
import type { GeneratedFile } from '@prmd/shared';

export function streamZip(res: Response, name: string, files: GeneratedFile[]): void {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'agent-pack';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    // Log internally; don't leak the archive library's error details to the
    // client (could include file system paths or library internals).
    console.error(`packager: zip stream error — ${err.message}`);
    if (!res.headersSent) {
      res.status(500).end('zip stream failed');
    } else {
      res.end();
    }
  });
  archive.pipe(res);
  for (const file of files) {
    archive.append(file.contents, { name: file.path });
  }
  void archive.finalize();
}
