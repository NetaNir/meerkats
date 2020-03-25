import * as cfn from '@aws-cdk/aws-cloudformation';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cpactions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';

export interface DeployCdkStackActionProps {
  readonly baseActionName: string;

  /**
   * The CDK stack to be deployed.
   */
  readonly stack: cdk.Stack;

  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly input: codepipeline.Artifact;

  readonly baseRunOrder?: number;

  readonly output?: codepipeline.Artifact;

  readonly outputFileName?: string;
}

export class DeployCdkStackAction implements codepipeline.IAction {
  private static readonly ACTION_ROLE_ID = 'CfnActionRole';
  private static readonly DEPLOY_ROLE_ID = 'CfnExecRole';

  /** @internal */
  public readonly _createChangeSetRunOrder: number;
  /** @internal */
  public readonly _stack: cdk.Stack;

  private readonly prepareChangeSetAction: cpactions.CloudFormationCreateReplaceChangeSetAction;
  private readonly executeChangeSetAction: cpactions.CloudFormationExecuteChangeSetAction;

  constructor(scope: cdk.Construct, props: DeployCdkStackActionProps) {
    this._stack = props.stack;

    const deployConfig = props.stack.deploymentEnvironment.stackDeploymentConfig(cdk.ConfigVariant.CLOUDFORMATION);
    if (!deployConfig.assumeRoleArn) {
      // tslint:disable-next-line:max-line-length
      throw new Error(`DeploymentEnvironment of stack '${props.stack.node.id}' must supply deployment Role ARNs; use ConventionMode deployment environment.`);
    }

    // the bootstrap roles
    // COMPLICATION: we can't create them under the target Stacks anymore because
    // those are immutable now, so we need a scope to create them.
    const actionRole = this.getActionRole(scope, DeployCdkStackAction.ACTION_ROLE_ID, deployConfig.assumeRoleArn);
    const cfnDeployRole = this.getActionRole(scope, DeployCdkStackAction.DEPLOY_ROLE_ID, deployConfig.cloudFormationExecutionRoleArn);

    const actionRegion = this.determineActionsRegion(props);

    this._createChangeSetRunOrder = props.baseRunOrder ?? 1;
    const executeChangeSetRunOrder = this._createChangeSetRunOrder + 1;

    const changeSetName = 'cs1'; // ToDo change this
    this.prepareChangeSetAction = new cpactions.CloudFormationCreateReplaceChangeSetAction({
      actionName: `${props.baseActionName}.Prepare`,
      changeSetName,
      runOrder: this._createChangeSetRunOrder,
      stackName: this._stack.stackName,
      templatePath: props.input.atPath(this._stack.templateFile),
      adminPermissions: false,
      role: actionRole,
      deploymentRole: cfnDeployRole,
      region: actionRegion,
      capabilities: [cfn.CloudFormationCapabilities.NAMED_IAM, cfn.CloudFormationCapabilities.AUTO_EXPAND],
    });
    this.executeChangeSetAction = new cpactions.CloudFormationExecuteChangeSetAction({
      actionName: `${props.baseActionName}.Deploy`,
      changeSetName,
      runOrder: executeChangeSetRunOrder,
      stackName: this._stack.stackName,
      role: actionRole,
      region: actionRegion,
      outputFileName: props.outputFileName,
      output: props.output,
    });
  }

  public bind(scope: cdk.Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
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

  private getActionRole(scope: cdk.Construct, envRoleType: string, arn: string | undefined): iam.IRole | undefined {
    if (!arn) { return undefined; }

    const id = [envRoleType,
      cdk.Token.isUnresolved(this._stack.region) ? this._stack.region : 'REGION',
      cdk.Token.isUnresolved(this._stack.account) ? this._stack.account : 'ACCOUNT',
    ].join('-');

    const existingRole = scope.node.tryFindChild(id) as iam.IRole;
    return existingRole
      ? existingRole
      : iam.Role.fromRoleArn(scope, id, arn, { mutable: false });
  }

  private determineActionsRegion(props: DeployCdkStackActionProps): string | undefined {
    return cdk.Token.isUnresolved(props.stack.region) ? undefined : props.stack.region;
  }
}
