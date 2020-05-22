import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import { AppDeliveryPipeline, CdkBuilds, ShellScriptValidation, Validation } from "./app-delivery";
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
      }),

      // How it will be built
      build: CdkBuilds.standardNpmBuild(),
    });

    // This is where we add copies of the application
    // ...
    const betaStage = pipeline.addApplicationStage('Beta', new WebServiceApp({
      outdir: 'cdk.out/beta',
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }
    }));

    betaStage.addValidations(Validation.shellScript({
      name: 'TestEndpoint',
      useOutputs: {
        // From the stack 'WebService', get the output 'Url' and make it available in
        // the shell script as '$ENDPOINT_URL'
        ENDPOINT_URL: {
          outputs: betaStage.stackOutputs('WebService'),
          outputName: 'Url',
        },
      },
      commands: [
        // Use 'curl' to GET the given URL and fail it it returns an error
        'curl -Ssf $ENDPOINT_URL',
      ],
    }));

    pipeline.addApplicationStage('Gamma', new WebServiceApp({
      outdir: 'cdk.out/gamma',
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' }
    }));
  }
}