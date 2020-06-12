import { arrayWith, deepObjectLike } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { Stack } from '@aws-cdk/core';
import * as appdelivery from '../../lib/app-delivery';
import { encodedJson } from './testmatchers';
import { PIPELINE_ENV, TestApp, TestGitHubNpmPipeline } from './testutil';

let app: TestApp;
let pipelineStack: Stack;

beforeEach(() => {
  app = new TestApp({ outdir: 'testcdk.out', });
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
});

afterEach(() => {
  app.cleanup();
});

test.each([['npm'], ['yarn']])('%s build automatically determines artifact base-directory', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'AppDelivery', {
    build: npmYarnBuild(npmYarn)(),
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        artifacts: {
          'base-directory': 'testcdk.out',
        },
      })),
    },
  });
});

test.each([['npm'], ['yarn']])('%s build respects subdirectory', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'AppDelivery', {
    build: npmYarnBuild(npmYarn)({
      subdirectory: 'subdir',
    }),
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        phases: {
          pre_build: {
            commands: arrayWith('cd subdir'),
          },
        },
        artifacts: {
          'base-directory': 'subdir/testcdk.out',
        },
      })),
    },
  });
});

function npmYarnBuild(npmYarn: string) {
  if (npmYarn === 'npm') { return appdelivery.CdkBuild.standardNpmBuild; }
  if (npmYarn === 'yarn') { return appdelivery.CdkBuild.standardYarnBuild; }
  throw new Error(`Expecting npm|yarn: ${npmYarn}`);
}