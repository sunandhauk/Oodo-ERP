import crypto from 'crypto';

const derive = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${derive(password, salt)}`;
};

export const verifyPassword = (password: string, hashed: string) => {
  const [salt, stored] = hashed.split(':');
  if (!salt || !stored) {
    return false;
  }
  const derived = derive(password, salt);
  if (stored.length !== derived.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(derived, 'hex'));
};
