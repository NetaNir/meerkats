import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cpactions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { ICdkBuild } from "./cdk-build";
import { DeployCdkStackAction } from "./deploy-cdk-stack-action";
import { IValidation } from './validation';
import { PublishAssetsAction } from './publish-assets-action';

export interface CdkPipelineProps {
  readonly source: codepipeline.IAction;

  readonly build: ICdkBuild;

  readonly pipelineName?: string;

  readonly artifactBucket?: s3.IBucket;
}

export class CdkPipeline extends cdk.Construct {
  public readonly cloudAssemblyArtifact: codepipeline.Artifact;

  private readonly pipeline: codepipeline.Pipeline;

  constructor(scope: cdk.Construct, id: string, props: CdkPipelineProps) {
    super(scope, id);

    this.cloudAssemblyArtifact = new codepipeline.Artifact();

    const sourceOutput = props.source.actionProperties.outputs![0];
    const buildConfig = props.build.bind(this, { sourceOutput, cloudAssemblyArtifact: this.cloudAssemblyArtifact });

    const pipelineStack = cdk.Stack.of(this);
    const selfMutationProject = new codebuild.PipelineProject(this, 'CdkPipelineSelfMutation', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: 'npm install', // ToDo: interesting relationship between this, and the build step!
          },
          build: {
            commands: [
              'npm run build', // ToDo: here as well!
              `npm run cdk -- deploy ${pipelineStack.stackName} -e --require-approval=never --verbose`,
            ],
          },
        },
      }),
    });
    const pipelineBootstrapStackActionRole = iam.Role.fromRoleArn(this, 'PipelineBootstrapStackActionRole',
        `arn:${pipelineStack.partition}:iam::${pipelineStack.account}:role/cdk-bootstrap-deploy-action-role-` +
        `${pipelineStack.account}-${pipelineStack.region}`);
    // allow the self-mutating project permissions to assume the bootstrap Action role
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: [pipelineBootstrapStackActionRole.assumeRoleAction],
      resources: [pipelineBootstrapStackActionRole.roleArn],
    }));
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DescribeStacks'],
      resources: ['*'], // this is needed to check the status of the bootstrap stack when doing `cdk deploy`
    }));
    // S3 checks for the presence of the ListBucket permission
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: ['*'],
    }));

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
          actions: [
            new cpactions.CodeBuildAction({
              actionName: 'Self_Mutate',
              input: sourceOutput,
              project: selfMutationProject,
            }),
          ],
        },
        {
          stageName: 'Assets',
          actions: [new PublishAssetsAction(this, 'PublishAssets', {
            cloudAssemblyInput: buildConfig.cdkBuildOutput,
            // hack hack for experimentation
            vendoredGitHubLocation: `https://github.com/NetaNir/meerkats/archive/${process.env.BRANCH || 'master'}.zip`,
            vendorZipDir: `meerkats-${process.env.BRANCH || 'master'}/vendor`,
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

export interface CdkStageOptions {
  readonly stageName: string;
  readonly stacks: CdkStack[];
  readonly validations?: IValidation[];
}

export interface CdkStack {
  /**
   * Stack to deploy
   */
  readonly stack: cdk.Stack;

  /**
   * Store the outputs in this artifact if given
   *
   * Filename: 'outputs.json'
   */
  readonly outputsArtifact?: codepipeline.Artifact;
}
