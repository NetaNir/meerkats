import { App, AppProps, Environment } from '@aws-cdk/core';
import { WebServiceStack } from './web-service-stack';

export interface WebServiceAppProps extends AppProps {
  /**
   * Where the stacks in this App should be deployed
   */
  env?: Environment;

  /**
   * A prefix for the stack names
   */
  prefix?: string;
}

/**
 * Deployable unit of web service app
 */
export class WebServiceApp extends App {
  constructor(props: WebServiceAppProps) {
    super(props);

    new WebServiceStack(this, 'WebService', {
      env: props.env,
      stackName: `${props.prefix ?? ''}WebService`,
    });
  }
}
