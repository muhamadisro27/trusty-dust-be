import { NotificationGateway } from './notification.gateway';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;

  beforeEach(() => {
    gateway = new NotificationGateway();
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  it('handleConnection joins room when userId provided', () => {
    const join = jest.fn();
    gateway.handleConnection({ handshake: { query: { userId: 'user' } }, join } as any);
    expect(join).toHaveBeenCalledWith('user');
  });

  it('emit sends events when server available', () => {
    gateway.emit('user', { id: 1 });
    expect(gateway.server.to).toHaveBeenCalledWith('user');
    expect(gateway.server.emit).toHaveBeenCalledWith('notification:public', { userId: 'user', payload: { id: 1 } });
  });
});
