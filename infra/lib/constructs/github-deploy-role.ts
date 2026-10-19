import { CfnElement, Duration, Stack, Validations } from 'aws-cdk-lib';
import type { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import {
  type IOidcProvider,
  OidcProviderNative,
  OpenIdConnectPrincipal,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/** Issuer of the OIDC tokens that GitHub Actions jobs can request. */
export const GITHUB_OIDC_ISSUER = 'token.actions.githubusercontent.com';

/** Audience that aws-actions/configure-aws-credentials asks GitHub for. */
export const GITHUB_OIDC_AUDIENCE = 'sts.amazonaws.com';

/** Which workflow runs may assume the role. */
export interface GithubDeployTarget {
  /** Repository as `owner/name`. */
  readonly repository: string;
  /**
   * GitHub environment the deploy job declares (`environment: production`).
   * GitHub then puts `environment:<name>` in the token's subject, so the
   * environment's protection rules (required reviewers, allowed branches)
   * decide who can deploy.
   */
  readonly environment?: string;
  /**
   * Branch to trust when no environment is used. Ignored when `environment`
   * is set, because GitHub leaves the ref out of the subject in that case.
   * @default 'main'
   */
  readonly branch?: string;
}

export interface GithubDeployRoleProps {
  readonly target: GithubDeployTarget;
  /** Bucket the workflow syncs the build into. */
  readonly bucket: IBucket;
  /** Distribution the workflow invalidates after an upload. */
  readonly distribution: IDistribution;
  /**
   * Create the GitHub OIDC provider. An AWS account can hold only one
   * provider per issuer, so set this to false when it already exists.
   * @default true
   */
  readonly createOidcProvider?: boolean;
  /**
   * ARN of the existing provider, used when `createOidcProvider` is false.
   * @default - `arn:<partition>:iam::<account>:oidc-provider/token.actions.githubusercontent.com`
   */
  readonly oidcProviderArn?: string;
}

/** The `sub` claim GitHub puts in tokens for the given target. */
export function githubSubjectClaim(target: GithubDeployTarget): string {
  return target.environment
    ? `repo:${target.repository}:environment:${target.environment}`
    : `repo:${target.repository}:ref:refs/heads/${target.branch ?? 'main'}`;
}

/**
 * An IAM role that one GitHub Actions workflow can assume through OIDC, with
 * just enough access to publish the site. No long-lived AWS keys are stored
 * in GitHub: each run trades its short-lived OIDC token for a one-hour session.
 */
export class GithubDeployRole extends Construct {
  readonly role: Role;
  readonly provider: IOidcProvider;

  constructor(scope: Construct, id: string, props: GithubDeployRoleProps) {
    super(scope, id);

    // The native AWS::IAM::OIDCProvider resource, rather than the older
    // custom-resource provider, so no Lambda function is deployed. With no
    // thumbprints listed, IAM fetches and verifies GitHub's certificate itself.
    this.provider =
      (props.createOidcProvider ?? true)
        ? new OidcProviderNative(this, 'OidcProvider', {
            url: `https://${GITHUB_OIDC_ISSUER}`,
            clientIds: [GITHUB_OIDC_AUDIENCE],
          })
        : OidcProviderNative.fromOidcProviderArn(
            this,
            'OidcProvider',
            props.oidcProviderArn ?? defaultProviderArn(this),
          );

    const subject = githubSubjectClaim(props.target);
    this.role = new Role(this, 'Role', {
      description: `Deploys the Glassy site from GitHub Actions (${subject})`,
      maxSessionDuration: Duration.hours(1),
      // StringEquals, not StringLike: an exact subject, no wildcards.
      assumedBy: new OpenIdConnectPrincipal(this.provider, {
        StringEquals: {
          [`${GITHUB_OIDC_ISSUER}:aud`]: GITHUB_OIDC_AUDIENCE,
          [`${GITHUB_OIDC_ISSUER}:sub`]: subject,
        },
      }),
    });

    // Exactly what `aws s3 sync --delete`, `aws s3 cp` and the invalidation
    // step need. Spelled out instead of bucket.grantReadWrite(), which also
    // grants multipart, tagging and legal-hold actions.
    this.role.addToPolicy(
      new PolicyStatement({
        sid: 'ListSiteBucket',
        actions: ['s3:ListBucket'],
        resources: [props.bucket.bucketArn],
      }),
    );
    this.role.addToPolicy(
      new PolicyStatement({
        sid: 'WriteSiteObjects',
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [props.bucket.arnForObjects('*')],
      }),
    );
    this.role.addToPolicy(
      new PolicyStatement({
        sid: 'InvalidateAndDescribeDistribution',
        // GetDistribution is read-only. The workflow uses it to print the
        // site URL (including any custom domain) in the job summary.
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetDistribution'],
        resources: [props.distribution.distributionArn],
      }),
    );

    Validations.of(this.role).acknowledge({
      id: `AwsSolutions-IAM5[Resource::${nagArn(props.bucket)}/*]`,
      reason:
        'Object actions apply to keys in the site bucket only. Hashed file names change on ' +
        'every build, so the keys cannot be listed in advance.',
    });
  }
}

/** How cdk-nag writes a bucket ARN in a finding: `<LogicalId.Arn>` for one in this app. */
function nagArn(bucket: IBucket): string {
  const resource = bucket.node.defaultChild;
  return resource instanceof CfnElement
    ? `<${Stack.of(resource).getLogicalId(resource)}.Arn>`
    : bucket.bucketArn;
}

function defaultProviderArn(scope: Construct): string {
  return Stack.of(scope).formatArn({
    service: 'iam',
    region: '',
    resource: 'oidc-provider',
    resourceName: GITHUB_OIDC_ISSUER,
  });
}
