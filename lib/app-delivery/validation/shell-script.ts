import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { Construct } from "@aws-cdk/core";
import { AppDeliveryStage, StackOutput } from '../stage';
import { IValidation } from "./validation";

export interface ShellScriptValidationProps {
  readonly name: string;
  readonly useOutputs?: Record<string, StackOutput>;
  readonly commands: string[];
}

export class ShellScriptValidation implements IValidation {
  constructor(private readonly props: ShellScriptValidationProps) {
  }

  public bind(scope: Construct, stage: AppDeliveryStage) {
    const inputs = new Array<codepipeline.Artifact>();

    const envVarCommands = new Array<string>();
    envVarCommands.push('set -e');
    for (const [varName, output] of Object.entries(this.props.useOutputs ?? {})) {
      const outputArtifact = output.outputs.artifactFile;

      // Add the artifact to the list of inputs, if it's not in there already. Determine
      // the location where CodeBuild is going to stick it based on whether it's the first (primary)
      // input or an 'extra input', then parse.
      let artifactIndex = inputs.findIndex(a => a.artifactName === outputArtifact.artifact.artifactName);
      if (artifactIndex === -1) {
        artifactIndex = inputs.push(outputArtifact.artifact) - 1;
      }
      const dirEnv = artifactIndex === 0 ? 'CODEBUILD_SRC_DIR' : `CODEBUILD_SRC_DIR_${outputArtifact.artifact.artifactName}`;
      envVarCommands.push(`export ${varName}="$(node -pe 'require(process.env.${dirEnv} + "/${outputArtifact.fileName}")["${output.outputName}"]')"`);
    }

    stage.addCustomAction(new codepipeline_actions.CodeBuildAction({
      actionName: this.props.name,
      input: inputs[0],
      extraInputs: inputs.slice(1),
      runOrder: stage.nextSequentialRunOrder(),
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
    }));
  }
}