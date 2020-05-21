import { App, CfnOutput, Environment } from '@aws-cdk/core';
import { AppStack } from './app-stack';
import { SharedStack } from './shared-stack';

export interface MyApplicationProps {
  env: Environment;
}

/**
 * Deployable unit of my application
 */
export class MyApplication extends App {
  /**
   * Output that holds the URL of the load balancer
   */
  public readonly urlOutput: CfnOutput;

  constructor(props: MyApplicationProps) {
    super();

    const sharedStack = new SharedStack(this, 'SharedStack', {
      env: props.env,
      stackName: 'Shared',
    });

    const appStack = new AppStack(this, 'AppStack', {
      env: props.env,
      table: sharedStack.table,
      cluster: sharedStack.cluster,
      stackName: 'Application',
    });

    this.urlOutput = appStack.urlOutput;
  }
}
