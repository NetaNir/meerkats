import { CfnOutput, Construct, Environment, Stack } from '@aws-cdk/core';
import { APIGWStack } from './agigw-stack';
import { DDBStack } from './ddb-stack';
import { ConstructDomain } from './proposed_api/construct-domain';

export interface MyApplicationProps {
  env: Environment;

  /**
   * Prefix for stack names
   */
  prefix: string;
}

/**
 * Deployable unit of my application
 */
export class MyApplication extends ConstructDomain {
  public readonly urlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: MyApplicationProps) {
    super(scope, id);

    const ddbStack = new DDBStack(this, 'DDBStack', {
      env: props.env,
      stackName: `${props.prefix}-DDBStack`.replace(/_/g, '-'),
    });
    const apiGwStack = new APIGWStack(this, 'APIGWStack', {
      env: props.env,
      table: ddbStack.table,
      cluster: ddbStack.cluster,
      stackName: `${props.prefix}-APIGWStack`.replace(/_/g, '-'),
    });

    this.urlOutput = apiGwStack.urlOutput;
  }
}
