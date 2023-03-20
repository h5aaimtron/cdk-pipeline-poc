import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodeBuildStep, CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { PipelineStage } from './pipeline-stage';
import { CDKContext } from './first_cdk-stack';

export class PipelineStack extends cdk.Stack {
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
          "cd firstCdk",
          "npm ci",
          "npm run build",
          "npx cdk synth"
        ],
        primaryOutputDirectory: "cdk/cdk.out"
      })
    });

    // Add our SPA Infrastructure
    pipeline.addStage(new PipelineStage(this, 'appStage', context, props));
  }
}