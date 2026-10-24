import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Match, type Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp, synthTemplate } from './support';

/** Managed CachingOptimized policy. */
const CACHING_OPTIMIZED_ID = '658327ea-f89d-4fab-a63d-7e88639e58f6';

/** The one resource of `type` whose logical id starts with `prefix`, with its id. */
function resource(template: Template, type: string, prefix: string) {
  const matches = Object.entries(template.findResources(type)).filter(([id]) =>
    id.startsWith(prefix),
  );
  expect(matches.map(([id]) => id)).toHaveLength(1);
  const [id, value] = matches[0]!;
  return { id, properties: value['Properties'] };
}

describe('ForecastIngest', () => {
  let template: Template;

  beforeAll(() => {
    template = synthTemplate();
  });

  it('runs every 3 hours, at a quarter past', () => {
    const fn = resource(template, 'AWS::Lambda::Function', 'ForecastIngestFunction');
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(15 0/3 * * ? *)',
      State: 'ENABLED',
      Targets: [Match.objectLike({ Arn: { 'Fn::GetAtt': [fn.id, 'Arn'] } })],
    });
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      FunctionName: { 'Fn::GetAtt': [fn.id, 'Arn'] },
      Principal: 'events.amazonaws.com',
    });
  });

  it('runs the bundled handler on Node 24 with the bucket in its environment', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      MemorySize: 512,
      Timeout: 180,
      Environment: {
        Variables: {
          SNAPSHOT_BUCKET: { Ref: Match.stringLikeRegexp('^SiteBucket') },
          NODE_OPTIONS: '--enable-source-maps',
        },
      },
    });
  });

  it('retries a failed run once, not twice', () => {
    template.hasResourceProperties('AWS::Lambda::EventInvokeConfig', {
      MaximumRetryAttempts: 1,
    });
  });

  it('keeps a month of logs', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  describe('permissions', () => {
    it('can write forecast.json and its own logs, and nothing else', () => {
      const role = resource(template, 'AWS::IAM::Role', 'ForecastIngestRole');
      expect(role.properties.ManagedPolicyArns).toBeUndefined();

      const policies = Object.values(
        template.findResources('AWS::IAM::Policy', {
          Properties: { Roles: [{ Ref: role.id }] },
        }),
      );
      expect(policies).toHaveLength(1);
      const statements = policies[0]?.['Properties'].PolicyDocument.Statement;
      expect(statements).toEqual([
        {
          Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
          Effect: 'Allow',
          Resource: { 'Fn::GetAtt': [expect.stringMatching(/^ForecastIngestLogs/), 'Arn'] },
        },
        {
          Sid: 'WriteForecastSnapshot',
          Action: 's3:PutObject',
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [{ 'Fn::GetAtt': [expect.stringMatching(/^SiteBucket/), 'Arn'] }, '/forecast.json'],
            ],
          },
        },
      ]);
    });

    it('is the role the function runs as', () => {
      const role = resource(template, 'AWS::IAM::Role', 'ForecastIngestRole');
      template.hasResourceProperties('AWS::Lambda::Function', {
        Role: { 'Fn::GetAtt': [role.id, 'Arn'] },
      });
    });
  });

  describe('alarm', () => {
    it('goes off within 5 minutes of a failed run and stays on for 3 hours', () => {
      const topic = resource(template, 'AWS::SNS::Topic', 'ForecastIngestAlarmTopic');
      const fn = resource(template, 'AWS::Lambda::Function', 'ForecastIngestFunction');
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        Dimensions: [{ Name: 'FunctionName', Value: { Ref: fn.id } }],
        Statistic: 'Sum',
        Period: 300,
        EvaluationPeriods: 36,
        DatapointsToAlarm: 1,
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        TreatMissingData: 'notBreaching',
        AlarmActions: [{ Ref: topic.id }],
        OKActions: [{ Ref: topic.id }],
      });
    });

    it('notifies a topic that only accepts TLS', () => {
      template.hasResourceProperties('AWS::SNS::TopicPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Deny',
              Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            }),
          ]),
        },
      });
    });

    it('emails nobody unless alarmEmail is set', () => {
      template.resourceCountIs('AWS::SNS::Subscription', 0);

      synthTemplate({ alarmEmail: 'ops@example.com' }).hasResourceProperties(
        'AWS::SNS::Subscription',
        { Protocol: 'email', Endpoint: 'ops@example.com' },
      );
    });
  });

  it('bundles backend/src/lambda.ts into one ES module', () => {
    const assembly = buildApp().app.synth();
    const bundles = readdirSync(assembly.directory)
      .filter((name) => name.startsWith('asset.'))
      .filter((name) => existsSync(join(assembly.directory, name, 'index.mjs')));

    expect(bundles).toHaveLength(1);
  });
});

describe('/forecast.json on CloudFront', () => {
  let template: Template;

  beforeAll(() => {
    template = synthTemplate();
  });

  it('has a cache behavior of its own, cached like the rest of the site', () => {
    const headers = resource(template, 'AWS::CloudFront::ResponseHeadersPolicy', 'SiteForecast');
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/forecast.json',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: ['GET', 'HEAD'],
            CachePolicyId: CACHING_OPTIMIZED_ID,
            ResponseHeadersPolicyId: { Ref: headers.id },
          }),
        ],
      }),
    });
  });

  it('allows the GitHub Pages demo to read it', () => {
    const headers = resource(template, 'AWS::CloudFront::ResponseHeadersPolicy', 'SiteForecast');
    expect(headers.properties.ResponseHeadersPolicyConfig.CorsConfig).toEqual({
      AccessControlAllowOrigins: { Items: ['https://jamesablue.github.io'] },
      AccessControlAllowMethods: { Items: ['GET', 'HEAD'] },
      AccessControlAllowHeaders: { Items: ['*'] },
      AccessControlAllowCredentials: false,
      OriginOverride: true,
    });
  });

  it('keeps the same security headers as every other response', () => {
    const site = resource(template, 'AWS::CloudFront::ResponseHeadersPolicy', 'SiteSecurity');
    const forecast = resource(template, 'AWS::CloudFront::ResponseHeadersPolicy', 'SiteForecast');

    expect(site.properties.ResponseHeadersPolicyConfig.CorsConfig).toBeUndefined();
    expect(forecast.properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig).toEqual(
      site.properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig,
    );
    expect(forecast.properties.ResponseHeadersPolicyConfig.CustomHeadersConfig).toEqual(
      site.properties.ResponseHeadersPolicyConfig.CustomHeadersConfig,
    );
  });

  it('allows another origin from context', () => {
    const headers = resource(
      synthTemplate({ forecastCorsOrigin: 'https://glassy.example.com' }),
      'AWS::CloudFront::ResponseHeadersPolicy',
      'SiteForecast',
    );
    expect(headers.properties.ResponseHeadersPolicyConfig.CorsConfig).toMatchObject({
      AccessControlAllowOrigins: { Items: ['https://glassy.example.com'] },
    });
  });
});
