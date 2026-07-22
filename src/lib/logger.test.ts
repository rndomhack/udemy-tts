import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, setLogLevel } from './logger';

describe('logger', () => {
  afterEach(() => {
    setLogLevel('error');
    vi.restoreAllMocks();
  });

  it('logs only errors by default', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const log = createLogger('test');
    log.error('boom');
    log.info('hello');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('respects the configured level dynamically', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const log = createLogger('test');
    log.debug('before');
    setLogLevel('debug');
    log.debug('after');
    expect(debugSpy).toHaveBeenCalledOnce();
    expect(debugSpy).toHaveBeenCalledWith('[UdemyTTS:test]', 'after');
  });
});
