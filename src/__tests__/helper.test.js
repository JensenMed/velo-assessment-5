const helpers = require('../../server/providers/helper');

describe('helpers.isKeyMissing', () => {
  test('returns false when all required keys are present', () => {
    const data = { email: 'a@b.com', password: 'pw', fname: 'Alice' };
    expect(helpers.isKeyMissing(data, ['email', 'password', 'fname'])).toBe(false);
  });

  test('returns the first missing key', () => {
    const data = { email: 'a@b.com' };
    expect(helpers.isKeyMissing(data, ['email', 'password'])).toBe('password');
  });

  test('treats empty string and undefined as missing', () => {
    const data = { email: '', password: 'pw' };
    expect(helpers.isKeyMissing(data, ['email', 'password'])).toBe('email');
  });
});