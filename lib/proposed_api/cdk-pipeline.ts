import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { ICdkBuild } from "./cdk-build";
import { DeployCdkStackAction } from "./deploy-cdk-stack-action";
import { Stack } from '@aws-cdk/core';
import { IValidation } from './validation';
import { IAction } from '@aws-cdk/aws-codepipeline';

export interface CdkPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: ICdkBuild;

  readonly pipelineName?: string;

  readonly artifactBucket?: s3.IBucket;
}

export class CdkPipeline extends cdk.Construct {
  public readonly cloudAssemblyArtifact: codepipeline.Artifact;

  private readonly pipeline: codepipeline.Pipeline;

  constructor(scope: cdk.Construct, id: string, props: CdkPipelineProps) {
    super(scope, id);

    this.cloudAssemblyArtifact = new codepipeline.Artifact();

    const sourceOutput = props.source.actionProperties.outputs![0];
    const buildConfig = props.build.bind(this, { sourceOutput, cloudAssemblyArtifact: this.cloudAssemblyArtifact });

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      ...props,
      restartExecutionOnUpdate: true,
      stages: [
        {
          stageName: 'Source',
          actions: [props.source],
        },
        {
          stageName: 'Build',
          actions: [buildConfig.action],
        },
        {
          stageName: 'UpdatePipeline',
          actions: [
            new DeployCdkStackAction({
              baseActionName: Stack.of(this).stackName,
              input: this.cloudAssemblyArtifact,
              stack: cdk.Stack.of(this),
            }),
          ],
        },
      ],
    });
  }

  public addStage(stageOptions: codepipeline.StageOptions): codepipeline.IStage {
    return this.pipeline.addStage(stageOptions);
  }

  public addCdkStage(stageOptions: CdkStageOptions): codepipeline.IStage {
    let runOrder = 1;

    const actions: codepipeline.IAction[] = stageOptions.stacks.map((stack, i) => {
      try {
        return new DeployCdkStackAction({
          baseActionName: stack.stack.stackName,
          input: this.cloudAssemblyArtifact,
          stack: stack.stack,
          output: stack.outputsArtifact,
          outputFileName: stack.outputsArtifact ? 'outputs.json' : undefined,
          baseRunOrder: runOrder,
        });
      } finally {
        runOrder += 2; // Ew
      }
    });

    for (const validation of stageOptions.validations || []) {
      actions.push(validation.produceAction(this, {
        runOrder,
      }));
      runOrder += 1;

    }

    return this.pipeline.addStage({
      stageName: stageOptions.stageName,
      actions,
    });
  }
}

export interface CdkStageOptions {
  readonly stageName: string;
  readonly stacks: CdkStack[];
  readonly validations?: IValidation[];
}

export interface CdkStack {
  /**
   * Stack to deploy
   */
  readonly stack: Stack;

  /**
   * Store the outputs in this artifact if given
   *
   * Filename: 'outputs.json'
   */
  readonly outputsArtifact?: codepipeline.Artifact;
}