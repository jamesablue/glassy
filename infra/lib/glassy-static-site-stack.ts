import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ForecastIngest } from './constructs/forecast-ingest';
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
  /** @default - no cross-origin reads of `/forecast.json` */
  readonly forecastCorsOrigin?: string;
  /** @default - nobody is emailed when an ingest run fails */
  readonly alarmEmail?: string;
}

/**
 * Hosting for the Glassy Angular build: a private S3 bucket behind CloudFront,
 * plus the role the manual `deploy-aws.yml` workflow assumes to publish it,
 * and the scheduled ingest that writes `forecast.json` into the same bucket.
 *
 * The stack keeps its original id, `GlassyStaticSite`: renaming a stack
 * creates a new one, with a new bucket and distribution.
 *
 * The outputs are the values the workflow needs as repository variables.
 */
export class GlassyStaticSiteStack extends Stack {
  readonly site: StaticSite;
  readonly deployRole: GithubDeployRole;
  readonly ingest: ForecastIngest;

  constructor(scope: Construct, id: string, props: GlassyStaticSiteStackProps) {
    super(scope, id, props);

    this.site = new StaticSite(this, 'Site', {
      removalPolicy: props.removalPolicy,
      customDomain: props.customDomain,
      forecastCorsOrigin: props.forecastCorsOrigin,
    });

    this.deployRole = new GithubDeployRole(this, 'GithubDeploy', {
      target: props.github,
      bucket: this.site.bucket,
      distribution: this.site.distribution,
      createOidcProvider: props.createOidcProvider,
      oidcProviderArn: props.oidcProviderArn,
    });

    this.ingest = new ForecastIngest(this, 'ForecastIngest', {
      bucket: this.site.bucket,
      alarmEmail: props.alarmEmail,
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
    new CfnOutput(this, 'IngestFunctionName', {
      description: 'Forecast ingest function (aws lambda invoke --function-name <this>)',
      value: this.ingest.function.functionName,
    });
    new CfnOutput(this, 'IngestLogGroupName', {
      description: 'Log group of the ingest (aws logs tail <this>)',
      value: this.ingest.logGroup.logGroupName,
    });
    new CfnOutput(this, 'IngestAlarmName', {
      description: 'Alarm raised when an ingest run fails',
      value: this.ingest.alarm.alarmName,
    });
    new CfnOutput(this, 'IngestAlarmTopicArn', {
      description: 'SNS topic the alarm notifies (subscribe more addresses here)',
      value: this.ingest.alarmTopic.topicArn,
    });
  }
}
