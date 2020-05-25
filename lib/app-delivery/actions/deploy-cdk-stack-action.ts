import * as cfn from '@aws-cdk/aws-cloudformation';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cpactions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { App, Construct, Fn, Stack } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import * as path from 'path';
import { appOutDir } from '../private/construct-tree';

/**
 * Properties for a DeployCdkStackAction
 */
export interface DeployCdkStackActionProps {
  /**
   * The Stack to deploy, by means of its stack artifact
   */
  readonly artifact: cxapi.CloudFormationStackArtifact;

  /**
   * Base name of the action
   *
   * @default stackName
   */
  readonly baseActionName?: string;

  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * Run order for the 2 actions that will be created
   *
   * @default 1
   */
  readonly baseRunOrder?: number;

  /**
   * Artifact to write Stack Outputs to
   *
   * @default - No outputs
   */
  readonly output?: codepipeline.Artifact;

  /**
   * Filename in output to write Stack outputs to
   *
   * @default - Required when 'output' is set
   */
  readonly outputFileName?: string;

  /**
   * Name of the change set to create and deploy
   *
   * @default 'PipelineChange'
   */
  readonly changeSetName?: string;

  /**
   * The name of the stack that should be created/updated
   *
   * @default - Same as stack artifact
   */
  readonly stackName?: string;
}

export class DeployCdkStackAction implements codepipeline.IAction {
  public readonly prepareRunOrder: number;
  public readonly executeRunOrder: number;
  public readonly artifact: cxapi.CloudFormationStackArtifact;
  public readonly stackName: string;

  private readonly prepareChangeSetAction: cpactions.CloudFormationCreateReplaceChangeSetAction;
  private readonly executeChangeSetAction: cpactions.CloudFormationExecuteChangeSetAction;

  constructor(scope: Construct, props: DeployCdkStackActionProps) {
    if (props.output && !props.outputFileName) {
      throw new Error(`If 'output' is set, 'outputFileName' is also required`);
    }

    if (!props.artifact.assumeRoleArn) {
      // tslint:disable-next-line:max-line-length
      throw new Error(`Stack '${props.artifact.stackName}' does not have deployment role information; use the 'DefaultStackSynthesizer' synthesizer, or set the '@aws-cdk/core:newStyleStackSynthesis' context key.`);
    }

    this.artifact = props.artifact;

    const actionRole = roleFromPlaceholderArn(scope, props.artifact.assumeRoleArn);
    const cloudFormationExecutionRole = roleFromPlaceholderArn(scope, props.artifact.cloudFormationExecutionRoleArn);
    const region = props.artifact.environment.region;

    this.prepareRunOrder = props.baseRunOrder ?? 1;
    this.executeRunOrder = this.prepareRunOrder + 1;
    this.stackName = props.stackName ?? props.artifact.stackName;
    const baseActionName = props.baseActionName ?? this.stackName;
    const changeSetName = props.changeSetName ?? 'PipelineChange';
    const actionRegion = region === Stack.of(scope).region || region === cxapi.UNKNOWN_REGION ? undefined : region;

    // We need the path of the template relative to the root Cloud Assembly
    // It should be easier to get this, but for now it is what it is.
    const appAsmRoot = appOutDir(scope.node.root  as App);
    const fullTemplatePath = path.join(props.artifact.assembly.directory, props.artifact.templateFile);
    const relativePath = path.relative(appAsmRoot, fullTemplatePath);

    this.prepareChangeSetAction = new cpactions.CloudFormationCreateReplaceChangeSetAction({
      actionName: `${baseActionName}.Prepare`,
      changeSetName,
      runOrder: this.prepareRunOrder,
      stackName: this.stackName,
      templatePath: props.cloudAssemblyInput.atPath(relativePath),
      adminPermissions: false,
      role: actionRole,
      deploymentRole: cloudFormationExecutionRole,
      region: actionRegion,
      capabilities: [cfn.CloudFormationCapabilities.NAMED_IAM, cfn.CloudFormationCapabilities.AUTO_EXPAND],
    });
    this.executeChangeSetAction = new cpactions.CloudFormationExecuteChangeSetAction({
      actionName: `${baseActionName}.Deploy`,
      changeSetName,
      runOrder: this.executeRunOrder,
      stackName: this.stackName,
      role: actionRole,
      region: actionRegion,
      outputFileName: props.outputFileName,
      output: props.output,
    });
  }

  public bind(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
      codepipeline.ActionConfig {
    stage.addAction(this.prepareChangeSetAction);

    return this.executeChangeSetAction.bind(scope, stage, options);
  }

  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    return this.executeChangeSetAction.onStateChange(name, target, options);
  }

  public get actionProperties(): codepipeline.ActionProperties {
    return this.executeChangeSetAction.actionProperties;
  }
}

function roleFromPlaceholderArn(scope: Construct, arn: string): iam.IRole;
function roleFromPlaceholderArn(scope: Construct, arn: string | undefined): iam.IRole | undefined;
function roleFromPlaceholderArn(scope: Construct, arn: string | undefined): iam.IRole | undefined {
  if (!arn) { return undefined; }

  // Use placeholdered arn as construct ID.
  const id = arn;

  // https://github.com/aws/aws-cdk/issues/7255
  let existingRole = scope.node.tryFindChild(`ImmutableRole${id}`) as iam.IRole;
  if (existingRole) { return existingRole; }
  // For when #7255 is fixed.
  existingRole = scope.node.tryFindChild(id) as iam.IRole;
  if (existingRole) { return existingRole; }

  return iam.Role.fromRoleArn(scope, id, cfnExpressionFromManifestString(arn), { mutable: false });
}

/**
 * Return a CloudFormation expression from a manifest string with placeholders
 */
function cfnExpressionFromManifestString(s: string) {
  // This implementation relies on the fact that the manifest placeholders are
  // '${AWS::Partition}' etc., and so are the same values as those that are
  // trivially substituable using a `Fn.sub`.
  return Fn.sub(s);
}

/**
 * Options for CdkDeployAction.fromStackArtifact
 */
export interface FromStackArtifactOptions {
  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * Run order for the 2 actions that will be created
   *
   * @default 1
   */
  readonly baseRunOrder?: number;

  /**
   * Artifact to write Stack Outputs to
   *
   * @default - No outputs
   */
  readonly output?: codepipeline.Artifact;

  /**
   * Filename in output to write Stack outputs to
   *
   * @default - Required when 'output' is set
   */
  readonly outputFileName?: string;
}