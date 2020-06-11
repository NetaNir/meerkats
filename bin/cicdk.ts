#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyPipelineStack } from '../lib/my-pipeline-stack';

const app = new App();

new MyApplication(app, 'Dev', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const pipeline = new MyPipelineStack(app, 'PipelineStack', {
  env: { account: '355421412380', region: 'eu-west-1' },
});

pipeline.addApplicationStage(new MyApplication(app, 'Beta', {
  env: { account: '355421412380', region: 'eu-west-1' },
}));

pipeline.addApplicationStage(new MyApplication(app, 'Gamma', {
  env: { account: '561462023695', region: 'us-east-2' },
}));

app.synth();