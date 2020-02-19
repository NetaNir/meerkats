# Meerkats: a reference app for CI/CD

## How to use

```
$ yarn install
$ yarn build
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap
$ npx cdk deploy -e MeertkatsCodePipelineStack
```

If you see the following error:

```
CREATE_FAILED        | AWS::CodePipeline::Pipeline | Pipeline/Pipeline (Pipeline9850B417) Internal Failure
```

You must follow the GitHub OAuth workflow in your console first
(go to the Console > CodePipeline > Create Pipeline, put in something
until you get to Source, select a GitHub source, click Connect to GitHub,
follow the OAuth flow and then cancel out of the Create Pipeline workflow).


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
