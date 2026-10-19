import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  CLOUDFRONT_CSP_MAX_LENGTH,
  CSP_THIRD_PARTY_ORIGINS,
} from '../lib/content-security-policy';

/** Parses a header value back into `directive -> sources`. */
function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name = '', ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );
}

describe('Content-Security-Policy', () => {
  const policy = parse(buildContentSecurityPolicy());

  it('allows only same-origin scripts', () => {
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
  });

  it('allows inline styles for Angular component styles, and nothing else inline', () => {
    expect(policy.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(buildContentSecurityPolicy()).not.toContain('unsafe-eval');
  });

  it('allows map tiles from Esri and NOAA', () => {
    expect(policy.get('img-src')).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https://server.arcgisonline.com',
      'https://gis.ngdc.noaa.gov',
    ]);
  });

  it('allows API calls to Open-Meteo and NOAA only', () => {
    expect(policy.get('connect-src')).toEqual([
      "'self'",
      'https://marine-api.open-meteo.com',
      'https://api.open-meteo.com',
      'https://gis.ngdc.noaa.gov',
    ]);
  });

  it('blocks framing, plugins, base-tag hijacking and foreign form targets', () => {
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('font-src')).toEqual(["'self'"]);
  });

  it('lists only HTTPS third-party origins', () => {
    const origins = Object.values(CSP_THIRD_PARTY_ORIGINS).flat();
    expect(origins.every((origin) => origin.startsWith('https://'))).toBe(true);
  });

  it('fits in the CloudFront header limit', () => {
    expect(buildContentSecurityPolicy().length).toBeLessThanOrEqual(CLOUDFRONT_CSP_MAX_LENGTH);
  });
});
