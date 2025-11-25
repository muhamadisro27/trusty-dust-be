import { AppService } from './app.service';

describe('AppService', () => {
  it('returns status with ISO timestamp', () => {
    const service = new AppService();
    const result = service.getStatus();
    expect(result.status).toBe('ok');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
