import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/userCreateDto';
import { UpdateUserDto } from '../dto/userUpdateDto';
import { User , UserPivot} from '../entity/user';
import { logger } from '../../logger';
import {Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from '../../cloudinary/cloudinaryService';
import { dbAuth } from '../auth/preauthMiddleware';
import { NotFoundException } from '@nestjs/common';
import { UserRepository } from "../repository/userRepository";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private cloudinary: CloudinaryService
  ) {}

  // @InjectRepository(User)
  // usersRepository: Repository<User>;
  @Inject()
  usersRepository: UserRepository;

  async create(createUserDto: CreateUserDto): Promise<User> {
    const auth = await dbAuth.createUser({
      email: createUserDto.email,
      password: createUserDto.password
    });
    createUserDto.authUid = auth.uid;
    createUserDto.avatar = process.env.AVATAR_URL;
    const user = await this.usersRepository.create(createUserDto);
    if (!user) {
      throw new BadRequestException(`Method Not Allowed`);
    }
    return user;
  }

  async findAll(): Promise<UserPivot[]> {
    return await this.usersRepository.findAll();
  }

  async findOneById(id: number): Promise<User> {
    let user;
    try {
      user = await this.userRepository.findOne(id);
    } catch (error) {
      logger.error(`User with ID=${id} not found` + error);
    }
    return user;
  }

  async findOne(authUid: string): Promise<User> {
    let user;
    try {
      user = await this.usersRepository.findOne(authUid);
    } catch (error) {
      logger.error(`User with ID=${authUid} not found` + error);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.update(id, updateUserDto);
    if (!user) {
      throw new NotFoundException(`User with ID=${id} not found`);
    }
    return user;
  }

  async remove(id: number, uid: string): Promise<User> {
    const user = await this.findOne(uid);
    if (user.isAdmin) {
      try {
        return await this.usersRepository.remove(id);
      }catch (err){
        throw {
          statusCode:404,
          message: 'Not Found'
        };
      }
    }
    else{
      throw {
        statusCode:400,
        message: 'User doesn`t have access to delete other users'
      };
    }
  }

  async changeSalary(
    userId: string,
    salary: number,
    id: number
  ): Promise<User> {
    const user = await this.usersRepository.findOne(userId);
    if (user.isAdmin) {
      const changeSal = await this.userRepository.preload({
        id: id,
        salary: salary
      });
      if (!changeSal) {
        throw new NotFoundException(
          `User with ID=${userId} not found or not admin`
        );
      }
      return this.userRepository.save(changeSal);
    }
  }

  async uploadImageToCloudinary(file: Express.Multer.File, id: string) {
    const userId = await this.usersRepository.findOne(id);
    if (userId.avatarPublicId) {
      await this.cloudinary.deleteImg(userId.avatarPublicId);
    }
    const cloudinaryRes = await this.cloudinary.uploadImage(file);
    const user = await this.userRepository.preload({
      id: userId.id,
      avatar: cloudinaryRes.url,
      avatarPublicId: cloudinaryRes.public_id
    });
    return this.userRepository.save(user);
  }
}
