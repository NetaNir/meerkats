import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';


export class VPCStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.vpc = new ec2.Vpc(this,  'MeerKatVPC');
    }
}