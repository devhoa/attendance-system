import jwt from 'jsonwebtoken';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

const JWT_SECRET = process.env.JWT_SECRET || 'attendance-system-dev-secret';

export function signToken(user: AuthUser) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyToken(token?: string | null) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };

    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    } satisfies AuthUser;
  } catch {
    return null;
  }
}
