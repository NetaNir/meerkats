import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { Construct } from '@aws-cdk/core';

export interface PublishAssetsActionProps {
  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * GitHub location where to retrieve ZIP with vendored NPM packages
   */
  readonly vendoredGitHubLocation: string;

  /**
   * Dir in the zip with vendored NPM packages
   */
  readonly vendorZipDir: string;
}

export class PublishAssetsAction extends Construct implements codepipeline.IAction {
  private readonly action: codepipeline.IAction;

  constructor(scope: Construct, id: string, private readonly props: PublishAssetsActionProps) {
    super(scope, id);

    const project = new codebuild.PipelineProject(scope, 'Default', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            // tslint:disable-next-line:max-line-length
            commands: `(curl -o dl.zip -L "${this.props.vendoredGitHubLocation}" && unzip dl.zip && cd ${this.props.vendorZipDir} && npm install -g *.tgz)`,
          },
          build: {
            commands: 'for manifest in *.assets.json; do cdk-assets --path $manifest --verbose publish; done',
          },
        },
      }),
    });

    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: ['arn:*:iam::*:role/*-publishing-role-*'],
    }));

    this.action = new codepipeline_actions.CodeBuildAction({
      actionName: 'Publish',
      project,
      input: this.props.cloudAssemblyInput,
    });
  }

  public bind(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
      codepipeline.ActionConfig {
    return this.action.bind(scope, stage, options);
  }

  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    return this.action.onStateChange(name, target, options);
  }

  public get actionProperties(): codepipeline.ActionProperties {
    // FIXME: I have had to make this class a Construct, because:
    //
    // - It needs access to the Construct tree, because it is going to add a `PipelineProject`.
    // - I would have liked to have done that in bind(), however,
    // - `actionProperties` (this method) is called BEFORE bind() is called, and by that point I
    //   don't have the "inner" Action yet to forward the call to.
    //
    // I've therefore had to construct the inner CodeBuildAction in the constructor, which requires making this
    // Action a Construct.
    //
    // Combined with how non-intuitive it is to make the "StackDeployAction", I feel there is something
    // wrong with the Action abstraction here.
    return this.action.actionProperties;
  }
}