import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/** HTTP Basic auth for the admin API. Locked completely until ADMIN_PASSWORD is set (12+ characters). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const user = this.config.get('ADMIN_USER', 'admin');
    const pass = this.config.get<string>('ADMIN_PASSWORD');
    const header = String(req.headers.authorization || '');
    if (pass && pass.length >= 12 && header.startsWith('Basic ')) {
      const [u, ...rest] = Buffer.from(header.slice(6), 'base64').toString().split(':');
      const p = rest.join(':');
      if (this.same(u, user) && this.same(p, pass)) return true;
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="GAC admin"');
    throw new UnauthorizedException();
  }

  private same(a: string, b: string) {
    const x = Buffer.from(a ?? '');
    const y = Buffer.from(b ?? '');
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
