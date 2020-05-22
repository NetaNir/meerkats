import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { App, Construct, Stack } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import * as path from 'path';
import { DeployCdkStackAction, PublishAssetsAction, UpdatePipelineAction } from './actions';
import { ICdkBuild } from './builds';
import { AssetManifest, DestinationIdentifier } from './private/asset-manifest';
import { appOutDir } from './private/construct-tree';
import { topologicalSort } from './private/toposort';
import { AppDeliveryStage } from './stage';

export interface AppDeliveryPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: ICdkBuild;

  readonly pipelineName?: string;
}

export class AppDeliveryPipeline extends Construct {
  private readonly cloudAssemblyArtifact: codepipeline.Artifact;
  private readonly pipeline: codepipeline.Pipeline;
  private readonly assets: AssetPublishing;
  private readonly outDirsSeen = new Set<string>();

  constructor(scope: Construct, id: string, props: AppDeliveryPipelineProps) {
    super(scope, id);

    if (!App.isApp(this.node.root)) {
      throw new Error(`AppDeliveryPipeline must be created under an App`);
    }

    const sourceOutput = props.source.actionProperties.outputs![0];

    const buildConfig = props.build.bind(this, {
      sourceOutput,
      cloudAssemblyOutput: new codepipeline.Artifact()
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
          })],
        },
      ],
    });

    this.assets = new AssetPublishing(this, 'Assets', this.cloudAssemblyArtifact, this.pipeline.addStage({
      stageName: 'Assets',
    }));
  }

  /**
   * Add a stage to the pipeline that will deploy the given application
   *
   * All stacks in the application will be deployed in the appropriate order, and
   * all assets found in the application will be added to the asset publishing stage.
   */
  public addApplicationStage(stageName: string, application: App, options: AddApplicationStageOptions = {}): AppDeliveryStage {
    this.validateAppOutDir(stageName, application);
    const asm = application.synth();

    // Get all assets manifests and add the assets in 'em to the asset publishing stage.
    asm.artifacts.filter(isAssetManifest).forEach(a => this.assets.publishAssetsFromManifest(asm, a));

    const stage = this.addStage(stageName);

    const sortedStacks = topologicalSort(asm.stacks,
      stack => stack.id,
      stack => stack.dependencies.map(d => d.id));

    for (const stack of sortedStacks) {
      stage.addStackDeploymentAction(stack);
    }

    return stage;
  }

  /**
   * Add a new, empty stage to the pipeline
   *
   * Prefer to use `addApplicationStage` if you are intended to deploy a CDK application,
   * but you can use this method if you want to add other kinds of Actions to a pipeline.
   */
  public addStage(stageName: string): AppDeliveryStage {
    return new AppDeliveryStage(this, stageName, {
      cloudAssemblyArtifact: this.cloudAssemblyArtifact,
      pipeline: this.pipeline,
      stageName,
    });
  }

  /**
   * Validate that we don't have any stacks violating dependency order in the pipeline
   *
   * Our own convenience methods will never generate a pipeline that does that (although
   * this is a nice verification), but a user can also add the stacks by hand.
   */
  protected validate(): string[] {
    const ret = new Array<string>();

    const stackActions = this.stackActions;
    for (const stackAction of stackActions) {
      // For every dependency, it must be executed in an action before this one is prepared.
      for (const dep of stackAction.artifact.dependencies.filter(isStackArtifact)) {
        const depAction = stackActions.find(s => s.artifact === dep);

        if (depAction === undefined) {
          this.node.addWarning(`Stack '${stackAction.stackName}' depends on stack ` +
              `'${dep.id}', but that dependency is not deployed through the pipeline!`);
        } else if (!(depAction.executeRunOrder < stackAction.prepareRunOrder)) {
          ret.push(`Stack '${stackAction.stackName}' depends on stack ` +
              `'${depAction.stackName}', but is deployed before it in the pipeline!`);
        }
      }
    }

    return ret;
  }

  /**
   * Return all StackDeployActions in an ordered list
   */
  private get stackActions(): DeployCdkStackAction[] {
    return flatMap(this.pipeline.stages, s => s.actions.filter(isDeployAction));
  }

  private validateAppOutDir(stageName: string, application: App) {
    const outDir = appOutDir(application);
    const myAppOutDir = appOutDir(this.node.root as App);
    if (!outDir.startsWith(myAppOutDir) || outDir === myAppOutDir) {
      throw new Error(`The App of stage '${stageName}' must have an 'outdir' under '${myAppOutDir}'`);
    }
    if (this.outDirsSeen.has(outDir)) {
      throw new Error(`All Apps given to 'addApplicationStage()' must have a distinct 'outdir' rooted under '${myAppOutDir}'`);
    }
    this.outDirsSeen.add(outDir);
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

function isAssetManifest(s: cxapi.CloudArtifact): s is cxapi.AssetManifestArtifact {
  return s instanceof cxapi.AssetManifestArtifact;
}

/**
 * Add appropriate publishing actions to the asset publishing stage
 */
class AssetPublishing extends Construct {
  private publishers: Record<string, PublishAssetsAction> = {};
  private myCxAsmRoot: string;

  constructor(scope: Construct, id: string,
              private readonly cloudAssemblyInput: codepipeline.Artifact,
              private readonly stage: codepipeline.IStage) {
    super(scope, id);

    this.myCxAsmRoot = path.resolve(appOutDir(this.node.root as App));
  }

  /**
   * Publish all assets found in the given asset manifests
   */
  public publishAssetsFromManifest(asm: cxapi.CloudAssembly, manifestArtifact: cxapi.AssetManifestArtifact) {
    const manifest = AssetManifest.fromFile(manifestArtifact.file);

    // FIXME: this is silly, we need the relative path here but no easy way to get it
    const relativePath = path.relative(this.myCxAsmRoot, manifestArtifact.file);

    for (const entry of manifest.entries) {
      this.addPublishAssetAction(relativePath, entry.id);
    }
  }

  /**
   * Make sure there is an action in the stage to publish the given asset
   *
   * Assets are grouped by asset ID (which represent individual assets) so all assets
   * are published in parallel. For each assets, all destinations are published sequentially
   * so that we can reuse expensive operations between them (mostly: building a Docker image).
   */
  public addPublishAssetAction(relativeManifestPath: string, assetId: DestinationIdentifier) {
    let action = this.publishers[assetId.assetId];
    if (!action) {
      action = this.publishers[assetId.assetId] = new PublishAssetsAction(this, assetId.assetId, {
        actionName: assetId.assetId,
        cloudAssemblyInput: this.cloudAssemblyInput,
      });
      this.stage.addAction(action);
    }

    action.addPublishCommand(relativeManifestPath, assetId.toString());
  }
}

export interface AddApplicationStageOptions {
  /**
   * Capture stack outputs for the given stacks
   *
   * @default - No outputs captured
   */
  captureStackOutputs?: string[];
}

function isStackArtifact(a: cxapi.CloudArtifact): a is cxapi.CloudFormationStackArtifact {
  return a instanceof cxapi.CloudFormationStackArtifact;
}