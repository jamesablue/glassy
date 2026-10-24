import { Match, type Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '../lib/content-security-policy';
import { CUSTOM_DOMAIN_CONTEXT, synthTemplate } from './support';

/** Managed CachingOptimized policy. */
const CACHING_OPTIMIZED_ID = '658327ea-f89d-4fab-a63d-7e88639e58f6';

interface PolicyStatement {
  Action: string | string[];
  Effect: string;
  Resource?: unknown;
  Principal?: { Federated: unknown };
  Condition?: { StringEquals: Record<string, string> };
}

/** Logical id of the GitHub deploy role. The stack has other roles, such as the ingest's. */
function deployRoleId(template: Template): string | undefined {
  return Object.keys(template.findResources('AWS::IAM::Role')).find((id) =>
    id.startsWith('GithubDeployRole'),
  );
}

/** The deploy role's trust policy statement. */
function trustStatement(template: Template): PolicyStatement | undefined {
  const role = template.findResources('AWS::IAM::Role')[deployRoleId(template) ?? ''];
  return role?.['Properties'].AssumeRolePolicyDocument.Statement[0];
}

/** The statements of the deploy role's permissions policy. */
function permissionStatements(template: Template): PolicyStatement[] {
  const [policy] = Object.values(
    template.findResources('AWS::IAM::Policy', {
      Properties: { Roles: [{ Ref: deployRoleId(template) }] },
    }),
  );
  return policy?.['Properties'].PolicyDocument.Statement ?? [];
}

describe('GlassyStaticSiteStack (default domain)', () => {
  let template: Template;

  beforeAll(() => {
    template = synthTemplate();
  });

  describe('bucket', () => {
    it('blocks all public access and disables ACLs', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
      });
    });

    it('is encrypted with S3-managed keys and has no website hosting', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ],
        },
        WebsiteConfiguration: Match.absent(),
      });
    });

    it('is retained when the stack is deleted', () => {
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    it('denies requests that do not use TLS', () => {
      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Deny',
              Action: 's3:*',
              Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            }),
          ]),
        },
      });
    });

    it('lets only the CloudFront distribution read objects', () => {
      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: 's3:GetObject',
              Principal: { Service: 'cloudfront.amazonaws.com' },
              Condition: { StringEquals: { 'AWS:SourceArn': Match.anyValue() } },
            }),
          ]),
        },
      });
    });
  });

  describe('distribution', () => {
    it('reaches the bucket through Origin Access Control', () => {
      template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
        OriginAccessControlConfig: {
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4',
        },
      });
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Origins: [
            Match.objectLike({
              OriginAccessControlId: { 'Fn::GetAtt': [Match.anyValue(), 'Id'] },
              S3OriginConfig: { OriginAccessIdentity: '' },
            }),
          ],
        },
      });
    });

    it('serves index.html over HTTPS with HTTP/2 and HTTP/3', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultRootObject: 'index.html',
          HttpVersion: 'http2and3',
          PriceClass: 'PriceClass_100',
          DefaultCacheBehavior: Match.objectLike({
            ViewerProtocolPolicy: 'redirect-to-https',
            CachePolicyId: CACHING_OPTIMIZED_ID,
            ResponseHeadersPolicyId: { Ref: Match.anyValue() },
          }),
        }),
      });
    });

    it('sends 403 and 404 to index.html with a 200 for client-side routing', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CustomErrorResponses: [403, 404].map((ErrorCode) => ({
            ErrorCode,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
            ErrorCachingMinTTL: 0,
          })),
        }),
      });
    });

    it('uses the cloudfront.net domain when no custom domain is set', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Aliases: Match.absent(),
          ViewerCertificate: Match.absent(),
        }),
      });
      template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
      template.resourceCountIs('AWS::Route53::RecordSet', 0);
    });
  });

  describe('security headers', () => {
    it('sends the Content-Security-Policy', () => {
      const csp = buildContentSecurityPolicy();
      expect(csp).toContain("script-src 'self';");
      expect(csp).toContain('connect-src ');

      template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
        ResponseHeadersPolicyConfig: Match.objectLike({
          SecurityHeadersConfig: Match.objectLike({
            ContentSecurityPolicy: { ContentSecurityPolicy: csp, Override: true },
          }),
        }),
      });
    });

    it('sends HSTS, nosniff, frame, referrer and permissions headers', () => {
      template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
        ResponseHeadersPolicyConfig: Match.objectLike({
          SecurityHeadersConfig: Match.objectLike({
            StrictTransportSecurity: {
              AccessControlMaxAgeSec: 63_072_000,
              IncludeSubdomains: true,
              Preload: true,
              Override: true,
            },
            ContentTypeOptions: { Override: true },
            FrameOptions: { FrameOption: 'DENY', Override: true },
            ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
          }),
          CustomHeadersConfig: {
            Items: [
              {
                Header: 'Permissions-Policy',
                Value: 'camera=(), microphone=(), geolocation=()',
                Override: true,
              },
            ],
          },
        }),
      });
    });
  });

  describe('GitHub deploy role', () => {
    it('creates the GitHub OIDC provider', () => {
      template.hasResourceProperties('AWS::IAM::OIDCProvider', {
        Url: 'https://token.actions.githubusercontent.com',
        ClientIdList: ['sts.amazonaws.com'],
      });
    });

    it('can only be assumed from the repository production environment', () => {
      expect(trustStatement(template)).toEqual({
        Action: 'sts:AssumeRoleWithWebIdentity',
        Effect: 'Allow',
        Principal: { Federated: { Ref: expect.stringMatching(/OidcProvider/) } },
        Condition: {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub':
              'repo:jamesablue/glassy:environment:production',
          },
        },
      });
    });

    it('has only the permissions the deploy workflow needs', () => {
      const statements = permissionStatements(template);

      expect(statements.map((s) => [s.Action].flat().sort())).toEqual([
        ['s3:ListBucket'],
        ['s3:DeleteObject', 's3:GetObject', 's3:PutObject'],
        ['cloudfront:CreateInvalidation', 'cloudfront:GetDistribution'],
      ]);
      expect(JSON.stringify(statements)).not.toMatch(/"Resource":"\*"/);
      expect(statements[1]?.Resource).toEqual({
        'Fn::Join': ['', [{ 'Fn::GetAtt': [expect.stringMatching(/^SiteBucket/), 'Arn'] }, '/*']],
      });
    });
  });

  it('outputs the values the deploy workflow and the runbook need', () => {
    for (const name of [
      'BucketName',
      'DistributionId',
      'DistributionDomainName',
      'DeployRoleArn',
      'IngestFunctionName',
      'IngestLogGroupName',
      'IngestAlarmName',
      'IngestAlarmTopicArn',
    ]) {
      template.hasOutput(name, { Value: Match.anyValue() });
    }
  });

  it('tags resources with project, owner and environment', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        { Key: 'Environment', Value: 'production' },
        { Key: 'Owner', Value: 'jamesablue' },
        { Key: 'Project', Value: 'glassy' },
      ]),
    });
  });
});

