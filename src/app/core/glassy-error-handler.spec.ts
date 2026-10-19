import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppNotices } from './app-notices';
import { GlassyErrorHandler, provideGlassyErrorHandler } from './glassy-error-handler';

describe('GlassyErrorHandler', () => {
  let handler: ErrorHandler;
  let notices: AppNotices;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideGlassyErrorHandler()] });
    handler = TestBed.inject(ErrorHandler);
    notices = TestBed.inject(AppNotices);
  });

  afterEach(() => {
    log.mockRestore();
  });

  /** An error thrown from one place in the app, the same every time it happens. */
  const fault = (message = 'Cannot read properties of undefined'): Error => {
    const error = new TypeError(message);
    error.stack = `TypeError: ${message}\n    at tick (main.js:1:2)`;
    return error;
  };

  it('is the app’s error handler', () => {
    expect(handler).toBeInstanceOf(GlassyErrorHandler);
  });

  it('logs an unexpected error with its details and raises a notice', () => {
    const error = new Error('Boom');
    handler.handleError(error);

    expect(log).toHaveBeenCalledExactlyOnceWith('Glassy: unexpected error', error);
    expect(notices.latest()?.kind).toBe('unexpected-error');
  });

  it('logs an error that keeps happening only once', () => {
    for (let i = 0; i < 5; i++) handler.handleError(fault());
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('logs different errors separately', () => {
    handler.handleError(new Error('First'));
    handler.handleError(new RangeError('Second'));
    handler.handleError('a thrown string');
    handler.handleError(undefined);

    expect(log).toHaveBeenCalledTimes(4);
  });

  it('copes with values that cannot be turned into text', () => {
    const odd = Object.create(null) as object;
    handler.handleError(odd);
    handler.handleError(odd);

    expect(log).toHaveBeenCalledTimes(1);
    expect(notices.latest()?.kind).toBe('unexpected-error');
  });

  it('forgets the oldest errors after many distinct ones, and can log them again', () => {
    handler.handleError(fault());
    for (let i = 0; i < 50; i++) handler.handleError(fault(`Fault ${i}`));
    log.mockClear();

    handler.handleError(fault());
    handler.handleError(fault('Fault 49'));
    expect(log).toHaveBeenCalledTimes(1);
  });
});
