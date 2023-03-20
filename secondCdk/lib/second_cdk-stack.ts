import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { CloudFrontWebDistribution, ViewerCertificate } from 'aws-cdk-lib/aws-cloudfront';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { aws_cloudfront as cloudfront, Stage } from 'aws-cdk-lib';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';

export class SecondCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    let context: CDKContext = {
      appName: "MyApp",
      region: "us-west-2",
      environment: "development",
      branchName: "main", // Github Branch
      gitConnectionArn: "", // CodeStar Connection ARN
      domain: "" // base domain used to build full url with subdomain
    };
    
    // Define s3 bucket.
    const websiteBucket = new s3.Bucket(this, `${context.appName}-bucket`, {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Configure domain and sub-domain urls.
    const domainName = context.domain;
    const subDomainName = `${context.appName}.` + domainName;
    console.log(`domainName: ${domainName}`);
    console.log(`subDomainName: ${subDomainName}`);

    // Look up hosted zone.
    const hostedZone = HostedZone.fromLookup(this, domainName, {
      domainName: domainName,
      privateZone: false,
    });

    // Define SSL Certificate (only use us-east-1). TODO: Replace with Certificate
    const frontendCertificate = new DnsValidatedCertificate(this, `${context.appName}Certificate`, {
      domainName: subDomainName,
      hostedZone: hostedZone,
      region: 'us-east-1',
    });

    const viewerCertificate = ViewerCertificate.fromAcmCertificate(frontendCertificate, { // .fromIamCertificate('MYIAMROLEIDENTIFIER', {
      aliases: [subDomainName],
    });

    // Define CloudFront Distribution with error responses.
    const accessDeniedErrorResponse: cloudfront.CfnDistribution.CustomErrorResponseProperty = {
      errorCode: 403,
      errorCachingMinTtl: 30,
      responseCode: 200,
      responsePagePath: '/index.html',
    };
    const notFoundErrorResponse: cloudfront.CfnDistribution.CustomErrorResponseProperty = {
      errorCode: 404,
      errorCachingMinTtl: 30,
      responseCode: 200,
      responsePagePath: '/index.html',
    };
    const distribution = new CloudFrontWebDistribution(this, `${context.appName}WebDistribution`, {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: websiteBucket,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
      viewerCertificate: viewerCertificate,
      errorConfigurations: [
        accessDeniedErrorResponse,
        notFoundErrorResponse
      ]
    });

    // Define A Record in Route53 for sub-domain.
    new ARecord(this, 'ARecord', {
      recordName: subDomainName,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    // Output the url of the website.
    new cdk.CfnOutput(this, 'URL', {
      description: 'The url of the website',
      value: websiteBucket.bucketWebsiteUrl + "\n" + subDomainName
    });

    // Deploy the site to the bucket and invalidate stale distributions.
    new s3deploy.BucketDeployment(this, `${context.appName}DeployWebsite`, {
      sources: [s3deploy.Source.asset('../dist/cdk-pipeline-poc')],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*']
    });

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MyPipeline',
      synth: new CodeBuildStep("SynthStep", {
        input: CodePipelineSource.connection(
          "h5aaimtron/cdk-pipeline-poc",
          context.branchName,
          {
            connectionArn: context.gitConnectionArn
          }
        ),
        installCommands: ["npm install -g aws-cdk"],
        commands: [
          // angular commands
          "npm ci", 
          "npm run build", // Hack way of building the angular app
          // cdk commands
          "cd cdk",
          "npm ci",
          "npm run build",
          "npx cdk synth"
        ],
        primaryOutputDirectory: "cdk/cdk.out"
      })
    });
  }
}

export type CDKContext = {
  appName: string;
  region: string;
  environment: string;
  branchName: string;
  gitConnectionArn: string;
  domain: string;
}