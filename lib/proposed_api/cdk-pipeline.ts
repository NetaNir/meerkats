import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import { ICdkBuild } from "./cdk-build";
import { DeployCdkStackAction } from "./deploy-cdk-stack-action";

export interface CdkPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: ICdkBuild;

  readonly pipelineName?: string;

  readonly artifactBucket?: s3.IBucket;
}

export class CdkPipeline extends cdk.Construct {
  private readonly pipeline: codepipeline.Pipeline;

  constructor(scope: cdk.Construct, id: string, props: CdkPipelineProps) {
    super(scope, id);

    const sourceOutput = props.source.actionProperties.outputs![0];
    const buildConfig = props.build.bind(this, { sourceOutput });

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
          stageName: 'Self_Mutation',
          actions: [
            new DeployCdkStackAction({
              baseActionName: 'Self_Mutate',
              input: buildConfig.cdkBuildOutput,
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
}
