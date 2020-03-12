import { Construct, Environment, Stack, CfnOutput } from '@aws-cdk/core';
import { DDBStack } from './ddb-stack';
import { APIGWStack } from './agigw-stack';

export interface MyApplicationProps {
  env: Environment;

  prefix: string;
}


export class MyApplication extends Construct {
  public readonly deployableStacks: Stack[];
  public readonly urlOutput: CfnOutput;
  
  constructor(scope: Construct, id: string, props: MyApplicationProps) {
    super(scope, id);

    const ddbStack = new DDBStack(scope, `${props.prefix}-DDBStack`.replace(/_/g, '-'), {
      env: props.env
    });
    const apiGwStack = new APIGWStack(scope, `${props.prefix}-APIGWStack`.replace(/_/g, '-'), {
      env: props.env,
      table: ddbStack.table,
      cluster: ddbStack.cluster,
    });

    this.urlOutput = apiGwStack.urlOutput;

    this.deployableStacks = [ddbStack, apiGwStack];

  }
}


