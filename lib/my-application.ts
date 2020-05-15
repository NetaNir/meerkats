import { CfnOutput, Construct, Environment } from '@aws-cdk/core';
import { AppStack } from './app-stack';
import { ConstructDomain as Application } from './proposed_api/construct-domain';
import { SharedStack } from './shared-stack';

export interface MyApplicationProps {
  env: Environment;
}

/**
 * Deployable unit of my application
 */
export class MyApplication extends Application {
  /**
   * Output that holds the URL of the load balancer
   */
  public readonly urlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: MyApplicationProps) {
    super(scope, id);

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
