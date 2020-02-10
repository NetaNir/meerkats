import * as cdk from '@aws-cdk/core';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as fs from 'fs';
import * as path from 'path'
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';

export interface APIGWStackProps extends cdk.StackProps {
  readonly vpc: ec2.Vpc;
}

export class APIGWStack extends cdk.Stack {
  public readonly role: iam.Role;
  public readonly handler: lambda.Function;
  constructor(scope: cdk.Construct, id: string, props: APIGWStackProps) {
    super(scope, id, props);
    this.handler = new lambda.Function(this, 'MeerkatLambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: new lambda.InlineCode(fs.readFileSync(path.resolve(__dirname, "./lambda", "meerkat-lambda.js"), { encoding: 'utf-8' })),
      environment: {
          TABLE_NAME: 'MeerkatTable'
      },
    });

    new apigw.LambdaRestApi(this, 'APIGW', {
      handler: this.handler
    })
  }
}
