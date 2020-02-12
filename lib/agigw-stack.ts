import * as cdk from '@aws-cdk/core';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as fs from 'fs';
import * as path from 'path'

export class APIGWStack extends cdk.Stack {
  public static readonly URL_OUTPUT = 'MeerkatApiGwUrlOutput';

  public readonly handler: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.handler = new lambda.Function(this, 'MeerkatLambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: new lambda.InlineCode(fs.readFileSync(path.resolve(__dirname, "./lambda", "meerkat-lambda.js"), { encoding: 'utf-8' })),
      environment: {
        TABLE_NAME: 'MeerkatTable'
      },
      description: 'Fake description to force a redeploy of the stack.',
    });

    const lambdaRestApi = new apigw.LambdaRestApi(this, 'APIGW', {
      handler: this.handler
    });
    // add an output with a well-known name to read it from the integ tests
    new cdk.CfnOutput(this, APIGWStack.URL_OUTPUT, {
      value: lambdaRestApi.url,
    });
  }
}
