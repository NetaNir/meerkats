# Meerkats: a reference app for CI/CD

## How to use

Make a personal GitHub access token and stick it in a fulltext SecretsManager
Secret with the name `my-github-token`, or set `GITHUB_TOKEN` to the name
of it.

```
$ yarn install
$ yarn build
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
$ (optional) export GITHUB_TOKEN=other-github-token-name
$ (optional) export BRANCH=other-branch-name
$ npx cdk deploy -e MeertkatsCodePipelineStack
```

If you see the following error:

```
CREATE_FAILED        | AWS::CodePipeline::Pipeline | Pipeline/Pipeline (Pipeline9850B417) Internal Failure
```

There's something wrong with your GitHub access token.

## Use with aws-cdk repo

To run this against a custom branch of the `aws-cdk` repo, do the following:

```
$ yarn install
$ ./link2lerna /path/to/aws-cdk
# ... Use as usual
```

## Debugging tip

This is pretty magical! Toggle "Debugger: Auto Attach" in VSCode,
and then *from the VSCode terminal* run:

```
env NODE_OPTIONS=--inspect-brk cdk deploy
```

Wuuuut!

## TODO

- Automatic dependency selection: `cdk deploy MeertkatsCodePipelineStack` automatically
  includes the DDB stack. That is probably not intended?

## ISSUES

- Retries:
    - ChangeSet cannot be retried, and a previous successful step cannot
    be retried either. Must restart whole pipeline to retry a failed step.
    - Stack that failed to create cannot be retried.
- Bootstrap:
    - Deploying the pipeline stack by hand will immediately start deploying
      the referenced GitHub repository, which by that point might not have the
      same source in it that you just deployed, so the pipeline might overwrite
      itself with something else!
