import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase, UPLOADS_DIR } from './server/db.ts';
import { setupWebSocketServer } from './server/realtime.ts';
import { adminRouter } from './server/routes/admin.ts';
import { authRouter } from './server/routes/auth.ts';
import { marketplaceRouter } from './server/routes/marketplace.ts';

async function startServer() {
  initDatabase();

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded images safely
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'X-MARKET' });
  });

  app.use('/api', authRouter);
  app.use('/api', marketplaceRouter);
  app.use('/api/admin', adminRouter);

  // Unknown /api routes return JSON 404 rather than HTML
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  setupWebSocketServer(httpServer);

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`X-MARKET server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start X-MARKET server:', err);
  process.exit(1);
});
