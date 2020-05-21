import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';
import { StandardNpmBuild } from './npm-build';

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
}

export abstract class CdkBuilds {
  public static standardNpmBuild(buildOptions: StandardBuildOptions = {}): ICdkBuild {
    return new StandardNpmBuild(buildOptions);
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