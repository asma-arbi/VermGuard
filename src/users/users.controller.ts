import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  ParseEnumPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiHeader } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './enums/user-role.enum';
import { User } from './entities/user.entity';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // -------------------------------------------------------
  // POST /users — PUBLIC (Sign Up, also used by Manager)
  // -------------------------------------------------------
  @Post()
  @ApiOperation({ summary: 'Create a new user (public sign-up)' })
  @ApiResponse({ status: 201, description: 'User created successfully.', type: User })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 409, description: 'A user with this email already exists.' })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  // -------------------------------------------------------
  // GET /users — Requires x-role header (any role)
  // -------------------------------------------------------
  @Get()
  @UseGuards(RolesGuard)
  @ApiHeader({ name: 'x-role', enum: UserRole, required: true })
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of all users.', type: [User] })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  // -------------------------------------------------------
  // GET /users/role/:role — Requires x-role header (any role)
  // -------------------------------------------------------
  @Get('role/:role')
  @UseGuards(RolesGuard)
  @ApiHeader({ name: 'x-role', enum: UserRole, required: true })
  @ApiOperation({ summary: 'Filter users by role' })
  @ApiParam({ name: 'role', enum: UserRole })
  @ApiResponse({ status: 200, description: 'List of users with the given role.', type: [User] })
  async findByRole(
    @Param('role', new ParseEnumPipe(UserRole)) role: UserRole,
  ): Promise<User[]> {
    return this.usersService.findByRole(role);
  }

  // -------------------------------------------------------
  // GET /users/:id — Requires x-role header (any role)
  // -------------------------------------------------------
  @Get(':id')
  @UseGuards(RolesGuard)
  @ApiHeader({ name: 'x-role', enum: UserRole, required: true })
  @ApiOperation({ summary: 'Get a specific user by ID' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'The user.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.findOne(id);
  }

  // -------------------------------------------------------
  // PATCH /users/:id — Manager & authorized staff
  // -------------------------------------------------------
  @Patch(':id')
  @UseGuards(RolesGuard)
  @ApiHeader({ name: 'x-role', enum: UserRole, required: true })
  @ApiOperation({ summary: 'Update a user (Manager & authorized staff)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'User updated successfully.', type: User })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiBody({ type: UpdateUserDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  // -------------------------------------------------------
  // DELETE /users/:id — Manager & authorized staff
  // -------------------------------------------------------
  @Delete(':id')
  @UseGuards(RolesGuard)
  @ApiHeader({ name: 'x-role', enum: UserRole, required: true })
  @ApiOperation({ summary: 'Delete a user (Manager & authorized staff)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
