import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';

const HASH_ROUNDS = 12;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        success: false,
        error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, HASH_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      role: 'OPERATOR', // self sign-up is always OPERATOR; ADMIN is provisioned separately
      isEmailVerified: false,
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as any);

    const verifyUrl = `${this.config.get('appPublicUrl')}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
    const emailResult = await this.mailService.sendVerificationEmail(user.email, user.fullName, verifyUrl);

    return {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailDelivery: emailResult.status, // "SENT" or "LOGGED_ONLY" (SMTP not configured)
    };
  }

  async verifyEmail(email: string, token: string) {
    const user = await this.usersService.findByEmail(email, true);
    if (!user || !user.emailVerificationTokenHash || !user.emailVerificationExpires) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_VERIFICATION', message: 'Invalid or expired verification link.' },
      });
    }
    if (user.emailVerificationExpires.getTime() < Date.now()) {
      throw new BadRequestException({
        success: false,
        error: { code: 'VERIFICATION_EXPIRED', message: 'Verification link expired. Please request a new one.' },
      });
    }
    if (hashToken(token) !== user.emailVerificationTokenHash) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_VERIFICATION', message: 'Invalid verification token.' },
      });
    }

    await this.usersService.updateById(String(user._id), {
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
    } as any);

    return { verified: true };
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.usersService.findByEmail(email, true);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
      });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled by an administrator.' },
      });
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' },
      });
    }

    const tokens = await this.issueTokens(String(user._id), user.email, user.role);
    await this.usersService.updateById(String(user._id), {
      lastLoginAt: new Date(),
      refreshTokenHash: hashToken(tokens.refreshToken),
    } as any);

    return {
      ...tokens,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        operatorPermissions: user.operatorPermissions,
      },
    };
  }

  async issueTokens(userId: string, email: string, role: 'ADMIN' | 'OPERATOR') {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.secret'),
      expiresIn: this.config.get('jwt.expiresIn'),
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: this.config.get('jwt.refreshExpiresIn'),
    });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired.' },
      });
    }

    const user = await this.usersService.findByEmail(payload.email, true);
    if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token does not match any active session.' },
      });
    }

    const tokens = await this.issueTokens(String(user._id), user.email, user.role);
    await this.usersService.updateById(String(user._id), {
      refreshTokenHash: hashToken(tokens.refreshToken),
    } as any);

    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.updateById(userId, { refreshTokenHash: null } as any);
    return { loggedOut: true };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always respond success-shaped to avoid leaking which emails are registered.
    if (!user) return { requested: true };

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.usersService.updateById(String(user._id), {
      passwordResetTokenHash: hashToken(resetToken),
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    } as any);

    const resetUrl = `${this.config.get('appPublicUrl')}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    await this.mailService.sendPasswordResetEmail(user.email, user.fullName, resetUrl);
    return { requested: true };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const user = await this.usersService.findByEmail(email, true);
    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now() ||
      hashToken(token) !== user.passwordResetTokenHash
    ) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_RESET_TOKEN', message: 'Invalid or expired password reset link.' },
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
    await this.usersService.updateById(String(user._id), {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      refreshTokenHash: null, // force re-login on all devices
    } as any);

    return { reset: true };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      operatorPermissions: user.operatorPermissions,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
