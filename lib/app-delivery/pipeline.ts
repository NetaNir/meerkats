import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { App, CfnOutput, Construct, Stack, Stage } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import * as path from 'path';
import { DeployCdkStackAction, PublishAssetsAction, UpdatePipelineAction } from './actions';
import { CdkBuild } from './builds';
import { AssetManifest, DestinationIdentifier } from './private/asset-manifest';
import { appOf, assemblyBuilderOf } from './private/construct-internals';
import { AddStageOptions, AppDeliveryStage, AssetPublishingCommand, StackOutput } from './stage';

export interface AppDeliveryPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: CdkBuild;

  readonly pipelineName?: string;

  /**
   * CDK CLI version to use in pipeline
   *
   * Some Actions in the pipeline will download and run a version of the CDK
   * CLI. Specify the version here.
   *
   * @default - Latest version
   */
  readonly cdkCliVersion?: string;
}

export class AppDeliveryPipeline extends Construct {
  private readonly cloudAssemblyArtifact: codepipeline.Artifact;
  private readonly pipeline: codepipeline.Pipeline;
  private readonly assets: AssetPublishing;
  private readonly stages: AppDeliveryStage[] = [];
  private readonly outputArtifacts: Record<string, codepipeline.Artifact> = {};

  constructor(scope: Construct, id: string, props: AppDeliveryPipelineProps) {
    super(scope, id);

    if (!App.isApp(this.node.root)) {
      throw new Error(`AppDeliveryPipeline must be created under an App`);
    }

    const sourceOutput = props.source.actionProperties.outputs![0];

    const buildConfig = props.build.bind(this, {
      sourceArtifact: sourceOutput,
    });

    this.cloudAssemblyArtifact = buildConfig.cloudAssemblyArtifact;

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
            cloudAssemblyInput: this.cloudAssemblyArtifact,
            pipelineStackName: pipelineStack.stackName,
            cdkCliVersion: props.cdkCliVersion,
            projectName: maybeSuffix(props.pipelineName, '-selfupdate'),
          })],
        },
      ],
    });

    this.assets = new AssetPublishing(this, 'Assets', {
      cloudAssemblyInput: this.cloudAssemblyArtifact,
      cdkCliVersion: props.cdkCliVersion,
      pipeline: this.pipeline,
      projectName: maybeSuffix(props.pipelineName, '-publish'),
    });
  }

  /**
   * Add a stage to the pipeline that will deploy the given application
   *
   * All stacks in the application will be deployed in the appropriate order, and
   * all assets found in the application will be added to the asset publishing stage.
   */
  public addApplicationStage(appStage: Stage, options: AddStageOptions = {}): AppDeliveryStage {
    const stage = this.addStage(appStage.stageName);
    stage.addApplicationStage(appStage, options);
    return stage;
  }

  /**
   * Add a new, empty stage to the pipeline
   *
   * Prefer to use `addApplicationStage` if you are intended to deploy a CDK application,
   * but you can use this method if you want to add other kinds of Actions to a pipeline.
   */
  public addStage(stageName: string) {
    const pipelineStage = this.pipeline.addStage({
      stageName,
    });

    const stage = new AppDeliveryStage(this, stageName, {
      cloudAssemblyArtifact: this.cloudAssemblyArtifact,
      pipelineStage,
      stageName,
      host: {
        publishAsset: this.assets.addPublishAssetAction.bind(this.assets),
        stackOutputArtifact: (artifactId) => this.outputArtifacts[artifactId],
      }
    });
    this.stages.push(stage);
    return stage;
  }

  /**
   * Get the StackOutput object that holds this CfnOutput object's value in this pipeline
   */
  public stackOutput(cfnOutput: CfnOutput): StackOutput {
    const stack = Stack.of(cfnOutput);

    if (!this.outputArtifacts[stack.artifactId]) {
      // We should have stored the ArtifactPath in the map, but its Artifact
      // property isn't publicly readable...
      this.outputArtifacts[stack.artifactId] = new codepipeline.Artifact(`Artifact_${stack.artifactId}_Outputs`);
    }

    return new StackOutput(this.outputArtifacts[stack.artifactId].atPath('outputs.json'), cfnOutput.logicalId);
  }

  /**
   * Validate that we don't have any stacks violating dependency order in the pipeline
   *
   * Our own convenience methods will never generate a pipeline that does that (although
   * this is a nice verification), but a user can also add the stacks by hand.
   */
  protected validate(): string[] {
    const ret = new Array<string>();

    ret.push(...this.validateDeployOrder());
    ret.push(...this.validateRequestedOutputs());

    return ret;
  }

  protected onPrepare() {
    super.onPrepare();

    // TODO: Support this in a proper way in the upstream library. For now, we
    // "un-add" the Assets stage if it turns out to be empty.
    this.assets.removeAssetsStageIfEmpty();
  }

  /**
   * Return all StackDeployActions in an ordered list
   */
  private get stackActions(): DeployCdkStackAction[] {
    return flatMap(this.pipeline.stages, s => s.actions.filter(isDeployAction));
  }

  private* validateDeployOrder(): IterableIterator<string> {
    const stackActions = this.stackActions;
    for (const stackAction of stackActions) {
      // For every dependency, it must be executed in an action before this one is prepared.
      for (const depId of stackAction.dependencyStackArtifactIds) {
        const depAction = stackActions.find(s => s.stackArtifactId === depId);

        if (depAction === undefined) {
          this.node.addWarning(`Stack '${stackAction.stackName}' depends on stack ` +
              `'${depId}', but that dependency is not deployed through the pipeline!`);
        } else if (!(depAction.executeRunOrder < stackAction.prepareRunOrder)) {
          yield `Stack '${stackAction.stackName}' depends on stack ` +
              `'${depAction.stackName}', but is deployed before it in the pipeline!`;
        }
      }
    }
  }

  private* validateRequestedOutputs(): IterableIterator<string> {
    const artifactIds = this.stackActions.map(s => s.stackArtifactId);

    for (const artifactId of Object.keys(this.outputArtifacts)) {
      if (!artifactIds.includes(artifactId)) {
        yield `Trying to use outputs for Stack '${artifactId}', but Stack is not deployed in this pipeline. Add it to the pipeline.`;
      }
    }
  }
}

