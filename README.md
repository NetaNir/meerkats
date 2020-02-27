# Meerkats: a reference app for CI/CD

## How to use

Make a personal GitHub access token and stick it in a fulltext SecretsManager
Secret with the name `my-github-token`, or set `GITHUB_TOKEN` to the name
of it.

```
$ yarn install --frozen-lockfile
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

## Vendored version of aws-cdk repo

This branch needs prerelease features from `aws-cdk` repo, and they need to be available in the CodeBuild project
as well. That's why we vendor in tarballs of the CDK repo into the current repo.

To update them with a newer version, do the following:

```
aws-cdk$ git checkout feat/convmode
aws-cdk$ yarn build   # Make sure everything you need has been built

...

meerkats$ yarn vendor-in /path/to/aws-cdk

# The next build will install the vendored deps.
```


## Debugging tip

This is pretty magical! Toggle "Debugger: Auto Attach" in VSCode,
and then *from the VSCode terminal* run:

```
env NODE_OPTIONS=--inspect-brk cdk deploy
```

Wuuuut!

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