describe('GlassyStaticSiteStack (custom domain)', () => {
  let template: Template;

  beforeAll(() => {
    template = synthTemplate(CUSTOM_DOMAIN_CONTEXT);
  });

  it('requests a DNS-validated certificate in the hosted zone', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'glassy.example.com',
      ValidationMethod: 'DNS',
      DomainValidationOptions: [
        { DomainName: 'glassy.example.com', HostedZoneId: 'Z0123456789EXAMPLE' },
      ],
    });
  });

  it('serves the domain with the certificate and a modern TLS policy', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['glassy.example.com'],
        ViewerCertificate: {
          AcmCertificateArn: { Ref: Match.stringLikeRegexp('Certificate') },
          MinimumProtocolVersion: 'TLSv1.2_2021',
          SslSupportMethod: 'sni-only',
        },
      }),
    });
  });

  it.each(['A', 'AAAA'])('adds a Route 53 %s alias record to the distribution', (type) => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'glassy.example.com.',
      Type: type,
      HostedZoneId: 'Z0123456789EXAMPLE',
      AliasTarget: {
        DNSName: { 'Fn::GetAtt': [Match.stringLikeRegexp('Distribution'), 'DomainName'] },
        HostedZoneId: Match.anyValue(),
      },
    });
  });
});

describe('GlassyStaticSiteStack (context options)', () => {
  it('imports an existing OIDC provider instead of creating one', () => {
    const template = synthTemplate({ createOidcProvider: 'false' });

    template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
    expect(JSON.stringify(trustStatement(template)?.Principal)).toContain(
      ':oidc-provider/token.actions.githubusercontent.com',
    );
  });

  it('uses an explicit provider ARN when one is given', () => {
    const arn = 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com';
    const template = synthTemplate({ createOidcProvider: false, oidcProviderArn: arn });

    expect(trustStatement(template)?.Principal).toEqual({ Federated: arn });
  });

  it('trusts another repository and environment', () => {
    const template = synthTemplate({ githubRepository: 'acme/site', githubEnvironment: 'staging' });

    expect(trustStatement(template)?.Condition?.StringEquals).toMatchObject({
      'token.actions.githubusercontent.com:sub': 'repo:acme/site:environment:staging',
    });
  });

  it('trusts a branch when the environment is turned off', () => {
    const template = synthTemplate({ githubEnvironment: '', githubBranch: 'release' });

    expect(trustStatement(template)?.Condition?.StringEquals).toMatchObject({
      'token.actions.githubusercontent.com:sub': 'repo:jamesablue/glassy:ref:refs/heads/release',
    });
  });

  it('lets the bucket be deleted with removalPolicy=destroy', () => {
    const template = synthTemplate({ removalPolicy: 'destroy' });

    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Delete' });
  });

  it.each([
    [{ domainName: 'glassy.example.com' }, /both "domainName" and "hostedZoneId"/],
    [{ ...CUSTOM_DOMAIN_CONTEXT, region: 'us-west-2' }, /custom domain needs region=us-east-1/],
    [{ removalPolicy: 'keep' }, /"removalPolicy" must be "retain" or "destroy"/],
    [{ createOidcProvider: 'no' }, /"createOidcProvider" must be true or false/],
    [{ githubRepository: 'glassy' }, /must look like owner\/name/],
    [
      { forecastCorsOrigin: 'https://example.com/' },
      /"forecastCorsOrigin" must be an https origin/,
    ],
    [{ forecastCorsOrigin: 'http://example.com' }, /"forecastCorsOrigin" must be an https origin/],
    [{ alarmEmail: 'nobody' }, /"alarmEmail" must be an email address/],
  ])('rejects invalid context %j', (context, message) => {
    expect(() => synthTemplate(context)).toThrow(message);
  });
});
