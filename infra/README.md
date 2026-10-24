# Glassy infrastructure (AWS CDK)

Hosting for the Glassy production build on AWS, and the scheduled forecast ingest that publishes
`forecast.json` ([ADR-0010](../docs/adr/0010-backend-forecast-snapshot.md)), written in AWS CDK v2
(TypeScript). It is a
self-contained package: its own `package.json`, lockfile, `tsconfig.json`, tests and formatting.
Nothing here is deployed automatically. CI only runs the tests and `cdk synth`, which need no AWS
account.

## What the stack creates

`GlassyStaticSite`, in `us-east-1` by default:

- **S3 bucket**: private (all public access blocked, ACLs disabled), S3-managed encryption, TLS
  required, no website hosting. Kept when the stack is deleted, unless configured otherwise.
- **CloudFront distribution**: reads the bucket through Origin Access Control. HTTPS only (HTTP
  redirects), HTTP/2 and HTTP/3, `PriceClass_100`. 403 and 404 return `/index.html` with a 200 so
  deep links load the app, which reads its state from the query string.
- **Response headers policy**: HSTS (2 years, preload), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and a Content-Security-Policy
  that allows only the app's own origin plus Open-Meteo, NOAA and Esri. The host list lives in
  [`lib/content-security-policy.ts`](lib/content-security-policy.ts).
- **GitHub OIDC provider and deploy role**: only the `production` environment of
  `jamesablue/glassy` can assume the role. It can list the bucket, read/write/delete its objects,
  and invalidate (and read) this one distribution. Nothing else.
- **Optional custom domain**: an ACM certificate (DNS-validated) plus Route 53 `A`/`AAAA` alias
  records.
