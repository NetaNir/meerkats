# CDK Pipelines

A construct library for painless Continuous Delivery of CDK applications.

![Developer Preview](https://img.shields.io/badge/developer--preview-informational.svg?style=for-the-badge)

> This module is in **developer preview**. We may make breaking changes to address unforeseen API issues. Therefore, these APIs are not subject to [Semantic Versioning](https://semver.org/), and breaking changes will be announced in release notes. This means that while you may use them, you may need to update your source code when upgrading to a newer version of this package.

## At a glance

Defining a pipeline for your application is as simple as defining a subclass
of `Stage`, and calling `pipeline.addApplicationStage()` with instances of
that class. Deploying to a different account or region looks exactly the
same, the *CDK Pipelines* library takes care the differences.

```ts
import { Construct, Stage } from '@aws-cdk/core';

/**
 * Your application
 *
 * May consist of one or more Stacks
 */
class MyApplication extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const dbStack = new DatabaseStack(this, 'Database');
    new ComputeStack(this, 'Compute', {
      table: dbStack.table,
    });
  }
}

/**
 * Stack to hold the pipeline
 */
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      // ...source and build information here (see below)
    });

    // Do this as many times as necessary with any account and region
    // Account and region may different from the pipeline's.
    pipeline.addApplicationStage(new MyApplication(this, 'Prod', {
      env: {
        account: '123456789012',
        region: 'eu-west-1',
      }
    }));
  }
}
```

The pipeline is **self-mutating**, which means that if you add new
application stages in the source code, or new stacks to `MyApplication`, the
pipeline will automatically reconfigure itself to deploy those new stages and
stacks.

## CDK Versioning

This library requires exactly CDK version `1.45.0`. The rest of your application must
use the same version.

It uses prerelease features of the CDK framework, which can be enabled by adding the
following to `cdk.json`:

```
{
  ...
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

When bootstrapping, the environment variable `CDK_NEW_BOOTSTRAP=1` should be
set (see the section called **CDK Bootstrapping**).

## Defining the Pipeline (Source and Build)

The pipeline is defined by instantiating `CdkPipeline` in a Stack. This defines the
source location for the pipeline as well as the build. For example, the following
defines a pipeline whose source is stored in a GitHub repository, and uses NPM
to build. The Pipeline will be provisioned in account `111111111111` and region
`eu-west-1`:

```ts
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',

      source: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: new codepipeline.Artifact(),
        oauthToken: SecretValue.secretsManager('GITHUB_TOKEN_NAME'),
        trigger: codepipeline_actions.GitHubTrigger.POLL,
        // Replace these with your actual GitHub project name
        owner: 'OWNER',
        repo: 'REPO',
      }),

      build: CdkBuild.standardNpmBuild({
        // Customize the build here...
      }),
    });
  }
}

const app = new App();
new MyPipelineStack(this, 'PipelineStack', {
  env: {
    account: '111111111111',
    region: 'eu-west-1',
  }
});
```

You provision this pipeline by making sure the target environment has been
bootstrapped (see below), and then executing `cdk deploy PipelineStack`
*once*. Afterwards, the pipeline will keep itself up-to-date.

> **Important**: be sure to `git commit` and `git push` before deploying the
> Pipeline stack using `cdk deploy`!
>
> The reason is that the pipeline will start deploying and self-mutating
> right away based on the sources in the repository, so the sources it finds
> in there should be the ones you want it to find.

### Sources

Any of the regular sources from the `@aws-cdk/aws-codepipeline-actions` module can be used.

#### GitHub

If you want to use a GitHub repository as the source, you must also create:

* A [GitHub Access Token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line)
* A [Secrets Manager PlainText Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_create-basic-secret.html)
  with the value of the **GitHub Access Token**. Pick whatever name you want
  (for example `github-token`) and pass it as the argument of `oauthToken`.

### Builds

You define how to build the project by specifying a `CdkBuild`. The following builds
are available:

* `CdkBuild.standardNpmBuild()`: build using NPM conventions. Expects a `package-lock.json`,
  a `cdk.json`, and expects the CLI to be a versioned dependency in `package.json`. The
  source repository does not need to have a `buildspec.yml`.
* `CdkBuild.standardYarnBuild()`: build using Yarn conventions. Expects a `yarn.lock`
  a `cdk.json`, and expects the CLI to be a versioned dependency in `package.json`. The
  source repository does not need to have a `buildspec.yml`.
* `CdkBuild.buildSpecBuild()`: build using a freeform buildspec, which can be given
  either in the source repository or in the build pipeline.
* `CdkBuild.fromCodeBuildProject()`: build by invoking a custom defined
  CodeBuild project, if you need more control over the project setup.

## Adding Application Stages

To define an application that can be added to the pipeline integrally, define a subclass
of `Stage`. The `Stage` can contain one or more stack which make up your application. If
there are dependencies between the stacks, the stacks will automatically be added to the
pipeline in the right order. Stacks that don't depend on each other will be deployed in
parallel. You can add a dependency relationship between stacks by calling
`stack1.addDependency(stack2)`.

Stages take a default `env` argument which the Stacks inside the Stage will fall back to
if no `env` is defined for them.

An application is added to the pipeline by calling `addApplicationStage()` with instances
of the Stage. The same class can be instantiated and added to the pipeline multiple times
to define different stages of your DTAP or multi-region application pipeline:

```ts
// Testing stage
pipeline.addApplicationStage(new MyApplication(this, 'Testing', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));

