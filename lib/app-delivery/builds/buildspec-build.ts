import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { Construct } from '@aws-cdk/core';
import { copyEnvironmentVariables } from './_util';
import { CdkBuild, CdkBuildConfig, CdkBuildOptions, StandardBuildOptions } from "./builds";

export interface BuildSpecBuildProps extends StandardBuildOptions {
  /**
   * Buildspec filename
   *
   * @default "buildspec.yml"
   */
  readonly buildSpecFilename?: string;
}

export class BuildSpecBuild extends CdkBuild {
  constructor(private readonly props: BuildSpecBuildProps = {}) {
    super();
  }

  public bind(scope: Construct, options: CdkBuildOptions): CdkBuildConfig {
    const cloudAssemblyOutput = new codepipeline.Artifact();

    return {
      action: new codepipeline_actions.CodeBuildAction({
        actionName: this.props.actionName ?? 'Synth',
        project: new codebuild.PipelineProject(scope, 'CdkBuildProject', {
          projectName: this.props.projectName,
          buildSpec: this.props.buildSpecFilename ? codebuild.BuildSpec.fromSourceFilename(this.props.buildSpecFilename) : undefined,
          environmentVariables: {
            ...copyEnvironmentVariables(...this.props.copyEnvironmentVariables || []),
            ...this.props.environmentVariables
          },
        }),
        input: options.sourceArtifact,
        outputs: [cloudAssemblyOutput],
      }),
      cloudAssemblyArtifact: cloudAssemblyOutput,
    };
  }
}