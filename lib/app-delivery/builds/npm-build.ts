import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { Construct } from '@aws-cdk/core';
import * as path from 'path';
import { cloudAssemblyBuildSpecDir } from '../private/construct-internals';
import { copyEnvironmentVariables, filterEmpty } from './_util';
import { CdkBuild, CdkBuildConfig, CdkBuildOptions, StandardBuildOptions } from "./builds";

export interface StandardNpmBuildProps extends StandardBuildOptions {
  /**
   * Directory inside the source where pacage.json and cdk.json are located
   *
   * @default - Repository root
   */
  readonly subdirectory?: string;

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

export class StandardNpmBuild extends CdkBuild {
  constructor(private readonly props: StandardNpmBuildProps = {}) {
    super();
  }

  public bind(scope: Construct, options: CdkBuildOptions): CdkBuildConfig {
    const buildCommand = this.props.buildCommand ?? 'npm run build';
    const synthCommand = this.props.buildCommand ?? 'npx cdk synth';
    const installCommand = this.props.installCommand ?? 'npm ci';

    const cloudAssemblyOutput = new codepipeline.Artifact();

    return {
      action: new codepipeline_actions.CodeBuildAction({
        actionName: this.props.actionName ?? 'Synth',
        project: new codebuild.PipelineProject(scope, 'CdkBuildProject', {
          projectName: this.props.projectName,
          environment: this.props.environment,
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
              pre_build: {
                commands: filterEmpty([
                  this.props.subdirectory ? `cd ${this.props.subdirectory}` : '',
                  installCommand,
                ]),
              },
              build: {
                commands: [buildCommand, synthCommand],
              },
            },
            // save the generated files in the output artifact
            artifacts: {
              'base-directory': path.join(this.props.subdirectory ?? '.', cloudAssemblyBuildSpecDir(scope)),
              "files": '**/*',
            },
          }),
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