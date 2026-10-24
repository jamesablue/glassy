import { RemovalPolicy } from 'aws-cdk-lib';
import type { Node } from 'constructs';
import type { GithubDeployTarget } from './constructs/github-deploy-role';
import type { CustomDomainProps } from './constructs/static-site';

/** CloudFront only accepts ACM certificates from this region. */
export const CLOUDFRONT_CERTIFICATE_REGION = 'us-east-1';

/** Defaults for this repository. Override any of them with `-c key=value`. */
export const DEFAULTS = {
  region: CLOUDFRONT_CERTIFICATE_REGION,
  githubRepository: 'jamesablue/glassy',
  githubEnvironment: 'production',
  githubBranch: 'main',
  createOidcProvider: true,
  removalPolicy: 'retain',
  forecastCorsOrigin: 'https://jamesablue.github.io',
} as const;

/** Everything the app reads from CDK context, validated and with defaults applied. */
export interface GlassyConfig {
  /** Region of the stack. CloudFront is global; this is where the bucket lives. */
  readonly region: string;
  readonly github: GithubDeployTarget;
  readonly createOidcProvider: boolean;
  readonly oidcProviderArn: string | undefined;
  readonly customDomain: CustomDomainProps | undefined;
  readonly removalPolicy: RemovalPolicy;
  /** The other origin that may read `/forecast.json`: the GitHub Pages demo. */
  readonly forecastCorsOrigin: string;
  /** Who is emailed when an ingest run fails. */
  readonly alarmEmail: string | undefined;
}

/**
 * Reads the app settings from CDK context (`cdk.json` or `cdk synth -c key=value`).
 *
 * | key                  | default             | meaning                                             |
 * | -------------------- | ------------------- | --------------------------------------------------- |
 * | `region`             | `us-east-1`         | region of the stack                                 |
 * | `githubRepository`   | `jamesablue/glassy` | repository allowed to deploy                        |
 * | `githubEnvironment`  | `production`        | GitHub environment the deploy job runs in           |
 * | `githubBranch`       | `main`              | trusted branch, only when `githubEnvironment` is "" |
 * | `createOidcProvider` | `true`              | false imports the account's existing provider       |
 * | `oidcProviderArn`    | conventional ARN    | existing provider, when not creating one            |
 * | `domainName`         | none                | custom domain, needs `hostedZoneId` too             |
 * | `hostedZoneId`       | none                | Route 53 zone for `domainName`                      |
 * | `hostedZoneName`     | `domainName`        | name of that zone, if it is a parent domain         |
 * | `removalPolicy`      | `retain`            | `destroy` lets `cdk destroy` delete the bucket      |
 * | `forecastCorsOrigin` | Pages demo origin   | other origin allowed to read `/forecast.json`       |
 * | `alarmEmail`         | none                | emailed when an ingest run fails                    |
 */
export function readConfig(node: Node): GlassyConfig {
  const region = stringContext(node, 'region') || DEFAULTS.region;
  const repository = stringContext(node, 'githubRepository') || DEFAULTS.githubRepository;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error(`Context "githubRepository" must look like owner/name, got "${repository}".`);
  }

  const customDomain = readCustomDomain(node);
  if (customDomain && region !== CLOUDFRONT_CERTIFICATE_REGION) {
    throw new Error(
      `A custom domain needs region=${CLOUDFRONT_CERTIFICATE_REGION}, because CloudFront only ` +
        `uses certificates from that region (got region=${region}). See infra/README.md.`,
    );
  }

  return {
    region,
    github: {
      repository,
      // An explicit empty string switches to branch-based trust.
      environment: stringContext(node, 'githubEnvironment') ?? DEFAULTS.githubEnvironment,
      branch: stringContext(node, 'githubBranch') || DEFAULTS.githubBranch,
    },
    createOidcProvider: booleanContext(node, 'createOidcProvider', DEFAULTS.createOidcProvider),
    oidcProviderArn: stringContext(node, 'oidcProviderArn') || undefined,
    customDomain,
    removalPolicy: readRemovalPolicy(node),
    forecastCorsOrigin: readForecastCorsOrigin(node),
    alarmEmail: readAlarmEmail(node),
  };
}

function readForecastCorsOrigin(node: Node): string {
  const value = stringContext(node, 'forecastCorsOrigin') || DEFAULTS.forecastCorsOrigin;
  // An origin is a scheme and a host, with no path and no trailing slash: browsers compare it
  // character for character with their Origin header.
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(value)) {
    throw new Error(
      `Context "forecastCorsOrigin" must be an https origin such as https://example.com, ` +
        `got "${value}".`,
    );
  }
  return value;
}

function readAlarmEmail(node: Node): string | undefined {
  const value = stringContext(node, 'alarmEmail') || undefined;
  if (value !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new Error(`Context "alarmEmail" must be an email address, got "${value}".`);
  }
  return value;
}

function readCustomDomain(node: Node): CustomDomainProps | undefined {
  const domainName = stringContext(node, 'domainName');
  const hostedZoneId = stringContext(node, 'hostedZoneId');
  if (!domainName && !hostedZoneId) {
    return undefined;
  }
  if (!domainName || !hostedZoneId) {
    throw new Error('Set both "domainName" and "hostedZoneId" to use a custom domain, or neither.');
  }
  return {
    domainName,
    hostedZoneId,
    hostedZoneName: stringContext(node, 'hostedZoneName') || domainName,
  };
}

function readRemovalPolicy(node: Node): RemovalPolicy {
  const value = stringContext(node, 'removalPolicy') || DEFAULTS.removalPolicy;
  switch (value) {
    case 'retain':
      return RemovalPolicy.RETAIN;
    case 'destroy':
      return RemovalPolicy.DESTROY;
    default:
      throw new Error(`Context "removalPolicy" must be "retain" or "destroy", got "${value}".`);
  }
}

/** A trimmed string, or undefined when the key is not set. */
function stringContext(node: Node, key: string): string | undefined {
  const value: unknown = node.tryGetContext(key);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Context "${key}" must be a string, got ${JSON.stringify(value)}.`);
  }
  return value.trim();
}

/** Accepts JSON booleans from cdk.json and the strings "true"/"false" from `-c`. */
function booleanContext(node: Node, key: string, fallback: boolean): boolean {
  const value: unknown = node.tryGetContext(key);
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new Error(`Context "${key}" must be true or false, got ${JSON.stringify(value)}.`);
}
