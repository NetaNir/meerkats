import * as cdk from '@aws-cdk/core';
import * as ddb from '@aws-cdk/aws-dynamodb';
import { IGrantable } from '@aws-cdk/aws-iam';

export interface DDBStackProps extends cdk.StackProps {
  readonly grantRead?: IGrantable[];
}

export class DDBStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: DDBStackProps = {}) {
    super(scope, id, props);
    
    const table = new ddb.Table(this, 'MeerkatTable', {  
      partitionKey: {
        name: 'name',
        type: ddb.AttributeType.STRING 
      }, 
      tableName: 'MeerkatTable',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    props.grantRead?.forEach(grantable => {
      table.grantFullAccess(grantable);
    });
  }
}
