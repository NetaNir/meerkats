import * as ddb from '@aws-cdk/aws-dynamodb';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';

export interface DDBStackProps extends cdk.StackProps {
}

export class SharedStack extends cdk.Stack {
  public readonly table: ddb.Table;
  public readonly cluster: ecs.ICluster;

  constructor(scope: cdk.Construct, id: string, props: DDBStackProps = {}) {
    super(scope, id, props);

    this.table = new ddb.Table(this, 'MeerkatTable', {
      partitionKey: {
        name: 'name',
        type: ddb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
    });

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
    });
  }
}
