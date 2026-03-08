const request = require('supertest');
const app = require('../server');
const speakeasy = require('speakeasy');

// MFA Tests
describe('MFA APIs', () => {
  test('POST /api/auth/mfa/setup should generate a QR code and secret', async () => {
    const response = await request(app).post('/api/auth/mfa/setup');
    expect(response.status).toBe(200);
    expect(response.body.qrCode).toBeDefined();
    expect(response.body.secret).toBeDefined();
  });

  test('POST /api/auth/mfa/verify should validate valid tokens', async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const token = speakeasy.totp({ secret, encoding: 'base32' });

    const response = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ token, secret });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('POST /api/auth/mfa/verify should fail for invalid tokens', async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;

    const response = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ token: '123456', secret });
    expect(response.status).toBe(400);
    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toBe('Invalid token.');
  });
});