- **Forecast ingest** ([below](#forecast-ingest)): a Lambda function, bundled from
  [`backend/src/lambda.ts`](../backend/src/lambda.ts), that an EventBridge rule runs every 3 hours.
  It writes `forecast.json` to the site bucket, and may write nothing else. A CloudWatch alarm
  notifies an SNS topic when a run fails.
- **`/forecast.json` cache behavior**: the same caching and security headers as the rest of the
  site, plus `Access-Control-Allow-Origin` for the GitHub Pages demo, so it can read the snapshot
  across origins.

Outputs: `BucketName`, `DistributionId`, `DistributionDomainName`, `DeployRoleArn`,
`IngestFunctionName`, `IngestLogGroupName`, `IngestAlarmName`, `IngestAlarmTopicArn`.

Every resource is checked against the cdk-nag AwsSolutions rules during synth. The few findings
that are deliberate for a demo (no access logs, no WAF, the default certificate's TLS policy, the
`bucket/*` object permission) are acknowledged next to the resource, with the reason. The ingest
needs no acknowledgements: its role has no managed policy and no wildcard, the runtime is the
latest Node.js, and the alarm topic accepts only TLS.

## Commands

Run from `infra/` with Node 24 (`nvm use` in the repository root). Install `backend/` too
(`npm ci` there): every synth, test and deploy bundles the ingest with its esbuild, and stops with
a message if it is missing.

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm ci`               | install dependencies                                      |
| `npm test`             | template tests (Vitest + `aws-cdk-lib/assertions`)        |
| `npm run build`        | type check                                                |
| `npm run synth`        | type check, bundle the ingest, synthesise and run cdk-nag |
| `npm run diff`         | compare with the deployed stack (needs AWS credentials)   |
| `npm run format:check` | Prettier                                                  |
| `npx cdk <command>`    | any other CDK command, for example `deploy` or `destroy`  |

## Configuration

Settings come from CDK context: pass `-c key=value` on the command line, or add them to the
`context` block in `cdk.json`.

| Key                  | Default             | Meaning                                                         |
| -------------------- | ------------------- | --------------------------------------------------------------- |
| `region`             | `us-east-1`         | region of the stack                                             |
| `githubRepository`   | `jamesablue/glassy` | repository allowed to deploy                                    |
| `githubEnvironment`  | `production`        | GitHub environment the deploy job runs in                       |
| `githubBranch`       | `main`              | trusted branch instead, when `githubEnvironment` is set to `""` |
| `createOidcProvider` | `true`              | `false` reuses the account's existing GitHub OIDC provider      |
| `oidcProviderArn`    | standard ARN        | that existing provider, if its ARN is not the standard one      |
| `domainName`         | none                | custom domain, for example `glassy.example.com`                 |
| `hostedZoneId`       | none                | Route 53 hosted zone ID for `domainName`                        |
| `hostedZoneName`     | `domainName`        | name of that zone, when it is a parent domain (`example.com`)   |
| `removalPolicy`      | `retain`            | `destroy` lets `cdk destroy` delete the bucket                  |
| `forecastCorsOrigin` | Pages demo origin   | other origin allowed to read `/forecast.json` (`https://host`)  |
| `alarmEmail`         | none                | address emailed when an ingest run fails, and when it recovers  |

## First deployment

Done once, by hand, with administrator credentials. After that, GitHub Actions deploys the site
with the role this stack creates.

### Prerequisites

- An AWS account and the AWS CLI v2, signed in with administrator access
  (`aws sso login --profile <profile>`, then `export AWS_PROFILE=<profile>`).
- Admin access to the GitHub repository, to add an environment and variables.

### 1. Bootstrap CDK (once per account and region)

```sh
(cd backend && npm ci)
cd infra
npm ci
npx cdk bootstrap aws://<account-id>/us-east-1
```

### 2. Deploy the stack

```sh
npx cdk deploy -c alarmEmail=you@example.com
```

CDK bundles the ingest with esbuild (no Docker needed), shows the IAM changes and asks for
confirmation. `alarmEmail` is optional; put it in `cdk.json` to keep it for later deploys, or
AWS removes the subscription on the next deploy without it. AWS emails a confirmation link to
that address, and sends nothing until it is clicked. If the account already has a GitHub OIDC
provider (from another project), add `-c createOidcProvider=false`. An account can have only one
provider per issuer, and creating a second one fails.

When it finishes, CDK prints the outputs. You can read them again later with:

```sh
aws cloudformation describe-stacks --stack-name GlassyStaticSite \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
```

### 3. Create the `production` environment in GitHub

Settings → Environments → **New environment** → `production`. Under **Deployment branches and
tags**, choose **Selected branches and tags** and add `main`. Optionally add yourself as a required
reviewer, so every deploy waits for approval.

The role trusts tokens whose subject is `repo:jamesablue/glassy:environment:production`. GitHub
only issues those to jobs that run in this environment, so its rules decide who can deploy.

### 4. Add the repository variables

Settings → Secrets and variables → Actions → **Variables**. These are not secrets: no AWS keys are
stored anywhere, because the workflow signs in through OIDC.

| Variable                     | Value                            |
| ---------------------------- | -------------------------------- |
| `AWS_ROLE_ARN`               | `DeployRoleArn` output           |
| `AWS_REGION`                 | `us-east-1` (the stack's region) |
| `S3_BUCKET`                  | `BucketName` output              |
| `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` output          |

Or with the GitHub CLI:

```sh
gh variable set AWS_ROLE_ARN --body "arn:aws:iam::<account-id>:role/..."
gh variable set AWS_REGION --body "us-east-1"
gh variable set S3_BUCKET --body "<bucket-name>"
gh variable set CLOUDFRONT_DISTRIBUTION_ID --body "<distribution-id>"
```

### 5. Publish the first snapshot

The schedule runs at a quarter past every third hour (UTC). Run the ingest once by hand so
`forecast.json` exists straight away, then check it as in
[Checking the ingest](#checking-the-ingest).

```sh
aws lambda invoke --function-name <IngestFunctionName> /dev/stdout
```

Until the first run, a request for `/forecast.json` gets `index.html` with a 200, because of the
SPA fallback for missing files.

## Deploying the site

Actions → **Deploy to AWS** → **Run workflow**. Leave `ref` empty to deploy the selected branch, or
enter a tag or commit. From the command line:

```sh
gh workflow run deploy-aws.yml --ref main
```

The workflow ([`.github/workflows/deploy-aws.yml`](../.github/workflows/deploy-aws.yml)) stops
straight away if a variable is missing. Otherwise it builds the `production` configuration, signs
in to AWS through OIDC, uploads the hashed bundles (cached for a year), the files from `public/`
(cached for an hour) and finally `index.html` (`no-cache`), then invalidates `/` and `/index.html`.
The site URL appears in the job summary.

The upload passes exclude `forecast.json`, so a site deploy never removes the snapshot.

## Forecast ingest

The browser never calls Open-Meteo ([ADR-0010](../docs/adr/0010-backend-forecast-snapshot.md)).
Instead:

1. An EventBridge rule, `cron(15 0/3 * * ? *)`, runs the function at 00:15, 03:15 … UTC (14:15,
   17:15 … in Honolulu). Every run makes the same 4 requests (about 388 weighted Open-Meteo calls),
   however many people use the site.
2. The function ([`backend/src/lambda.ts`](../backend/src/lambda.ts), Node 24 on arm64, 512 MB,
   3-minute timeout) fetches the forecast, validates the snapshot exactly as the app will, and
   writes `s3://<bucket>/forecast.json` with
   `Cache-Control: public, max-age=300, stale-while-revalidate=3600`.
3. CloudFront serves it at `https://<domain>/forecast.json`, compressed (about 100 kB).

**Failures.** A run is all or nothing: if a request fails after its retry, or the snapshot does not
validate, nothing is written and the last good `forecast.json` stays. The invocation fails, Lambda
retries it once a minute or two later, and the `FailedRunAlarm` goes into `ALARM` within 5 minutes
and stays there for 3 hours, about until the next run. It notifies the SNS topic on `ALARM` and
again on `OK`. A run whose retry succeeds still raises it once.

**Permissions.** The function's role allows `s3:PutObject` on `<bucket>/forecast.json` and writing
to its own log group. Nothing else: it cannot read, list or delete objects, or write the site.

### Checking the ingest

```sh
# Run it now; prints the bucket, key, size, hours and fetchedAt
aws lambda invoke --function-name <IngestFunctionName> /dev/stdout

# The published file: fetchedAt should be under 3 hours old
curl -s https://<domain>/forecast.json | jq '{formatVersion, fetchedAt}'

# Headers, including CORS for the Pages demo
curl -sI -H 'Origin: https://jamesablue.github.io' https://<domain>/forecast.json
#   content-type: application/json
#   cache-control: public, max-age=300, stale-while-revalidate=3600
#   access-control-allow-origin: https://jamesablue.github.io

# Alarm state: OK, or INSUFFICIENT_DATA before the first run
aws cloudwatch describe-alarms --alarm-names <IngestAlarmName>   --query 'MetricAlarms[0].[StateValue,StateReason]' --output text

# Logs of recent runs (one "Wrote s3://…" line per successful run), kept for a month
aws logs tail <IngestLogGroupName> --since 6h
```

To be told by email without redeploying, subscribe to the topic:
`aws sns subscribe --topic-arn <IngestAlarmTopicArn> --protocol email --notification-endpoint you@example.com`.

The monthly cost estimate is in [`docs/deployment.md`](../docs/deployment.md#running-cost).

## Custom domain

Needs a Route 53 public hosted zone in the same AWS account. CloudFront only accepts certificates
from `us-east-1`, so the stack must be in that region (the default) when a domain is set. The app
refuses to synthesise otherwise.

```sh
npx cdk deploy \
  -c domainName=glassy.example.com \
  -c hostedZoneId=Z0123456789EXAMPLE \
  -c hostedZoneName=example.com
```

Put the same keys in `cdk.json` to keep them for later deploys. The deploy waits until ACM has
validated the certificate through DNS, which usually takes a few minutes. The distribution then
answers on the domain with TLS 1.2 or newer.

To keep the bucket in another region, the certificate would move into a small second stack pinned
to `us-east-1` and reach this one through `crossRegionReferences: true`. CloudFront serves from
its edges either way, so this app keeps a single stack in `us-east-1` instead.

## Teardown

```sh
npx cdk destroy
```

The bucket is kept by default, so nothing is lost by accident. To remove it as well, either delete
it afterwards (`aws s3 rb s3://<bucket-name> --force`), or deploy once with
`-c removalPolicy=destroy`, empty it (`aws s3 rm s3://<bucket-name> --recursive`) and then run
`cdk destroy`.

The ingest's log group is deleted with the stack; `forecast.json` stays in the kept bucket.

If this stack created the GitHub OIDC provider, `cdk destroy` deletes it too, which breaks any
other stack that relies on it. Finally, delete the four repository variables and the `production`
environment.
