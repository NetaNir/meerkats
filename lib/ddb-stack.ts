import * as cdk from '@aws-cdk/core';
import * as ddb from '@aws-cdk/aws-dynamodb';
import { IGrantable } from '@aws-cdk/aws-iam';

export interface DDBStackProps extends cdk.StackProps {
}

export class DDBStack extends cdk.Stack {
  public readonly table: ddb.Table;

  constructor(scope: cdk.Construct, id: string, props: DDBStackProps = {}) {
    super(scope, id, props);

    this.table = new ddb.Table(this, 'MeerkatTable', {
      partitionKey: {
        name: 'name',
        type: ddb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
