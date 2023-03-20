import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { CDKContext, FirstCdkStack } from './first_cdk-stack';

export class PipelineStage extends cdk.Stage {
    
    constructor(scope: Construct, id: string, context: CDKContext, props?: cdk.StageProps) {
      super(scope, id, props);
  
      const appStack = new FirstCdkStack(this, 'AppStack', context, props);      
    }
}