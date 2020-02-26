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

  constructor(props: DeployCdkStackActionProps) {
    this._stack = props.stack;

    // the bootstrap roles
    const actionRole = this.getActionRole(DeployCdkStackAction.ACTION_ROLE_ID, 'cdk-bootstrap-deploy-action-role');
    const cfnDeployRole = this.getActionRole(DeployCdkStackAction.DEPLOY_ROLE_ID, 'cdk-bootstrap-cfn-exec-role');

    this._createChangeSetRunOrder = props.baseRunOrder ?? 1;
    const executeChangeSetRunOrder = this._createChangeSetRunOrder + 1;

    const changeSetName = 'cs1'; // ToDo change this
    this.prepareChangeSetAction = new cpactions.CloudFormationCreateReplaceChangeSetAction({
      actionName: `${props.baseActionName}_Prepare_CS`,
      changeSetName,
      runOrder: this._createChangeSetRunOrder,
      stackName: this._stack.stackName,
      templatePath: props.input.atPath(this._stack.templateFile),
      adminPermissions: false,
      role: actionRole,
      deploymentRole: cfnDeployRole,
      capabilities: [cfn.CloudFormationCapabilities.NAMED_IAM, cfn.CloudFormationCapabilities.AUTO_EXPAND],
    });
    this.executeChangeSetAction = new cpactions.CloudFormationExecuteChangeSetAction({
      actionName: `${props.baseActionName}_Execute_CS`,
      changeSetName,
      runOrder: executeChangeSetRunOrder,
      stackName: this._stack.stackName,
      role: actionRole,
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

  private getActionRole(id: string, roleNamePrefix: string): iam.IRole {
    const existingRole = this._stack.node.tryFindChild(id) as iam.IRole;
    return existingRole
      ? existingRole
      : iam.Role.fromRoleArn(this._stack, id,
          `arn:aws:iam::${this._stack.account}:role/${roleNamePrefix}-${this._stack.account}-${this._stack.region}`, { mutable: false });
  }
}
