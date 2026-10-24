import { type App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { readConfig } from './config';
import { GlassyStaticSiteStack } from './glassy-static-site-stack';

export const STACK_ID = 'GlassyStaticSite';

/**
 * Adds the Glassy stack to `app`, configured from the app's context.
 *
 * Used by `bin/glassy.ts` and by the tests, so both build exactly the same
 * thing, cdk-nag checks included.
 */
export function addGlassyStack(app: App): GlassyStaticSiteStack {
  const config = readConfig(app.node);

  const stack = new GlassyStaticSiteStack(app, STACK_ID, {
    description:
      'Glassy: Oahu snorkel forecast map, served from S3 and CloudFront, with a scheduled ' +
      'forecast ingest',
    // The region is pinned (not taken from the local AWS profile) so every
    // machine synthesises the same template. The account comes from the
    // credentials used for `cdk deploy`.
    env: { account: process.env['CDK_DEFAULT_ACCOUNT'], region: config.region },
    github: config.github,
    createOidcProvider: config.createOidcProvider,
    oidcProviderArn: config.oidcProviderArn,
    customDomain: config.customDomain,
    removalPolicy: config.removalPolicy,
    forecastCorsOrigin: config.forecastCorsOrigin,
    alarmEmail: config.alarmEmail,
  });

  Tags.of(app).add('Project', 'glassy');
  Tags.of(app).add('Owner', config.github.repository.split('/')[0] ?? 'unknown');
  Tags.of(app).add('Environment', config.github.environment || 'production');

  // AWS Solutions best-practice rules. Any finding that is not acknowledged
  // next to its resource, with a reason, fails `cdk synth` and the tests.
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return stack;
}
