# Glassy infrastructure (AWS CDK)

Hosting for the Glassy production build on AWS, written in AWS CDK v2 (TypeScript). It is a
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

Outputs: `BucketName`, `DistributionId`, `DistributionDomainName`, `DeployRoleArn`.

Every resource is checked against the cdk-nag AwsSolutions rules during synth. The few findings
that are deliberate for a demo (no access logs, no WAF, the default certificate's TLS policy, the
`bucket/*` object permission) are acknowledged next to the resource, with the reason.

## Commands

Run from `infra/` with Node 24 (`nvm use` in the repository root).

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm ci`               | install dependencies                                     |
| `npm test`             | template tests (Vitest + `aws-cdk-lib/assertions`)       |
| `npm run build`        | type check                                               |
| `npm run synth`        | type check, synthesise to `cdk.out/` and run cdk-nag     |
| `npm run diff`         | compare with the deployed stack (needs AWS credentials)  |
| `npm run format:check` | Prettier                                                 |
| `npx cdk <command>`    | any other CDK command, for example `deploy` or `destroy` |

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

## First deployment

Done once, by hand, with administrator credentials. After that, GitHub Actions deploys the site
with the role this stack creates.

### Prerequisites

- An AWS account and the AWS CLI v2, signed in with administrator access
  (`aws sso login --profile <profile>`, then `export AWS_PROFILE=<profile>`).
- Admin access to the GitHub repository, to add an environment and variables.

### 1. Bootstrap CDK (once per account and region)

```sh
cd infra
npm ci
npx cdk bootstrap aws://<account-id>/us-east-1
```

### 2. Deploy the stack

```sh
npx cdk deploy
```

CDK shows the IAM changes and asks for confirmation. If the account already has a GitHub OIDC
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

If this stack created the GitHub OIDC provider, `cdk destroy` deletes it too, which breaks any
other stack that relies on it. Finally, delete the four repository variables and the `production`
environment.
