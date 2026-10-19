import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import cdkJson from '../cdk.json';
import { addGlassyStack } from '../lib/glassy-app';
import type { GlassyStaticSiteStack } from '../lib/glassy-static-site-stack';

/** Builds the app the way `bin/glassy.ts` does, with extra context on top. */
export function buildApp(context: Record<string, unknown> = {}): {
  app: App;
  stack: GlassyStaticSiteStack;
} {
  // Feature flags from cdk.json, so tests synthesise what `cdk synth` does.
  const app = new App({ context: { ...cdkJson.context, ...context } });
  return { app, stack: addGlassyStack(app) };
}

export function synthTemplate(context: Record<string, unknown> = {}): Template {
  return Template.fromStack(buildApp(context).stack);
}

/** Context that switches on the custom domain. */
export const CUSTOM_DOMAIN_CONTEXT = {
  domainName: 'glassy.example.com',
  hostedZoneId: 'Z0123456789EXAMPLE',
  hostedZoneName: 'example.com',
} as const;
