import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { APIGWStack } from './agigw-stack';
import { DDBStack } from "./ddb-stack";
import { CdkBuilds } from "./proposed_api/cdk-build";
import { CdkPipeline } from "./proposed_api/cdk-pipeline";
import { DeployCdkStackAction } from "./proposed_api/deploy-cdk-stack-action";

export interface PipelineStackProps extends cdk.StackProps {
  readonly ddbStack: DDBStack;
  readonly apiGwStack: APIGWStack;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // allow customizing the SecretsManager GitHub token name
    // (needed for the GitHub source action)
    const gitHubTokenSecretName = process.env.GITHUB_TOKEN || 'my-github-token';

    // remove the pipeline's key & bucket, to not leave trash in the account
    const pipelineKey = new kms.Key(this, 'PipelineKey', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const pipelineBucket = new s3.Bucket(this, 'PipelineBucket', {
      encryptionKey: pipelineKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const sourceOutput = new codepipeline.Artifact();
    const cdkBuildOutput = new codepipeline.Artifact();
    // this is the artifact that will record the output containing the generated URL of the API Gateway
    const apiGwStackOutputs = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'MeerkatsPipeline',
      artifactBucket: pipelineBucket,
      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'Source_GitHub',
        output: sourceOutput,
        oauthToken: cdk.SecretValue.secretsManager(gitHubTokenSecretName),
        owner: 'NetaNir',
        repo: 'meerkats',
        branch: process.env.BRANCH,
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),
      build: CdkBuilds.standardTypeScriptBuild(cdkBuildOutput, {
        environmentVariables: {
          // Forward environment variables to build if configured, so
          // that synthesized pipeline will yield the same pipeline as has been
          // synth'd locally.
          ...copyEnvironmentVariables('GITHUB_TOKEN', 'BRANCH'),
        }
      })
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        // first, deploy the DynamoDB Stack
        new DeployCdkStackAction({
          baseActionName: 'Deploy_DynamoDB_Stack',
          input: cdkBuildOutput,
          stack: props.ddbStack,
          // either uncomment this line, or comment out the entire action addition to the `actions` array,
          // to see synthesis fail with a validation error
          // baseRunOrder: 7,
        }),
        // then, deploy the API Gateway Stack
        new DeployCdkStackAction({
          baseActionName: 'Deploy_API_GW_Stack',
          input: cdkBuildOutput,
          stack: props.apiGwStack,
          output: apiGwStackOutputs,
          outputFileName: 'outputs.json',
          baseRunOrder: 3,
        }),
        // then, run an integration test
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Integ_Test',
          input: apiGwStackOutputs,
          runOrder: 5,
          project: new codebuild.PipelineProject(this, 'IntegTestProject', {
            buildSpec: codebuild.BuildSpec.fromObject({
              version: '0.2',
              phases: {
                build: {
                  commands: [
                    'set -e',
                    // take out the URL of the API Gateway from the outputs.json file produced by the previous CFN deploy Action
                    `api_gw_url=$(node -e 'console.log(require("./outputs.json")["${APIGWStack.URL_OUTPUT}"]);')`,
                    'curl $api_gw_url',
                  ],
                },
              },
            }),
          }),
        }),
      ],
    });
  }
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
