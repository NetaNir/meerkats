import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';

export interface CdkBuildOptions {
  /**
   * The (input) artifact that holds the Source
   */
  readonly sourceArtifact: codepipeline.Artifact;
}

/**
 * Result of binding a CdkBuild to the Pipeline
 */
export interface CdkBuildConfig {
  /**
   * The Action that got added to the Pipeline
   */
  readonly action: codepipeline.IAction;

  /**
   * The (output) artifact that holds the produced Cloud Assembly
   */
  readonly cloudAssemblyArtifact: codepipeline.Artifact;
}

export interface StandardBuildOptions {
  /**
   * Environment variables to send into build
   */
  readonly environmentVariables?: Record<string, codebuild.BuildEnvironmentVariable>;

  /**
   * Environment variables to copy over from parent env
   *
   * These are environment variables that are being used by the build.
   */
  readonly copyEnvironmentVariables?: string[];

  /**
   * Name of the build action
   *
   * @default 'Synth'
   */
  readonly actionName?: string;

  /**
   * Name of the CodeBuild project
   *
   * @default - Automatically generated
   */
  readonly projectName?: string;

}

export abstract class CdkBuild {
  /**
   * Perform a standard NPM build
   */
  public static standardNpmBuild(buildOptions: StandardNpmBuildProps = {}): CdkBuild {
    return new StandardNpmBuild(buildOptions);
  }

  /**
   * Perform a standard Yarn build
   */
  public static standardYarnBuild(buildOptions: StandardYarnBuildProps = {}): CdkBuild {
    return new StandardYarnBuild(buildOptions);
  }

  /**
   * Perform a build using a buildspec that's in the repository
   *
   * The repository's `buildspec.yaml` should contain the instructions necessary
   * to build and run `cdk synth` the application, and declare the files in the synth
   * target directory (`cdk.out` if not configured to be different) as the output
   * artifact.
   *
   * You would do this by adding the following at the end of the `buildspec.yaml` file:
   *
   * ```
   *   artifacts:
   *      base-directory: 'cdk.out'
   *      files: '** /*'
   * ```
   */
  public static buildSpecBuild(buildOptions: BuildSpecBuildProps = {}): CdkBuild {
    return new BuildSpecBuild(buildOptions);
  }

  /**
   * Use an existing CodeBuild project as a Build step
   */
  public static fromCodeBuildProject(project: codebuild.IProject): CdkBuild {
    const output = new codepipeline.Artifact();
    return {
      bind(_scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig {
        return {
          action: new codepipeline_actions.CodeBuildAction({
            actionName: 'Synth',
            project,
            input: options.sourceArtifact,
            outputs: [output],
          }),
          cloudAssemblyArtifact: output,
        };
      }
    };
  }

  public abstract bind(scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig;
}

import { BuildSpecBuild, BuildSpecBuildProps } from './buildspec-build';
import { StandardNpmBuild, StandardNpmBuildProps } from './npm-build';
import { StandardYarnBuild, StandardYarnBuildProps } from './yarn-build';