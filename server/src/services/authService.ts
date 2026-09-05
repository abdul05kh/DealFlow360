import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { verifyFirebaseToken } from '../config/firebaseAdmin';
import { LoginInput, SignupInput } from '../schemas/authSchema';

const prisma = new PrismaClient();

export interface JwtPayload {
  userId: string;
  role: string;
  customerId?: string | null;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customerId?: string | null;
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};

export const signupUser = async (input: SignupInput): Promise<AuthResponse> => {
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1. Check duplicate email
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    const error: any = new Error('Email is already registered');
    error.statusCode = 400;
    throw error;
  }

  // 2. Role restriction: Public signup cannot self-register as ADMIN, SALES_MANAGER, or OPERATIONS_MANAGER
  const forbiddenRoles = ['ADMIN', 'SALES_MANAGER', 'OPERATIONS_MANAGER'];
  if (forbiddenRoles.includes(input.role)) {
    const error: any = new Error(
      `Public signup cannot create accounts with privileged role: ${input.role}`
    );
    error.statusCode = 403;
    throw error;
  }

  let customerId: string | null = null;
  const role = input.role || 'SALES_REP';

  // 3. Customer role validation
  if (role === 'CUSTOMER') {
    if (!input.customerId) {
      const error: any = new Error('Customer ID is required for CUSTOMER role');
      error.statusCode = 400;
      throw error;
    }
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      const error: any = new Error('Customer does not exist');
      error.statusCode = 400;
      throw error;
    }
    customerId = customer.id;
  }

  // 4. Hash password
  const passwordHash = await bcrypt.hash(input.password, 10);

  // 5. Create user
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: normalizedEmail,
      passwordHash,
      role,
      customerId,
    },
  });

  const safeUser: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customerId,
  };

  const token = generateToken({
    userId: user.id,
    role: user.role,
    customerId: user.customerId,
  });

  return { user: safeUser, token };
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    const error: any = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (user.isActive === false) {
    const error: any = new Error('Account is deactivated. Contact System Administrator.');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    const error: any = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const safeUser: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customerId,
  };

  const token = generateToken({
    userId: user.id,
    role: user.role,
    customerId: user.customerId,
  });

  return { user: safeUser, token };
};

export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.isActive === false) {
    const error: any = new Error('User account is deactivated or invalid');
    error.statusCode = 401;
    throw error;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customerId,
  };
};

export const authenticateFirebaseUser = async (idToken: string): Promise<AuthResponse> => {
  const decoded = await verifyFirebaseToken(idToken);
  if (!decoded || !decoded.uid) {
    const error: any = new Error('Invalid or expired Firebase token');
    error.statusCode = 401;
    throw error;
  }

  // 1. First attempt lookup by firebaseUid
  let user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });

  // 2. If not found by firebaseUid, perform safe one-time link by verified token email
  if (!user && decoded.email) {
    const normalizedEmail = decoded.email.trim().toLowerCase();
    const existingByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { firebaseUid: decoded.uid },
      });
    }
  }

  if (!user) {
    const error: any = new Error('Firebase account not linked to an active DealFlow360 user.');
    error.statusCode = 401;
    throw error;
  }

  if (user.isActive === false) {
    const error: any = new Error('Account is deactivated. Contact System Administrator.');
    error.statusCode = 401;
    throw error;
  }

  const safeUser: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customerId,
  };

  const token = generateToken({
    userId: user.id,
    role: user.role,
    customerId: user.customerId,
  });

  return { user: safeUser, token };
};
