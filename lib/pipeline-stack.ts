import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import *  as cdk from '@aws-cdk/core';
import *  as kms from '@aws-cdk/aws-kms';
import *  as s3 from '@aws-cdk/aws-s3';
import { APIGWStack } from './agigw-stack';

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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

    new codepipeline.Pipeline(this, 'Pipeline', {
      restartExecutionOnUpdate: true,
      artifactBucket: pipelineBucket,
      pipelineName: 'MeerkatsPipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'Source_GitHub',
              output: sourceOutput,
              oauthToken: cdk.SecretValue.secretsManager(gitHubTokenSecretName),
              owner: 'NetaNir',
              repo: 'meerkats',
              trigger: codepipeline_actions.GitHubTrigger.POLL,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build_CodeBuild',
              project: new codebuild.PipelineProject(this, 'Build', {
                buildSpec: codebuild.BuildSpec.fromObject({
                  version: '0.2',
                  phases: {
                    install: {
                      commands: 'npm install',
                    },
                    build: {
                      commands: 'npm run cdk synth',
                    },
                  },
                  // save the generated files in the output artifact
                  artifacts: {
                    'base-directory': 'cdk.out',
                    files: '**/*',
                  },
                }),
              }),
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        },
        {
          stageName: 'Self_Mutation',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Self_Mutate',
              templatePath: cdkBuildOutput.atPath(`${this.stackName}.template.json`),
              stackName: this.stackName,
              adminPermissions: true,
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            // first, deploy the DynamoDB Stack
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy_DynamoDB_Stack',
              templatePath: cdkBuildOutput.atPath('DDBStack.template.json'),
              stackName: 'Meerkats-DDBStack',
              adminPermissions: true,
            }),
            // then, deploy the API Gateway Stack
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy_API_GW_Stack',
              templatePath: cdkBuildOutput.atPath('APIGWStack.template.json'),
              stackName: 'Meerkats-APIGWStack',
              adminPermissions: true,
              runOrder: 2,
              // generate a file with the outputs
              // (in this case, just the generated URL of the API Gateway endpoint)
              output: apiGwStackOutputs,
              outputFileName: 'outputs.json',
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Integ_Test',
              input: apiGwStackOutputs,
              runOrder: 3,
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
        },
      ],
    });
  }
}
