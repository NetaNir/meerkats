import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';

export interface CdkBuildOptions {
  readonly sourceOutput: codepipeline.Artifact;
}

export interface CdkBuildConfig {
  readonly action: codepipeline.IAction;

  readonly cdkBuildOutput: codepipeline.Artifact;
}

export interface ICdkBuild {
  bind(scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig;
}

export interface StandardBuildOptions {
  /**
   * Environment variables to send into build
   */
  readonly environmentVariables?: Record<string, codebuild.BuildEnvironmentVariable>;
}

export abstract class CdkBuilds {
  public static standardTypeScriptBuild(cdkBuildOutput: codepipeline.Artifact, buildOptions: StandardBuildOptions = {}): ICdkBuild {
    return {
      bind(scope: cdk.Construct, options: CdkBuildOptions): CdkBuildConfig {
        return {
          action: new codepipeline_actions.CodeBuildAction({
            actionName: 'Cdk_Synth',
            project: new codebuild.PipelineProject(scope, 'CdkBuildProject', {
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
                  "files": '**/*',
                },
              }),
              environmentVariables: buildOptions.environmentVariables
            }),
            input: options.sourceOutput,
            outputs: [cdkBuildOutput],
          }),
          cdkBuildOutput,
        };
      }
    };
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
            actionName: 'Cdk_Synth',
            project,
            input: options.sourceOutput,
            outputs: [cdkBuildOutput],
          }),
          cdkBuildOutput,
        };
      }
    };
  }
}
