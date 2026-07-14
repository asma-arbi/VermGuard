import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Retourne tous les utilisateurs enregistrés.
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Retourne un utilisateur par son ID unique.
   * Lève une NotFoundException si l'utilisateur n'existe pas.
   */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé.`);
    }
    return user;
  }

  /**
   * Retourne un utilisateur par son email.
   * Lève une NotFoundException si l'utilisateur n'existe pas.
   */
  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'email "${email}" non trouvé.`);
    }
    return user;
  }

  /**
   * Retourne tous les utilisateurs ayant un rôle spécifique.
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.findBy({ role });
  }

  /**
   * Crée un nouvel utilisateur.
   * Lève une ConflictException si l'identifiant Jira existe déjà.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOneBy({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException(
        `Un utilisateur avec l'email "${createUserDto.email}" existe déjà.`,
      );
    }

    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Met à jour un utilisateur existant.
   * Lève une NotFoundException si l'utilisateur n'existe pas.
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // Lève une NotFoundException si non trouvé

    // Si on met à jour l'email, on vérifie s'il n'est pas déjà pris
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneBy({
        email: updateUserDto.email,
      });
      if (existingUser) {
        throw new ConflictException(
          `Un utilisateur avec l'email "${updateUserDto.email}" existe déjà.`,
        );
      }
    }

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Supprime un utilisateur par son ID.
   * Lève une NotFoundException si l'utilisateur n'existe pas.
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id); // Lève une NotFoundException si non trouvé
    await this.userRepository.remove(user);
  }
}
