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

    const stackActions = this.stackActions;
    for (const [thisStackIndex, stackAction] of enumerate(stackActions)) {
      // temporary workaround for the stack dependency problem fixed in https://github.com/aws/aws-cdk/pull/6458
      // just skip the validation for the CodePipeline stack
      if (stackAction._stack === cdk.Stack.of(this)) {
        continue;
      }

      // For every dependency, it must be deployed in an action before this one
      for (const dep of stackAction._stack.dependencies) {
        const depIndex = stackActions.findIndex(s => s._stack === dep);

        if (depIndex === -1) {
          // FIXME: We should decide how bad this is. It might be the user will
          // deploy some stacks by hand because it contains some shared bootstrap
          // resources?
          ret.push(`Stack '${stackAction._stack.stackName}' depends on stack ` +
              `'${dep.stackName}', but that dependency is not deployed through the pipeline!`);
        } else if (depIndex > thisStackIndex) {
          ret.push(`Stack '${stackAction._stack.stackName}' depends on stack ` +
              `'${dep.stackName}', but is deployed before it in the pipeline!`);
        }
      }
    }
    return ret;
  }

  /**
   * Return all StackDeployActions in an ordered list
   */
  private get stackActions(): DeployCdkStackAction[] {
    return flatMap(this.pipeline.stages, s => s.actions.filter(isDeployAction).sort(sortByRunOrder));
  }
}

function enumerate<A>(xs: A[]): Array<[number, A]> {
  const ret = new Array<[number, A]>();
  for (let i = 0; i < xs.length; i++) {
    ret.push([i, xs[i]]);
  }
  return ret;
}

function sortByRunOrder(a: DeployCdkStackAction, b: DeployCdkStackAction) {
  return a._createChangeSetRunOrder - b._createChangeSetRunOrder;
}

function isDeployAction(a: codepipeline.IAction): a is DeployCdkStackAction {
  return a instanceof DeployCdkStackAction;
}

function flatMap<A, B>(xs: A[], f: (x: A) => B[]): B[] {
  return Array.prototype.concat([], ...xs.map(f));
}
