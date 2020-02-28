import * as ec2 from '@aws-cdk/aws-ec2'
import * as cdk from '@aws-cdk/core';


export class VPCStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new ec2.Vpc(this, 'MeerkatVPC');
  }
  
  public get availabilityZones(): string[] {
    return [cdk.Fn.select(0, cdk.Fn.getAzs()), cdk.Fn.select(1, cdk.Fn.getAzs())]; 
  }
}

