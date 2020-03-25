import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct, SecretValue, Stack, StackProps } from '@aws-cdk/core';
import { CdkBuilds } from "./proposed_api/cdk-build";
import { CdkPipeline } from "./proposed_api/cdk-pipeline";
import { ConstructDomain } from './proposed_api/construct-domain';

export class MyPipelineStack extends Stack {
  private pipeline: CdkPipeline;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // allow customizing the SecretsManager GitHub token name
    // (needed for the GitHub source action)
    const gitHubTokenSecretName = process.env.GITHUB_TOKEN || 'my-github-token';

    this.pipeline = new CdkPipeline(this, 'Pipeline', {
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
  }

  public addStage(stageName: string, domain: ConstructDomain) {
    domain.lock();
    return this.pipeline.addCdkStage(stageName, domain.stacks);
  }
}