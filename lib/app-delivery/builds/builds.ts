import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';
import { BuildSpecBuild, BuildSpecBuildProps } from './buildspec-build';
import { StandardNpmBuild, StandardNpmBuildProps } from './npm-build';
import { StandardYarnBuild, StandardYarnBuildProps } from './yarn-build';

export interface CdkBuildOptions {
  readonly sourceOutput: codepipeline.Artifact;

  readonly cloudAssemblyOutput: codepipeline.Artifact;
}

export interface CdkBuildConfig {
  readonly action: codepipeline.IAction;

  readonly cloudAssemblyArtifact: codepipeline.Artifact;
}

export interface ICdkBuild {
  bind(scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig;
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
}

export abstract class CdkBuilds {
  /**
   * Perform a standard NPM build
   */
  public static standardNpmBuild(buildOptions: StandardNpmBuildProps = {}): ICdkBuild {
    return new StandardNpmBuild(buildOptions);
  }

  /**
   * Perform a standard Yarn build
   */
  public static standardYarnBuild(buildOptions: StandardYarnBuildProps = {}): ICdkBuild {
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
  public static buildSpecBuild(buildOptions: BuildSpecBuildProps = {}): ICdkBuild {
    return new BuildSpecBuild(buildOptions);
  }

  public static standardJavaBuild(_cdkBuildOutput: codepipeline.Artifact): ICdkBuild {
    throw new Error('not implemented yet');
  }

  public static standardPythonBuild(_cdkBuildOutput: codepipeline.Artifact): ICdkBuild {
    throw new Error('not implemented yet');
  }

  public static standardCSharpBuild(_cdkBuildOutput: codepipeline.Artifact): ICdkBuild {
    throw new Error('not implemented yet');
  }

  public static fromCodeBuildProject(project: codebuild.IProject, cdkBuildOutput: codepipeline.Artifact): ICdkBuild {
    return {
      bind(_scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig {
        return {
          action: new codepipeline_actions.CodeBuildAction({
            actionName: 'Synth',
            project,
            input: options.sourceOutput,
            outputs: [cdkBuildOutput],
          }),
          cloudAssemblyArtifact: cdkBuildOutput,
        };
      }
    };
  }
}