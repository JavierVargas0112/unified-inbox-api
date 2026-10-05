import { Logger } from '@nestjs/common';
import { Channel } from '../common/channel';
import { LoggingOutboundSender } from './outbound-sender';

describe('LoggingOutboundSender', () => {
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

  afterAll(() => log.mockRestore());

  it.each([
    [Channel.Email, 'guest@example.com'],
    [Channel.Sms, '+33612345678'],
    [Channel.WhatsApp, '+33612345678'],
  ])('logs a %s reply to the right address and returns a local id', async (channel, to) => {
    const result = await new LoggingOutboundSender().send({
      channel,
      to: { email: 'guest@example.com', phone: '+33612345678' },
      body: 'Hello',
    });

    expect(result.externalId).toMatch(/^local-[0-9a-f-]{36}$/);
    expect(log).toHaveBeenLastCalledWith(`[${channel}] → ${to}: Hello`);
  });
});