// Acceptance stage
pipeline.addApplicationStage(new MyApplication(this, 'Acceptance', {
  env: { account: '222222222222', region: 'eu-west-1' }
}));

// Production stage
pipeline.addApplicationStage(new MyApplication(this, 'Production', {
  env: { account: '333333333333', region: 'eu-west-1' }
}));
```

### More Control

Every *Application Stage* added by `addApplicationStage()` will lead to the addition of
an individual *Pipeline Stage*, which is subsequently returned. You can add more
actions to the stage by calling `addCustomAction()` on it. For example:

```ts
const testingStage = pipeline.addApplicationStage(new MyApplication(this, 'Testing', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));

// Add a custom action -- in this case, a Manual Approval action
// (for illustration purposes: testingStage.addManualApprovalAction() is a
// convenience shorthand that does the same)
testingStage.addCustomAction(new ManualApprovalAction({
  actionName: 'ManualApproval',
  runOrder: testingStage.nextSequentialRunOrder(),
}));
```

You can also add more than one *Application Stage* to one *Pipeline Stage*. For example:

```ts
// Create an empty pipeline stage
const testingStage = pipeline.addStage('Testing');

// Add two application stages to the same pipeline stage
testingStage.addApplicationStage(new MyApplication1(this, 'MyApp1', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));
testingStage.addApplicationStage(new MyApplication2(this, 'MyApp2', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));
```

## Adding Validations

While you can always add custom actions to a pipeline stage to do anything you need
them to, there is special support for validation workflows in CDK Pipelines.

Validations are classes that inherit from `Validation`. Right now, CDK Pipelines comes with
the following pre-built validations:

* `Validation.shellScript()`: runs arbitrary shell commands in a CodeBuild project to validate
  the deployment.

### Using CloudFormation Stack Outputs

Because many CloudFormation deployments result in the generation of resources with unpredictable
names, validations have support for reading back CloudFormation Outputs after a deployment. This
makes it possible to pass (for example) the generated URL of a load balancer to the test set.

To use Stack Outputs, expose the `CfnOutput` object you're interested in, and call `pipeline.stackOutput()`
on it:

```ts
class MyLbApplication extends Stage {
  public readonly loadBalancerAddress: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const lbStack = new LoadBalancerStack(this, 'Stack');

    // Or create this in `LoadBalancerStack` directly
    this.loadBalancerAddress = new CfnOutput(lbStack, 'LbAddress', {
      value: `https://${lbStack.loadBalancer.loadBalancerDnsName}/`
    });
  }
}

