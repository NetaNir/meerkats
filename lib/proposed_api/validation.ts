import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { CfnOutput, Construct } from '@aws-cdk/core';

export interface ProduceActionOptions {
  readonly runOrder: number;
  readonly inputs: ValidationInput[];
}

export interface ValidationInput {
  output: CfnOutput;
  artifact: codepipeline.Artifact;
  artifactFilename: string;
}

export interface IValidation {
  readonly outputsRequired: CfnOutput[];

  produceAction(scope: Construct, options: ProduceActionOptions): codepipeline.IAction;
}

export interface ShellCommandsValidationProps {
  readonly name: string;
  readonly envVars: Record<string, CfnOutput>;
  readonly commands: string[];
}

export class ShellCommandsValidation implements IValidation {
  public readonly outputsRequired: CfnOutput[];

  constructor(private readonly props: ShellCommandsValidationProps) {
    this.outputsRequired = Object.values(props.envVars ?? {});
  }

  public produceAction(scope: Construct, options: ProduceActionOptions): codepipeline.IAction {
    const artifacts = options.inputs.map(i => i.artifact);
    if (new Set(artifacts).size > 1) {
      throw new Error('ShellCommandsValidation only supports outputs from 1 stack (for now)');
    }

    const envVarCommands = new Array<string>();
    envVarCommands.push('set -e');
    for (const [varName, output] of Object.entries(this.outputsRequired)) {
      const theInput = options.inputs.find(input => input.output === output);
      if (!theInput) {
        throw new Error('Uhh');
      }

      envVarCommands.push(`export ${varName}=$(node -pe 'require("./${theInput.artifactFilename}")["${theInput.output.logicalId}"]')`);
    }

    return new codepipeline_actions.CodeBuildAction({
      actionName: this.props.name,
      input: artifacts[0],
      runOrder: options.runOrder,
      project: new codebuild.PipelineProject(scope, this.props.name, {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            build: {
              commands: this.props.commands,
            },
          },
        }),
      }),
    });
  }
}