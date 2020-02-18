# Meerkats: a reference app for CI/CD

## How to use

```
$ yarn install
$ yarn build
$ npx cdk deploy -e MeertkatsCodePipelineStack
```

To run this against a custom branch of the `aws-cdk` repo, do the following:

```
$ yarn install
$ ./link2lerna /path/to/aws-cdk
# ... Use as usual
```

## TODO

- Automatic dependency selection: `cdk deploy MeertkatsCodePipelineStack` automatically
  includes the DDB stack. That is probably not intended?
