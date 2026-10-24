import { join } from 'node:path';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

/** The object the handler writes, at the root of the site bucket (`SNAPSHOT_KEY` in the handler). */
export const SNAPSHOT_KEY = 'forecast.json';

/**
 * When the ingest runs: every 3 hours, at 00:15, 03:15 … UTC (ADR-0010). Hourly would use 93% of
 * Open-Meteo's free daily limit; the upstream models only update every few hours anyway. The fixed
 * minute keeps run times predictable for the app's 7-hour staleness check.
 */
export const INGEST_SCHEDULE = Schedule.cron({ minute: '15', hour: '0/3' });

/** The repository root, which holds backend/ and the shared/ code it imports. */
const REPOSITORY_ROOT = join(__dirname, '..', '..', '..');

export interface ForecastIngestProps {
  /** The site bucket. The function may write `forecast.json` in it, and nothing else. */
  readonly bucket: IBucket;
  /**
   * Email address told when a run fails, and when runs succeed again. AWS sends a confirmation
   * email first, and nothing arrives until it is confirmed.
   * @default - no subscription; the alarm still changes state and notifies the topic
   */
  readonly alarmEmail?: string;
}

/**
 * The scheduled forecast ingest (#38): an EventBridge rule runs `backend/src/lambda.ts`, which
 * fetches Open-Meteo and writes `forecast.json` to the site bucket. A failed run writes nothing,
 * so the last good snapshot stays, and raises the alarm.
 */
export class ForecastIngest extends Construct {
  readonly function: NodejsFunction;
  readonly logGroup: LogGroup;
  readonly alarm: Alarm;
  readonly alarmTopic: Topic;

  constructor(scope: Construct, id: string, props: ForecastIngestProps) {
    super(scope, id);

    this.logGroup = new LogGroup(this, 'Logs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // A role of its own instead of the default one, which carries the AWSLambdaBasicExecutionRole
    // managed policy: that can write to any log group in the account.
    const role = new Role(this, 'Role', {
      description: 'Runs the Glassy forecast ingest and writes forecast.json',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    this.logGroup.grantWrite(role);
    // One key, one action: the function cannot read, list or delete anything, or write the site.
    role.addToPolicy(
      new PolicyStatement({
        sid: 'WriteForecastSnapshot',
        actions: ['s3:PutObject'],
        resources: [props.bucket.arnForObjects(SNAPSHOT_KEY)],
      }),
    );

    this.function = new NodejsFunction(this, 'Function', {
      description: 'Fetches the Open-Meteo forecast and publishes forecast.json',
      entry: join(REPOSITORY_ROOT, 'backend', 'src', 'lambda.ts'),
      handler: 'handler',
      // The bundle takes in shared/ as well as backend/, so both must be under the project root.
      projectRoot: REPOSITORY_ROOT,
      depsLockFilePath: join(REPOSITORY_ROOT, 'backend', 'package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      // Each request times out after 60 s and is retried once, so a run that is going to finish
      // does so well inside this.
      timeout: Duration.minutes(3),
      // One more try a minute or two after a failure. Each run is about 388 weighted Open-Meteo
      // calls; the default two retries could use 93% of the free daily limit on a bad day.
      retryAttempts: 1,
      role,
      logGroup: this.logGroup,
      environment: {
        SNAPSHOT_BUCKET: props.bucket.bucketName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.ESM,
        // Resolves the @glassy/shared path alias.
        tsconfig: join(REPOSITORY_ROOT, 'backend', 'tsconfig.json'),
        minify: true,
        sourceMap: true,
        // The Node 24 runtime provides AWS SDK v3, so it stays out of the bundle (the default).
        externalModules: ['@aws-sdk/*'],
      },
    });

    // A rule invokes the function through the function's resource policy, so unlike EventBridge
    // Scheduler it needs no role of its own.
    new Rule(this, 'Schedule', {
      description: 'Runs the Glassy forecast ingest every 3 hours',
      schedule: INGEST_SCHEDULE,
      targets: [new LambdaFunction(this.function)],
    });

    this.alarmTopic = new Topic(this, 'AlarmTopic', {
      displayName: 'Glassy forecast ingest',
      enforceSSL: true,
    });
    if (props.alarmEmail) {
      this.alarmTopic.addSubscription(new EmailSubscription(props.alarmEmail));
    }

    // Alarms within 5 minutes of a failed invocation, and stays in alarm for 3 hours, until about
    // the next run. A run whose retry succeeds still alarms once: the snapshot was late.
    this.alarm = new Alarm(this, 'FailedRunAlarm', {
      alarmDescription:
        'A forecast ingest run failed. forecast.json was not updated; the last good snapshot is ' +
        'still served. Check the function logs (infra/README.md).',
      metric: this.function.metricErrors({ period: Duration.minutes(5), statistic: Stats.SUM }),
      threshold: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 36,
      datapointsToAlarm: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    const notify = new SnsAction(this.alarmTopic);
    this.alarm.addAlarmAction(notify);
    this.alarm.addOkAction(notify);
  }
}
