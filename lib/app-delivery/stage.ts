import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { CfnOutput, Construct, Stack } from "@aws-cdk/core";
import * as cxapi from '@aws-cdk/cx-api';
import { DeployCdkStackAction } from './actions';
import { IValidation } from './validation';

export interface AppDeliveryStageProps {
  /**
   * Name of the stage that should be created
   */
  readonly stageName: string;

  /**
   * Pipeline to add the stage to
   */
  readonly pipeline: codepipeline.Pipeline;

  /**
   * The CodePipeline Artifact with the Cloud Assembly
   */
  readonly cloudAssemblyArtifact: codepipeline.Artifact;
}

export class AppDeliveryStage extends Construct {

  public _nextSequentialRunOrder = 0;
  private readonly pipelineStage: codepipeline.IStage;
  private readonly cloudAssemblyArtifact: codepipeline.Artifact;
  private readonly validations: IValidation[] = [];
  private readonly stacksToDeploy = new Array <{ runOrder: number, stackArtifact: cxapi.CloudFormationStackArtifact }>();
  private readonly outputArtifacts: Record<string, codepipeline.Artifact> = {};
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: AppDeliveryStageProps) {
    super(scope, id);

    this.stageName = props.stageName;

    this.pipelineStage = props.pipeline.addStage({
      stageName: props.stageName,
    });
    this.cloudAssemblyArtifact = props.cloudAssemblyArtifact;
  }

  public addValidations(...validations: IValidation[]) {
    this.validations.push(...validations);
  }

  /**
   * Return the artifact that holds the outputs for the given stack
   */
  public stackOutputs(stackName: string): StackOutputs {
    if (!this.stacksToDeploy.find(s => s.stackArtifact.stackName)) {
      throw new Error(`No stack with name '${stackName}' added to stage '${this.stageName}' yet. Add the stack first before calling stackOutputs().`);
    }

    if (!this.outputArtifacts[stackName]) {
      this.outputArtifacts[stackName] = new codepipeline.Artifact(`Artifact_${this.stageName}_${stackName}_Outputs`);
    }
    return new StackOutputs(this.outputArtifacts[stackName].atPath('outputs.json'));
  }

  /**
   * Add a deployment action based on a stack artifact
   */
  public addStackDeploymentAction(stackArtifact: cxapi.CloudFormationStackArtifact) {
    // Remember for later, see 'prepare()'
    // We know that deploying a stack is going to take up 2 runorder slots later on.
    this.stacksToDeploy.push({
      runOrder: this.nextSequentialRunOrder(2),
      stackArtifact
    });
  }

  /**
   * Add a non-appdelivery Action
   *
   * You need to make sure it is created with the right runOrder. Call `nextSequentialRunOrder()`
   * for every action to get actions to execute in sequence.
   */
  public addCustomAction(action: codepipeline.IAction) {
    this.pipelineStage.addAction(action);
  }

  /**
   * Return the runOrder number necessary to run the next Action in sequence with the rest
   *
   * FIXME: This is here because Actions are immutable and can't be reordered
   * after creation, nor is there a way to specify relative priorities, which
   * is a limitation that we should take away in the base library.
   */
  public nextSequentialRunOrder(count: number = 1): number {
    const ret = this._nextSequentialRunOrder;
    this._nextSequentialRunOrder += count;
    return ret;
  }

  /**
   * Actually add all the DeployStack actions to the stage.
   *
   * We do this late because before we can render the actual DeployActions,
   * we need to know whether or not we need to capture the stack outputs.
   *
   * FIXME: This is here because Actions are immutable and can't be reordered
   * after creation, nor is there a way to specify relative priorities, which
   * is a limitation that we should take away in the base library.
   */
  protected prepare() {
    for (const { runOrder, stackArtifact } of this.stacksToDeploy) {
      const artifact = this.outputArtifacts[stackArtifact.stackName];

      this.pipelineStage.addAction(new DeployCdkStackAction(this, {
        artifact: stackArtifact,
        cloudAssemblyInput: this.cloudAssemblyArtifact,
        output: artifact,
        outputFileName: artifact ? 'outputs.json' : undefined,
        baseRunOrder: runOrder,
      }));
    }

    for (const validation of this.validations) {
      validation.bind(this, this);
    }
  }
}

export class StackOutputs {
  constructor(public readonly artifactFile: codepipeline.ArtifactPath) {
  }

  public output(outputName: string) {
    return new StackOutput(this, outputName);
  }
}

export class StackOutput {
  public static fromCfnOutput(stage: AppDeliveryStage, output: CfnOutput) {
    const stack = Stack.of(output);
    return stage.stackOutputs(stack.stackName).output(output.logicalId);
  }

  constructor(public readonly outputs: StackOutputs, public readonly outputName: string) {
  }
}