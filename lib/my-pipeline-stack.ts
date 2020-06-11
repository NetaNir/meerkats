import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct, SecretValue, Stack, StackProps, Stage } from '@aws-cdk/core';
import { AppDeliveryPipeline, CdkBuilds } from "./app-delivery";

export class MyPipelineStack extends Stack {
  private pipeline: AppDeliveryPipeline;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // allow customizing the SecretsManager GitHub token name
    // (needed for the GitHub source action)
    const gitHubTokenSecretName = process.env.GITHUB_TOKEN || 'my-github-token';

    this.pipeline = new AppDeliveryPipeline(this, 'Pipeline', {
      pipelineName: 'DemoPipeline',

      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: new codepipeline.Artifact(),
        oauthToken: SecretValue.secretsManager(gitHubTokenSecretName),
        owner: 'NetaNir',
        repo: 'meerkats',
        branch: process.env.BRANCH,
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),

      build: CdkBuilds.standardNpmBuild({
        // Forward environment variables to build if configured, so
        // that synthesized pipeline will yield the same pipeline as has been
        // synth'd locally.
        copyEnvironmentVariables: ['GITHUB_TOKEN', 'BRANCH'],
      })
    });
  }

  public addApplicationStage(stage: Stage) {
    return this.pipeline.addApplicationStage(stage);
  }
}