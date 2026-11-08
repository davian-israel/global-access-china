import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify Paystack webhook signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          formAction: ["'self'", 'https://checkout.paystack.com'],
        },
      },
    }),
  );
  // Simple per-IP rate limit on the API (one instance). Move to Redis if you run several.
  const hits = new Map<string, { n: number; reset: number }>();
  const limit = Number(process.env.RATE_LIMIT_PER_MIN || 120);
  app.use('/api', (req: any, res: any, next: any) => {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
    else if (++h.n > limit) return res.status(429).json({ message: 'Too many requests. Please wait a minute.' });
    if (hits.size > 50_000) hits.clear();
    next();
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Global-AccessChina listening on ${port}`, 'Bootstrap');
}
bootstrap();
