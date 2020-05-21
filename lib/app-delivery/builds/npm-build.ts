import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { App, Construct } from '@aws-cdk/core';
import { copyEnvironmentVariables } from './_util';
import { CdkBuildConfig, CdkBuildOptions, ICdkBuild, StandardBuildOptions } from "./builds";

export interface StandardNpmBuildProps extends StandardBuildOptions {
  /**
   * Name of the build action
   *
   * @default 'Synth'
   */
  readonly actionName?: string;

  /**
   * The install command
   *
   * @default 'npm ci'
   */
  readonly installCommand?: string;

  /**
   * The build command
   *
   * @default 'npm run build'
   */
  readonly buildCommand?: string;

  /**
   * The synth command
   *
   * @default 'npx cdk synth'
   */
  readonly synthCommand?: string;
}

export class StandardNpmBuild implements ICdkBuild {
  constructor(private readonly props: StandardNpmBuildProps = {}) {
  }

  public bind(scope: Construct, options: CdkBuildOptions): CdkBuildConfig {
    const buildCommand = this.props.buildCommand ?? 'npm run build';
    const synthCommand = this.props.buildCommand ?? 'npx cdk synth';
    const installCommand = this.props.installCommand ?? 'npm ci';

    return {
      action: new codepipeline_actions.CodeBuildAction({
        actionName: this.props.actionName ?? 'Synth',
        project: new codebuild.PipelineProject(scope, 'CdkBuildProject', {
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
              install: {
                commands: installCommand,
              },
              build: {
                commands: `${buildCommand} && ${synthCommand}`,
              },
            },
            // save the generated files in the output artifact
            artifacts: {
              'base-directory': 'cdk.out',
              "files": '**/*',
            },
          }),
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