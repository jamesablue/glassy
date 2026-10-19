import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GithubDeployRole, type GithubDeployTarget } from './constructs/github-deploy-role';
import { type CustomDomainProps, StaticSite } from './constructs/static-site';

export interface GlassyStaticSiteStackProps extends StackProps {
  /** The GitHub workflow allowed to deploy. */
  readonly github: GithubDeployTarget;
  /** @default true */
  readonly createOidcProvider?: boolean;
  /** Existing GitHub OIDC provider, used when `createOidcProvider` is false. */
  readonly oidcProviderArn?: string;
  /** @default - served on the distribution's `*.cloudfront.net` domain */
  readonly customDomain?: CustomDomainProps;
  /** @default RemovalPolicy.RETAIN */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * Hosting for the Glassy Angular build: a private S3 bucket behind CloudFront,
 * plus the role the manual `deploy-aws.yml` workflow assumes to publish it.
 *
 * The outputs are the values the workflow needs as repository variables.
 */
export class GlassyStaticSiteStack extends Stack {
  readonly site: StaticSite;
  readonly deployRole: GithubDeployRole;

  constructor(scope: Construct, id: string, props: GlassyStaticSiteStackProps) {
    super(scope, id, props);

    this.site = new StaticSite(this, 'Site', {
      removalPolicy: props.removalPolicy,
      customDomain: props.customDomain,
    });

    this.deployRole = new GithubDeployRole(this, 'GithubDeploy', {
      target: props.github,
      bucket: this.site.bucket,
      distribution: this.site.distribution,
      createOidcProvider: props.createOidcProvider,
      oidcProviderArn: props.oidcProviderArn,
    });

    new CfnOutput(this, 'BucketName', {
      description: 'Repository variable S3_BUCKET',
      value: this.site.bucket.bucketName,
    });
    new CfnOutput(this, 'DistributionId', {
      description: 'Repository variable CLOUDFRONT_DISTRIBUTION_ID',
      value: this.site.distribution.distributionId,
    });
    new CfnOutput(this, 'DistributionDomainName', {
      description: 'CloudFront domain the site is served on (point a custom domain here)',
      value: this.site.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'DeployRoleArn', {
      description: 'Repository variable AWS_ROLE_ARN',
      value: this.deployRole.role.roleArn,
    });
  }
}
