import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { Construct } from '@aws-cdk/core';
import { copyEnvironmentVariables } from './_util';
import { CdkBuildConfig, CdkBuildOptions, ICdkBuild, StandardBuildOptions } from "./builds";

export interface BuildSpecBuildProps extends StandardBuildOptions {
  /**
   * Buildspec filename
   *
   * @default "buildspec.yml"
   */
  readonly buildSpecFilename?: string;
}

export class BuildSpecBuild implements ICdkBuild {
  constructor(private readonly props: BuildSpecBuildProps = {}) {
  }

  public bind(scope: Construct, options: CdkBuildOptions): CdkBuildConfig {
    return {
      action: new codepipeline_actions.CodeBuildAction({
        actionName: this.props.actionName ?? 'Synth',
        project: new codebuild.PipelineProject(scope, 'CdkBuildProject', {
          buildSpec: this.props.buildSpecFilename ? codebuild.BuildSpec.fromSourceFilename(this.props.buildSpecFilename) : undefined,
          environmentVariables: {
            ...copyEnvironmentVariables(...this.props.copyEnvironmentVariables || []),
            ...this.props.environmentVariables
          },
        }),
        input: options.sourceOutput,
        outputs: [options.cloudAssemblyOutput],
      }),
      cloudAssemblyArtifact: options.cloudAssemblyOutput,
    };
  }
}