import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import { CfnOutput, Construct, RemovalPolicy, Stack } from '@aws-cdk/core';
import { ICdkBuild } from "./cdk-build";
import { DeployCdkStackAction } from "./deploy-cdk-stack-action";
import { PublishAssetsAction } from './publish-assets-action';
import { UpdatePipelineAction } from './update-pipeline-action';
import { IValidation } from './validation';

export interface CdkPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: ICdkBuild;

  readonly pipelineName?: string;
}

export class CdkPipeline extends Construct {
  public readonly cloudAssemblyArtifact: codepipeline.Artifact;

  private readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: CdkPipelineProps) {
    super(scope, id);
    // remove the pipeline's key & bucket, to not leave trash in the account
    const pipelineKey = new kms.Key(scope, 'PipelineKey', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const pipelineBucket = new s3.Bucket(scope, 'PipelineBucket', {
      encryptionKey: pipelineKey,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.cloudAssemblyArtifact = new codepipeline.Artifact();

    const sourceOutput = props.source.actionProperties.outputs![0];
    const buildConfig = props.build.bind(this, { sourceOutput, cloudAssemblyArtifact: this.cloudAssemblyArtifact });

    const vendoredGitHubLocation = `https://github.com/NetaNir/meerkats/archive/${process.env.BRANCH || 'master'}.zip`;
    const vendorZipDir = `meerkats-${(process.env.BRANCH || 'master').replace(/\//g, '-')}/vendor`;

    const pipelineStack = Stack.of(this);

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
          actions: [new UpdatePipelineAction(this, 'UpdatePipeline', {
            cloudAssemblyInput: buildConfig.cdkBuildOutput,
            // hack hack for experimentation
            vendoredGitHubLocation,
            vendorZipDir,
            pipelineStackName: pipelineStack.stackName,
          })],
        },
        {
          stageName: 'Assets',
          actions: [new PublishAssetsAction(this, 'PublishAssets', {
            cloudAssemblyInput: buildConfig.cdkBuildOutput,
            // hack hack for experimentation
            vendoredGitHubLocation,
            vendorZipDir,
          })],
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

  protected validate(): string[] {
    const ret = new Array<string>();

    const stackActions = this.stackActions;
    for (const [thisStackIndex, stackAction] of enumerate(stackActions)) {
      // temporary workaround for the stack dependency problem fixed in https://github.com/aws/aws-cdk/pull/6458
      // just skip the validation for the CodePipeline stack
      if (stackAction._stack === Stack.of(this)) {
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

export interface CdkStageOptions {
  readonly stageName: string;
  readonly stacks: CdkStack[];
  readonly validations?: IValidation[];
}

export class CdkStage {
  public readonly stageName: string;
  public readonly stacks: CdkStack[];
  public readonly validations?: IValidation[];
  public stage: codepipeline.IStage;

  constructor(props: CdkStageOptions) {
    this.stageName = props.stageName;
    this.stacks = props.stacks;
    this.validations = props.validations ?? new Array<IValidation>();
  }

  public addValidations(...validations: IValidation[]) {
    validations.forEach(v => this.validations?.push(v));
  }

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

/**
 * Create a CdkStage from a set of Stack objects and outputs we want to observe
 */
export function stageFromStacks(name: string, stacks: Stack[], interestingOutputs: CfnOutput[]) {
  const cdkStacks = new Array<CdkStack>();
  const artifacts = new Array<codepipeline.Artifact>();

  for (const stack of stacks) {
    const needThisStacksOutput = interestingOutputs.some(output => stack === Stack.of(output));

    const artifact = needThisStacksOutput
      // this is the artifact that will record the output containing the generated URL of the API Gateway
      // Need to explicitly name it because the stage name contains a '.' and that's not allowed to be in the artifact name.
      ? new codepipeline.Artifact(`Artifact_${name}_${stack.stackName}_Output`)
      : undefined;

    if (artifact) {
      artifacts.push(artifact);
    }

    cdkStacks.push({ stack, outputsArtifact: artifact });
  }

  return {
    artifacts,
    stage: new CdkStage({
      stageName: name,
      stacks: cdkStacks,
    })
  };
}

function identity<A>(x: A): A {
  return x;
}

function reversed<A>(xs: A[]): A[] {
  xs.reverse();
  return xs;
}