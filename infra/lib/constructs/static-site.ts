import { Duration, RemovalPolicy, Validations } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { buildContentSecurityPolicy } from '../content-security-policy';

export interface CustomDomainProps {
  /** Fully qualified name the site is served on, for example `glassy.example.com`. */
  readonly domainName: string;
  /** Route 53 hosted zone that `domainName` lives in. */
  readonly hostedZoneId: string;
  /** Name of that hosted zone, for example `example.com`. */
  readonly hostedZoneName: string;
}

export interface StaticSiteProps {
  /**
   * What happens to the bucket when the stack is deleted.
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * Serve the site on your own domain. The certificate must be created in
   * us-east-1, so the stack has to be deployed there when this is set.
   * @default - the distribution's `*.cloudfront.net` domain
   */
  readonly customDomain?: CustomDomainProps;
}

/** Status codes S3 returns for a path that is not a file in the bucket. */
const SPA_FALLBACK_STATUSES = [403, 404] as const;

/**
 * A single-page app served from a private S3 bucket through CloudFront.
 *
 * Caching: one behaviour with the managed CachingOptimized policy, which
 * honours the `Cache-Control` header stored on each object. The deploy
 * workflow sets it per file:
 * - Hashed bundles (`main-ABC123.js`): `public,max-age=31536000,immutable`.
 *   Edges and browsers keep them for a year; a new build has new names.
 * - Files from `public/` that keep their names: `public,max-age=3600`.
 * - `index.html`: `no-cache`. Browsers revalidate it on every load, and
 *   CloudFront keeps it for at most the policy's 1 second minimum TTL.
 *
 * A separate cache behaviour for `/index.html` would not be enough: requests
 * for `/` and the SPA fallback for unknown paths both serve index.html without
 * matching that path pattern. Object metadata covers every way it is reached.
 */
export class StaticSite extends Construct {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: StaticSiteProps = {}) {
    super(scope, id);

    this.bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // ACLs off: the bucket owner owns every object, and access is decided by
      // IAM and the bucket policy alone.
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });
    Validations.of(this.bucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason:
        'Server access logs are off to keep the demo to a single bucket. The objects are a ' +
        'public build, and only the deploy role can write them.',
    });

    const domain = props.customDomain && this.prepareCustomDomain(props.customDomain);

    this.distribution = new Distribution(this, 'Distribution', {
      comment: 'Glassy static site',
      defaultRootObject: 'index.html',
      httpVersion: HttpVersion.HTTP2_AND_3,
      // Cheapest tier: edges in North America, Europe and Israel. The audience
      // is in Hawaii, which the US edges cover.
      priceClass: PriceClass.PRICE_CLASS_100,
      domainNames: domain && [domain.name],
      certificate: domain?.certificate,
      minimumProtocolVersion: domain && SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        // Origin Access Control signs every origin request with SigV4, so the
        // bucket stays private and its policy trusts this one distribution
        // (AWS:SourceArn). OAC replaces the legacy Origin Access Identity,
        // which AWS no longer recommends and which cannot read SSE-KMS objects.
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: this.createSecurityHeadersPolicy(),
      },
      // SPA fallback. With OAC and no s3:ListBucket, S3 answers 403 (not 404)
      // for a missing key. Both are turned into index.html with a 200 so a deep
      // link loads the app and the client-side router takes over. TTL 0 so a
      // deploy shows up on deep links without waiting for the error cache.
      errorResponses: SPA_FALLBACK_STATUSES.map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });
    this.acknowledgeDistributionFindings(domain !== undefined);

    if (domain) {
      const target = RecordTarget.fromAlias(new CloudFrontTarget(this.distribution));
      const record = { zone: domain.zone, recordName: domain.name, target };
      new ARecord(this, 'AliasRecord', record);
      new AaaaRecord(this, 'AliasRecordIpv6', record);
    }
  }

  private createSecurityHeadersPolicy(): ResponseHeadersPolicy {
    return new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'Glassy security headers',
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: buildContentSecurityPolicy(),
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(730),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
            override: true,
          },
        ],
      },
    });
  }

  /** Looks up the hosted zone and requests a DNS-validated certificate for the domain. */
  private prepareCustomDomain(domain: CustomDomainProps) {
    const zone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: domain.hostedZoneId,
      zoneName: domain.hostedZoneName,
    });
    const certificate = new Certificate(this, 'Certificate', {
      domainName: domain.domainName,
      validation: CertificateValidation.fromDns(zone),
    });
    return { name: domain.domainName, zone, certificate };
  }

  private acknowledgeDistributionFindings(hasCustomCertificate: boolean): void {
    const findings = Validations.of(this.distribution);
    findings.acknowledge({
      id: 'AwsSolutions-CFR1',
      reason: 'The site is public and meant to be reachable from anywhere.',
    });
    findings.acknowledge({
      id: 'AwsSolutions-CFR2',
      reason:
        'A static site with no forms, logins or server code. WAF would cost more than the ' +
        'demo and has nothing to protect; AWS Shield Standard still applies.',
    });
    findings.acknowledge({
      id: 'AwsSolutions-CFR3',
      reason: 'Access logs are off to keep the demo to one bucket with no log storage to manage.',
    });
    if (!hasCustomCertificate) {
      findings.acknowledge({
        id: 'AwsSolutions-CFR4',
        reason:
          'The default *.cloudfront.net certificate does not allow choosing a TLS policy. ' +
          'With a custom domain the distribution enforces TLSv1.2_2021.',
      });
    }
  }
}
