import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import { Construct } from '@aws-cdk/core';

export interface ProduceActionOptions {
  readonly runOrder: number;
}

export interface IValidation {
  produceAction(scope: Construct, options: ProduceActionOptions): codepipeline.IAction;
}

export interface ShellCommandsValidationProps {
  readonly name: string;
  readonly input: codepipeline.Artifact; // FIXME: A CodeBuildAction has required input???
  readonly commands: string[];
}

export class ShellCommandsValidation implements IValidation {
  constructor(private readonly props: ShellCommandsValidationProps) {
  }

  public produceAction(scope: Construct, options: ProduceActionOptions): codepipeline.IAction {
    return new codepipeline_actions.CodeBuildAction({
      actionName: this.props.name,
      input: this.props.input,
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