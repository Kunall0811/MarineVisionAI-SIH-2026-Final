import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Fetches the live user record on every request (rather than trusting
    // only the JWT claims) so that operatorPermissions, isActive and role
    // changes made by an Admin take effect immediately - without this,
    // permission checks in controllers/FRIDAY that read
    // user.operatorPermissions would silently always pass, since none of
    // that lives in the JWT payload itself.
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'This account is inactive or no longer exists.' },
      });
    }
    return {
      userId: String(user._id),
      id: String(user._id),
      email: user.email,
      role: user.role,
      operatorPermissions: user.operatorPermissions,
    };
  }
}
