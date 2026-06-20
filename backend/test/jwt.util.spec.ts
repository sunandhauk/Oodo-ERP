import { signJwt, verifyJwt } from '../src/common/security/jwt.util';

describe('jwt util', () => {
  it('signs and verifies a payload', () => {
    const token = signJwt(
      {
        sub: 'user-1',
        tenantId: 'default',
        email: 'admin@oodo.local',
        roles: ['admin'],
        permissions: ['requests.read'],
      },
      'secret',
      60,
    );

    const payload = verifyJwt(token, 'secret');
    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('default');
    expect(payload.roles).toContain('admin');
  });
});
