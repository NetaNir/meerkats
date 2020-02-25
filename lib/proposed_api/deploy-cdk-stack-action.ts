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

  private readonly stack: cdk.Stack;
  private readonly prepareChangeSetAction: cpactions.CloudFormationCreateReplaceChangeSetAction;
  private readonly executeChangeSetAction: cpactions.CloudFormationExecuteChangeSetAction;

  constructor(/** Eek! See below */ scope: cdk.Construct, props: DeployCdkStackActionProps) {
    this.stack = props.stack;

    // Warning: argument map up ahead
    //
    // We need a 'scope'
    //     BECAUSE - We MUST create the Actions in the constructor
    //         BECAUSE - actionProperties() will get called before bind() is called;
    //         AND     - I want to be able to forward that call to the inner Action.
    //             BECAUSE - copying details of the actionProperties() implementation to here feels wrong
    //     AND     - The Actions need an IRole
    //     AND     - The Roles need to be created in a scope
    //     AND     - the only other scope object we have ('props.stack') is not good enough
    //         BECAUSE - it will create a dependency between the pipeline stack and the application stack
    //             BECAUSE - I don't know why. This seems broken behavior, I don't think there's a good reason to do this.
    //         AND     - this dependency does not make sense since the pipeline will ultimately create the application stack

    const actionRole = this.getActionRole(scope, props.stack, DeployCdkStackAction.ACTION_ROLE_ID, 'cdk-bootstrap-deploy-action-role');
    const cfnDeployRole = this.getActionRole(scope, props.stack, DeployCdkStackAction.DEPLOY_ROLE_ID, 'cdk-bootstrap-cfn-exec-role');

    const createChangeSetRunOrder = props.baseRunOrder ?? 1;
    const executeChangeSetRunOrder = createChangeSetRunOrder + 1;

    const changeSetName = 'cs1'; // ToDo change this
    this.prepareChangeSetAction = new cpactions.CloudFormationCreateReplaceChangeSetAction({
      actionName: `${props.baseActionName}_Prepare_CS`,
      changeSetName,
      runOrder: createChangeSetRunOrder,
      stackName: this.stack.stackName,
      templatePath: props.input.atPath(this.stack.templateFile),
      adminPermissions: false,
      role: actionRole,
      deploymentRole: cfnDeployRole,
      capabilities: [cfn.CloudFormationCapabilities.NAMED_IAM, cfn.CloudFormationCapabilities.AUTO_EXPAND],
    });
    this.executeChangeSetAction = new cpactions.CloudFormationExecuteChangeSetAction({
      actionName: `${props.baseActionName}_Execute_CS`,
      changeSetName,
      runOrder: executeChangeSetRunOrder,
      stackName: this.stack.stackName,
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

  private getActionRole(scope: cdk.Construct, stack: cdk.Stack, prefix: string, roleNamePrefix: string): iam.IRole {
    // The action role will be unique per region/account, which we will use from the stack.
    const region = cdk.Token.isUnresolved(stack.region) ? 'current_region' : stack.region;
    const account = cdk.Token.isUnresolved(stack.account) ? 'current_account' : stack.account;

    const id = `${prefix}-${region}-${account}`;

    const existingRole = scope.node.tryFindChild(id) as iam.IRole;

    // Cannot use ARN as ID since it may contain ${AWS::Region} etc placeholders which WOULD have been
    // fine as placeholders but we have a blanket rule against tokens in construct IDs.
    return existingRole
      ? existingRole
      : iam.Role.fromRoleArn(scope, id,
          `arn:aws:iam::${this.stack.account}:role/${roleNamePrefix}-${this.stack.account}-${this.stack.region}`, { mutable: false });
  }
}
