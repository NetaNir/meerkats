import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import *  as cdk from '@aws-cdk/core';
import *  as kms from '@aws-cdk/aws-kms';
import *  as s3 from '@aws-cdk/aws-s3';

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
    new codepipeline.Pipeline(this, 'Pipeline', {
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
            }),
          ],
        },
      ],
    });
  }
}
