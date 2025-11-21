import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // payload viene de auth.sign({ sub: userId, email })
    // Normalizamos a { id, email } para usar req.user.id en los controllers
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