function isDeployAction(a: codepipeline.IAction): a is DeployCdkStackAction {
  return a instanceof DeployCdkStackAction;
}

function flatMap<A, B>(xs: A[], f: (x: A) => B[]): B[] {
  return Array.prototype.concat([], ...xs.map(f));
}

export interface CdkStageOptions {
  readonly pipelineStage: codepipeline.IStage;
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

interface AssetPublishingProps {
  readonly cloudAssemblyInput: codepipeline.Artifact;
  readonly pipeline: codepipeline.Pipeline;
  readonly cdkCliVersion?: string;
  readonly projectName?: string;
}

/**
 * Add appropriate publishing actions to the asset publishing stage
 */
class AssetPublishing extends Construct {
  private readonly publishers: Record<string, PublishAssetsAction> = {};
  private readonly myCxAsmRoot: string;

  private readonly stage: codepipeline.IStage;

  constructor(scope: Construct, id: string, private readonly props: AssetPublishingProps) {
    super(scope, id);
    this.myCxAsmRoot = path.resolve(assemblyBuilderOf(appOf(this)).outdir);

    // We MUST add the Stage immediately here, otherwise it will be in the wrong place
    // in the pipeline!
    this.stage = this.props.pipeline.addStage({ stageName: 'Assets' });
  }

  /**
   * Make sure there is an action in the stage to publish the given asset
   *
   * Assets are grouped by asset ID (which represent individual assets) so all assets
   * are published in parallel. For each assets, all destinations are published sequentially
   * so that we can reuse expensive operations between them (mostly: building a Docker image).
   */
  public addPublishAssetAction(command: AssetPublishingCommand) {
    // FIXME: this is silly, we need the relative path here but no easy way to get it
    const relativePath = path.relative(this.myCxAsmRoot, command.assetManifestPath);

    let action = this.publishers[command.assetId];
    if (!action) {
      action = this.publishers[command.assetId] = new PublishAssetsAction(this, command.assetId, {
        actionName: command.assetId,
        cloudAssemblyInput: this.props.cloudAssemblyInput,
        cdkCliVersion: this.props.cdkCliVersion,
        projectName: maybeSuffix(this.props.projectName, `-${command.assetId}`),
        assetType: command.assetType,
      });
      this.stage.addAction(action);
    }

    action.addPublishCommand(relativePath, command.assetSelector);
  }

  /**
   * Remove the Assets stage if it turns out we didn't add any Assets to publish
   */
  public removeAssetsStageIfEmpty() {
    if (Object.keys(this.publishers).length === 0) {
      // Hacks to get access to innards of Pipeline
      // Modify 'stages' array in-place to remove Assets stage if empty
      const stages: codepipeline.IStage[] = (this.props.pipeline as any)._stages;

      const ix = stages.indexOf(this.stage);
      if (ix > -1) {
        stages.splice(ix, 1);
      }
    }
  }
}

function maybeSuffix(x: string | undefined, suffix: string): string | undefined {
  if (x === undefined) { return undefined; }
  return `${x}${suffix}`;
}