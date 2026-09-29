import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditService: AuditService,
  ) {}

  @Post()
  @Roles('ADMIN')
  async create(
    @CurrentUser() actor: any,
    @Body() body: { fullName: string; email: string; password: string; role?: 'ADMIN' | 'OPERATOR' },
  ) {
    const existing = await this.usersService.findByEmail(body.email);
    if (existing) {
      throw new ConflictException({ success: false, error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' } });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await this.usersService.create({
      fullName: body.fullName,
      email: body.email.toLowerCase().trim(),
      passwordHash,
      role: body.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
      isEmailVerified: true, // Admin-provisioned accounts skip email verification
      isActive: true,
    } as any);

    await this.auditService.record({
      userId: actor.userId, userEmail: actor.email, userRole: actor.role,
      action: 'USER_CREATED', category: 'USERS', targetType: 'User', targetId: String(user._id),
      metadata: { email: user.email, role: user.role },
    });

    return {
      success: true,
      data: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, isActive: user.isActive },
    };
  }

  @Get()
  @Roles('ADMIN')
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    const [users, total] = await this.usersService.findAllPaginated(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      success: true,
      data: users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        operatorPermissions: u.operatorPermissions,
        lastLoginAt: u.lastLoginAt,
        createdAt: (u as any).createdAt,
      })),
      meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) },
    };
  }

  @Get(':id')
  @Roles('ADMIN')
  async get(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, data: user };
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@CurrentUser() actor: any, @Param('id') id: string, @Body() body: any) {
    const allowed = ['fullName', 'role', 'isActive', 'operatorPermissions'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    const user = await this.usersService.updateById(id, update);
    await this.auditService.record({
      userId: actor.userId, userEmail: actor.email, userRole: actor.role,
      action: 'USER_UPDATED', category: 'USERS', targetType: 'User', targetId: id, metadata: update,
    });
    return { success: true, data: user };
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@CurrentUser() actor: any, @Param('id') id: string) {
    await this.usersService.deleteById(id);
    await this.auditService.record({
      userId: actor.userId, userEmail: actor.email, userRole: actor.role,
      action: 'USER_DELETED', category: 'USERS', targetType: 'User', targetId: id,
    });
    return { success: true, data: { id } };
  }
}
