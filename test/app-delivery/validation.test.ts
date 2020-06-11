import { arrayWith, deepObjectLike, objectLike } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { CfnOutput, Construct, Stack, Stage, StageProps } from '@aws-cdk/core';
import * as appdelivery from '../../lib/app-delivery';
import { anything, encodedJson, stringLike } from './testmatchers';
import { BucketStack, PIPELINE_ENV, stackTemplate, TestApp, TestGitHubNpmPipeline } from './testutil';

let app: TestApp;
let pipelineStack: Stack;
let pipeline: appdelivery.AppDeliveryPipeline;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  pipeline = new TestGitHubNpmPipeline(pipelineStack, 'AppDelivery');
});

afterEach(() => {
  app.cleanup();
});

test('can use stack outputs as validation inputs', () => {
  // GIVEN
  const stage = new AppWithStackOutput(app, 'MyApp');

  // WHEN
  pipeline.addApplicationStage(stage, {
    validations: [
      appdelivery.Validation.shellScript({
        name: 'TestOutput',
        useOutputs: {
          BUCKET_NAME: pipeline.stackOutput(stage.output),
        },
        commands: ['echo $BUCKET_NAME'],
      })
    ],
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
    Stages: arrayWith({
      Name: 'MyApp',
      Actions: arrayWith(
        deepObjectLike({
          Name: 'Stack.Deploy',
          OutputArtifacts: [{ Name: anything() }],
          Configuration: {
            OutputFileName: 'outputs.json',
          },
        }),
        deepObjectLike({
          ActionTypeId: {
            Provider: "CodeBuild",
          },
          Configuration: {
            ProjectName: anything(),
          },
          InputArtifacts: [{ Name: anything() }],
          Name: 'TestOutput',
        })
      ),
    }),
  });

  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        phases: {
          build: {
            commands: [
              'set -eu',
              'export BUCKET_NAME="$(node -pe \'require(process.env.CODEBUILD_SRC_DIR + "/outputs.json")["BucketName"]\')"',
              'echo $BUCKET_NAME',
            ],
          },
        },
      })),
      Type: "CODEPIPELINE"
    },
  });
});

class AppWithStackOutput extends Stage {
  public readonly output: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new BucketStack(this, 'Stack');

    this.output = new CfnOutput(stack, 'BucketName', {
      value: stack.bucket.bucketName
    });
  }
}