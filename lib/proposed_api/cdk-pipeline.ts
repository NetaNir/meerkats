import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
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

  protected validate(): string[] {
    const ret = new Array<string>();

    const stages = this.pipeline.stages;

    // validate that the order in the pipeline does not violate the stack dependency order
    for (let baseStageNr = 0; baseStageNr < stages.length; baseStageNr++) {
      const baseStage = stages[baseStageNr];
      for (const baseAction of baseStage.actions) {
        if (!(baseAction instanceof DeployCdkStackAction)) {
          continue;
        }
        // temporary workaround for the stack dependency problem fixed in https://github.com/aws/aws-cdk/pull/6458
        // just skip the validation for the CodePipeline stack
        if (baseAction._stack === cdk.Stack.of(this)) {
          continue;
        }
        for (const dep of baseAction._stack.dependencies) {
          // search for the dependency among all stacks deployed by this pipeline
          let found = false;
          for (let depStageNr = 0; depStageNr < stages.length; depStageNr++) {
            for (const depAction of stages[depStageNr].actions) {
              if (!(depAction instanceof DeployCdkStackAction)) {
                continue;
              }
              if (dep === depAction._stack) {
                found = true;

                // it's an error if the dependency is either in a later stage,
                // or in the same stage, but not with a lower runOrder
                if (baseStageNr < depStageNr || (baseStageNr === depStageNr &&
                    baseAction._createChangeSetRunOrder <= depAction._createChangeSetRunOrder)) {
                  ret.push(`Stack '${baseAction._stack.stackName}' depends on stack ` +
                      `'${dep.stackName}', but is deployed before it in the pipeline!`);
                }

                // no point iterating anymore, break
                break;
              }
            }
          }

          if (!found) {
            ret.push(`Stack '${baseAction._stack.stackName}' depends on stack ` +
                `'${dep.stackName}', but that dependency is not deployed through the pipeline!`);
          }
        }
      }
    }

    return ret;
  }
}
