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

## TODO

- Automatic dependency selection: `cdk deploy MeertkatsCodePipelineStack` automatically
  includes the DDB stack. That is probably not intended?
- Retries:
    - ChangeSet cannot be retried, and a previous successful step cannot
    be retried either. Must restart whole pipeline to retry a failed step.
    - Stack that failed to create cannot be retried.
