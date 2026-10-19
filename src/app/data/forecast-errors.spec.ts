import { HttpErrorResponse } from '@angular/common/http';
import {
  ForecastError,
  ForecastUnavailableError,
  RateLimitedError,
  toForecastError,
} from './forecast-errors';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: 'https://api.example.com/v1/forecast' });
}

describe('toForecastError', () => {
  it("turns HTTP 429 into a RateLimitedError carrying Open-Meteo's reason", () => {
    const cause = httpError(429, { error: true, reason: 'Hourly API request limit exceeded.' });
    const error = toForecastError(cause);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toBeInstanceOf(ForecastError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitedError');
    expect(error.reason).toBe('Hourly API request limit exceeded.');
    expect(error.message).toBe(error.reason);
    expect(error.cause).toBe(cause);
  });

  it('explains a 429 that came without a reason', () => {
    expect(toForecastError(httpError(429)).reason).toBe('Too many forecast requests');
  });

  it("keeps Open-Meteo's reason for other HTTP errors", () => {
    const error = toForecastError(
      httpError(400, { error: true, reason: 'Latitude must be in range of -90 to 90°.' }),
    );
    expect(error).toBeInstanceOf(ForecastUnavailableError);
    expect(error.name).toBe('ForecastUnavailableError');
    expect(error.reason).toBe('Latitude must be in range of -90 to 90°.');
  });

  it.each([
    [0, null, 'The forecast service could not be reached'],
    [502, '<html>Bad Gateway</html>', 'The forecast service answered HTTP 502'],
    [500, { error: true, reason: '' }, 'The forecast service answered HTTP 500'],
    [503, { error: true, reason: 42 }, 'The forecast service answered HTTP 503'],
  ])('describes HTTP %s with body %j', (status, body, reason) => {
    const error = toForecastError(httpError(status, body));
    expect(error).toBeInstanceOf(ForecastUnavailableError);
    expect(error.reason).toBe(reason);
  });

  it('keeps the message of anything else that went wrong', () => {
    const cause = new Error('The forecast responses have no hours in common');
    const error = toForecastError(cause);
    expect(error).toBeInstanceOf(ForecastUnavailableError);
    expect(error.reason).toBe(cause.message);
    expect(error.cause).toBe(cause);
    expect(toForecastError('oops').reason).toBe('The forecast could not be read');
  });

  it('passes forecast errors through unchanged', () => {
    const error = new RateLimitedError('Slow down');
    expect(toForecastError(error)).toBe(error);
  });
});
