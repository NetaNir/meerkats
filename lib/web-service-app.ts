import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { WebServiceStack } from './web-service-stack';

/**
 * Deployable unit of web service app
 */
export class WebServiceApp extends Stage {
  public readonly urlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);

    const service = new WebServiceStack(this, 'WebService');
    this.urlOutput = service.urlOutput;
  }
}
