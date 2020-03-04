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
import { Environment, Stack, Construct, StackProps } from '@aws-cdk/core';


export class PipelineStack extends cdk.Stack {
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
    
    const euEnv: Environment = {
      account: '355421412380',
      region: 'eu-west-1'
    }
    const usEnv: Environment = {
      account: '355421412380',
      region: 'us-west-2'
    }
    const beta = createStage(scope, usEnv, 'beta', true);

    pipeline.addCdkStage(beta);
    const gamma = createStage(scope, euEnv, 'gamma', true);
    pipeline.addCdkStage(gamma)
    };
  }
  
  function createStage(scope: Construct, env: Environment, name: string, addValidation: boolean): CdkStage {
    const ddbStack = new DDBStack(scope, `Meerkats-DDBStack-${name}`, {
      env
    });
    const apiGwStack = new APIGWStack(scope, `Meerkats-APIGWStack-${name}`, {
      env,
      table: ddbStack.table
    });
    // Change this line to 'true' to see synthesis fail with a validation error
    const breakValidation = false;
    const twiddleStacks = breakValidation ? reversed : identity;
    // this is the artifact that will record the output containing the generated URL of the API Gateway
    // Need to explicitly name it because the stage name contains a '.' and that's not allowed to be in the artifact name.
    const apiGwStackOutputs = new codepipeline.Artifact(`Artifact_${name}_APIGWStack_Output`);
    const stage = new CdkStage({
      stageName: name,
      stacks: twiddleStacks([{
        stack: ddbStack
      }, {
        stack: apiGwStack,
        outputsArtifact: apiGwStackOutputs
      }])
    });
    if (addValidation) {
      stage.addValidations(
        new ShellCommandsValidation({
          name: `IntegTest-${name}`,
          input: apiGwStackOutputs,
          commands: [
          'set -e',
          // take out the URL of the API Gateway from the outputs.json file produced by the previous CFN deploy Action
          `api_gw_url=$(node -e 'console.log(require("./outputs.json")["${APIGWStack.URL_OUTPUT}"]);')`,
          'curl $api_gw_url',    
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
  