const lbApp = new MyLbApplication(this, 'MyApp', {
  env: { /* ... */ }
});
const stage = pipeline.addApplicationStage(lbApp);
stage.addValidations(Validation.shellScript({
  // ...
  useOutputs: {
    // When the test is executed, this will make $URL contain the
    // load balancer address.
    URL: pipeline.stackOutput(lbApp.loadBalancerAddress),
  }
});
```

## CDK Bootstrapping

An *environment* is an *(account, region)* pair where you want to deploy a CDK
stack (see [Environments](https://docs.aws.amazon.com/cdk/latest/guide/environments.html)
in the CDK Developer Guide).

Before you can provision the pipeline, you have to *bootstrap* the environment you want
to create it in. If you are deploying your application to different environments, you
also have to bootstrap those and be sure to add a *trust* relationship.

To bootstrap an environment for provisioning the pipeline:

```
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    [--profile admin-profile-1] \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    aws://111111111111/us-east-1
```

To bootstrap a different environment for deploying CDK applications into using
a pipeline in account `111111111111`:

```
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    [--profile admin-profile-2] \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    --trust 11111111111 \
    aws://222222222222/us-east-2
```

These command lines explained:

* `npx`: means to use the CDK CLI from the current NPM install. If you are using
  a global install of the CDK CLI, leave this out.
* `--profile`: should indicate a profile with administrator privileges that has
  permissions to provision a pipeline in the indicated account. You can leave this
  flag out if either the AWS default credentials or the `AWS_*` environment
  variables confer these permissions.
* `--cloudformation-execution-policies`: ARN of the managed policy that future CDK
  deployments should execute with. You can tailor this to the needs of your organization
  and give more constrained permissions than `AdministratorAccess`.
* `--trust`: indicates which other account(s) should have permissions to deploy
  CDK applications into this account. In this case we indicate the Pipeline's account,
  but you could also use this for developer accounts (don't do that for production
  application accounts though!).
* `aws://222222222222/us-east-2`: the account and region we're bootstrapping.

> **Security tip**: we recommend that you use administrative credentials to an
> account only to bootstrap it and provision the initial pipeline. Otherwise,
> access to administrative credentials should be dropped as soon as possible.

### Migrating from old bootstrap stack

The bootstrap stack is a CloudFormation stack in your account named
**CDKToolkit** that provisions a set of resources required for the CDK
to deploy into that environment.

The "new" bootstrap stack (obtained by running `cdk bootstrap` with
`CDK_NEW_BOOTSTRAP=1`) is slightly more elaborate than the "old" stack. It
contains:

* An S3 bucket and ECR repository with predictable names, so that we can reference
  assets in these storage locations *without* the use of CloudFormation template
  parameters.
* A set of roles with permissions to access these asset locations and to execute
  CloudFormation, assumeable from whatever accounts you specify under `--trust`.

It is possible and safe to migrate from the old bootstrap stack to the new
bootstrap stack. This will create a new S3 file asset bucket in your account
and orphan the old bucket. You should manually delete the orphaned bucket
after you are sure you have redeployed all CDK applications and there are no
more references to the old asset bucket.

## Security Notes

Our CI/CD documentation should include the following security related topics:

Developers accounts are expected to be used only for development purposes and not contain customer data. Developers are expected to monitor these accounts to identify abuse or theft of compute resources.

Teams are expected to protect their source control systems to avoid such attacks.

Users are expected to maintain dependency hygiene and vet 3rd-party software they use.
Furthermore, users are able to utilize tools such as IAM permission boundaries in order to protect against accidental or intentional attacks at that level.

Administrators must adequately handle credentials.

## Troubleshooting

Here are some common errors you may encounter while using this library.

### Pipeline: Internal Failure

If you see the following error:

```
CREATE_FAILED  | AWS::CodePipeline::Pipeline | Pipeline/Pipeline
Internal Failure
```

There's something wrong with your GitHub access token. It might be missing, or not have the
right permissions to access the repository you're trying to access.

### Key: Policy contains a statement with one or more invalid principals

If you see the following error:

```
CREATE_FAILED | AWS::KMS::Key | Pipeline/Pipeline/ArtifactsBucketEncryptionKey
Policy contains a statement with one or more invalid principals.
```

One of the target (account, region) environments has not been bootstrapped
with the new bootstrap stack. Check your target environments and make sure
they are all bootstrapped.

## Current Limitations

Limitations that we are aware of and will address:

* **No context queries**: context queries are not supported. That means that
  Vpc.fromLookup() and other functions like it will not work.
* **Standard builds are TypeScript/JavaScript-only**: we currently only provide
  standard NPM or Yarn build steps. If you want to use a different build
  system, you’ll have to use `CdkBuild.buildSpecBuild()` or define your own
  custom subclass of `CdkBuild`.

## Known Issues

There are some usability issues that are caused by underlying technology, and
cannot be remedied by CDK at this point. They are reproduced here for completeness.

- **Console links to other accounts will not work**: the AWS CodePipeline
  console will assume all links are relative to the current account. You will
  not be able to use the pipeline console to click through to a CloudFormation
  stack in a different account.
- **If a change set failed to apply the pipeline must restarted**: if a change
  set failed to apply, it cannot be retried. The pipeline must be restarted from
  the top by clicking **Release Change**.
- **A stack that failed to create must be deleted manually**: if a stack
  failed to create on the first attempt, you must delete it using the
  CloudFormation console before starting the pipeline again by clicking
  **Release Change**.