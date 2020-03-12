import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { APIGWStack } from './agigw-stack';
import { DDBStack } from "./ddb-stack";
import { CdkBuilds } from "./proposed_api/cdk-build";
import { CdkPipeline, CdkStack, CdkStage } from "./proposed_api/cdk-pipeline";
import { DeployCdkStackAction } from "./proposed_api/deploy-cdk-stack-action";
import { ShellCommandsValidation, IValidation } from './proposed_api/validation';
import { Environment, Stack, Construct, StackProps, CfnOutput } from '@aws-cdk/core';
import { MyApplication } from './my-application';


export class MyPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: StackProps) {
    super(scope, id, props);
    // allow customizing the SecretsManager GitHub token name
    // (needed for the GitHub source action)
    const gitHubTokenSecretName = process.env.GITHUB_TOKEN || 'my-github-token';
    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'OneMeerkatsPipeline',
      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'Source_GitHub',
        output: new codepipeline.Artifact(),
        oauthToken: cdk.SecretValue.secretsManager(gitHubTokenSecretName),
        owner: 'NetaNir',
        repo: 'meerkats',
        branch: process.env.BRANCH,
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),
      build: CdkBuilds.standardTypeScriptBuild({
        environmentVariables: {
          // Forward environment variables to build if configured, so
          // that synthesized pipeline will yield the same pipeline as has been
          // synth'd locally.
          ...copyEnvironmentVariables('GITHUB_TOKEN', 'BRANCH'),
        }
      })
    });

    const betaEnv: Environment = {
      account: '355421412380',
      region: 'us-west-2'
    };
    const gammaEnv: Environment = {
      account: '355421412380',
      region: 'eu-west-1'
    };
    const prodEnv: Environment = {
      account: '561462023695',
      region: 'us-east-2'
    };

    const beta = createStage(scope, betaEnv, 'beta_a1_UsWest2', true);
    pipeline.addCdkStage(beta);

    const gamma = createStage(scope, gammaEnv, 'gamma_a1_EuWest1', true);
    pipeline.addCdkStage(gamma)

    const prod = createStage(scope, prodEnv, 'prod_a2_UsEast2', true);
    pipeline.addCdkStage(prod)
  }
}

function createStage(scope: Construct, env: Environment, name: string, addValidation: boolean): CdkStage {
  const myAppStage = new MyApplication(scope, name, {
    env,
    prefix: name
  });

  // Change this line to 'true' to see synthesis fail with a validation error
  const breakValidation = false;
  const twiddleStacks = breakValidation ? reversed : identity;

  const { cdkStacks, artifacts } = makeCdkStages(name, myAppStage.deployableStacks, [myAppStage.urlOutput]);

  const stage = new CdkStage({
    stageName: name,
    stacks: twiddleStacks(cdkStacks),
  });
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

function copyEnvironmentVariables(...names: string[]): Record<string, codebuild.BuildEnvironmentVariable> {
  const ret: Record<string, codebuild.BuildEnvironmentVariable> = {};
  for (const name of names) {
    if (process.env[name]) {
      ret[name] = { value: process.env[name] };
    }
  }
  return ret;
}

function identity<A>(x: A): A {
  return x;
}

function reversed<A>(xs: A[]): A[] {
  xs.reverse();
  return xs;
}

function makeCdkStages(name: string, stacks: Stack[], interestingOutputs: CfnOutput[]) {
  const cdkStacks = new Array<CdkStack>();
  const artifacts = new Array<codepipeline.Artifact>();

  for (const stack of stacks) {
    const needThisStacksOutput = interestingOutputs.some(output => stacks.includes(Stack.of(output)));

    const artifact = needThisStacksOutput
      // this is the artifact that will record the output containing the generated URL of the API Gateway
      // Need to explicitly name it because the stage name contains a '.' and that's not allowed to be in the artifact name.
      ? new codepipeline.Artifact(`Artifact_${name}_${stack.stackName}_Output`)
      : undefined;

    if (artifact) {
      artifacts.push(artifact);
    }

    cdkStacks.push({ stack, outputsArtifact: artifact });
  }

  return { cdkStacks, artifacts };
}