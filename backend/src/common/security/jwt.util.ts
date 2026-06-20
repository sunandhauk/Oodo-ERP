import crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

const base64UrlEncode = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
};

export const signJwt = (payload: JwtPayload, secret: string, ttlSeconds: number) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload => {
  const [encodedHeader, encodedBody, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedBody || !encodedSignature) {
    throw new Error('Invalid JWT token');
  }

  const data = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest();
  const receivedSignature = base64UrlDecode(encodedSignature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new Error('Invalid JWT signature');
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported JWT header');
  }

  const payload = JSON.parse(base64UrlDecode(encodedBody).toString('utf8')) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT expired');
  }

  return payload;
};
