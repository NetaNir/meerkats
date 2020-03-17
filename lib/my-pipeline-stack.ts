import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct, Environment, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import { APIGWStack } from './agigw-stack';
import { MyApplication } from './my-application';
import { CdkBuilds } from "./proposed_api/cdk-build";
import { CdkPipeline, CdkStage, stageFromStacks } from "./proposed_api/cdk-pipeline";
import { ShellCommandsValidation } from './proposed_api/validation';

export class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // allow customizing the SecretsManager GitHub token name
    // (needed for the GitHub source action)
    const gitHubTokenSecretName = process.env.GITHUB_TOKEN || 'my-github-token';

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'OneMeerkatsPipeline',

      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'Source_GitHub',
        output: new codepipeline.Artifact(),
        oauthToken: SecretValue.secretsManager(gitHubTokenSecretName),
        owner: 'NetaNir',
        repo: 'meerkats',
        branch: process.env.BRANCH,
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),

      build: CdkBuilds.standardTypeScriptBuild({
        // Forward environment variables to build if configured, so
        // that synthesized pipeline will yield the same pipeline as has been
        // synth'd locally.
        copyEnvironmentVariables: ['GITHUB_TOKEN', 'BRANCH'],
      })
    });

    pipeline.addCdkStage(createStage(scope, 'beta_a1_UsWest2', {
      account: '355421412380',
      region: 'us-west-2'
    }));

    pipeline.addCdkStage(createStage(scope, 'gamma_a1_EuWest1', {
      account: '355421412380',
      region: 'eu-west-1'
    }));

    pipeline.addCdkStage(createStage(scope, 'prod_a2_UsEast2', {
      account: '561462023695',
      region: 'us-east-2'
    }));
  }
}

function createStage(scope: Construct, name: string, env: Environment, addValidation = true): CdkStage {
  const myAppStage = new MyApplication(scope, name, {
    env,
    prefix: name
  });

  const { stage, artifacts } = stageFromStacks(name, myAppStage.deployableStacks, [myAppStage.urlOutput]);

  if (addValidation) {
    stage.addValidations(
      new ShellCommandsValidation({
        name: `IntegTest-${name}`,
        input: artifacts[0], // [0] sucks! How do we know which of the potentially 2 artifacts contains the 1 output we need?
        commands: [
        'set -e',
        // take out the URL of the API Gateway from the outputs.json file produced by the previous CFN deploy Action
        `api_gw_url=$(node -e 'console.log(require("./outputs.json")["${APIGWStack.URL_OUTPUT}"]);')`,
        // Root URL hits the Lambda
        'curl -Ssf $api_gw_url',
        // '/container' hits the container
        'curl -Ssf $api_gw_url/container',
        ]
      })
    );
  }
  return stage;
}