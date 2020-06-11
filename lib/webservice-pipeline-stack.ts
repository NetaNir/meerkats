import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct, SecretValue, Stack, StackProps, Stage } from '@aws-cdk/core';
import { AppDeliveryPipeline, CdkBuilds, StackOutput, Validation } from "./app-delivery";
import { WebServiceApp } from './web-service-app';

/**
 * The stack that defines the application pipeline
 */
export class WebServicePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const pipeline = new AppDeliveryPipeline(this, 'Pipeline', {
      // The pipeline name
      pipelineName: 'WebServicePipeline',

      // Where the source can be found
      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: new codepipeline.Artifact(),
        oauthToken: SecretValue.secretsManager('github-token'),
        owner: 'NetaNir',
        repo: 'meerkats',
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),

      // How it will be built
      build: CdkBuilds.standardYarnBuild(),
    });

    // This is where we add copies of the application
    // ...
    const betaApp = new WebServiceApp(this, 'Beta', {
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }
    });

    pipeline.addApplicationStage(betaApp, {
      validations: [
        Validation.shellScript({
          name: 'TestEndpoint',
          useOutputs: {
            ENDPOINT_URL: pipeline.stackOutput(betaApp.urlOutput),
          },
          commands: [
            // Use 'curl' to GET the given URL and fail it it returns an error
            'curl -Ssf $ENDPOINT_URL',
          ],
        })]
    });

    pipeline.addApplicationStage(new WebServiceApp(this, 'Gamma', {
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' }
    }));
  }
}