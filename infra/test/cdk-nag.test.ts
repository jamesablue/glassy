import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, expect, it } from 'vitest';
import { buildApp, CUSTOM_DOMAIN_CONTEXT } from './support';

describe('cdk-nag AwsSolutions checks', () => {
  it.each([
    ['the default domain', {}],
    ['a custom domain', CUSTOM_DOMAIN_CONTEXT],
    [
      'an imported OIDC provider and a deletable bucket',
      {
        createOidcProvider: false,
        removalPolicy: 'destroy',
      },
    ],
    ['an alarm email subscription', { alarmEmail: 'ops@example.com' }],
  ])('pass with %s', (_mode, context) => {
    const { app } = buildApp(context);

    expect(() => app.synth()).not.toThrow();
  });

  it('fail synthesis on a finding that has not been acknowledged', () => {
    const { app, stack } = buildApp();
    new Bucket(stack, 'UncheckedBucket');

    expect(() => app.synth()).toThrow(/AwsSolutions-S1/);
  });
});
