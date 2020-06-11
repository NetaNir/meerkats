import { App, CfnOutput, Construct, Environment, Stage, StageProps } from '@aws-cdk/core';
import { AppStack } from './app-stack';
import { SharedStack } from './shared-stack';

/**
 * Deployable unit of my application
 */
export class MyApplication extends Stage {
  /**
   * Output that holds the URL of the load balancer
   */
  public readonly urlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: StageProps = {}) {
    super(scope, id, props);

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
