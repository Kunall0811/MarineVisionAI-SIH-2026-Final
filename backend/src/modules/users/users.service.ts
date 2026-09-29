import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { User } from '../../store/types';

@Injectable()
export class UsersService {
  constructor(private readonly store: MemoryStore) {}

  private get userModel() {
    return this.store.users;
  }

  findByEmail(email: string, withSecrets = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase().trim() });
    if (withSecrets) {
      query.select('+passwordHash +refreshTokenHash +emailVerificationTokenHash +passwordResetTokenHash');
    }
    return query.exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  updateById(id: string, update: Partial<User>) {
    return this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  findAllPaginated(page = 1, limit = 20, filter: Record<string, any> = {}) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
  }

  deleteById(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
