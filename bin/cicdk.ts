#!/usr/bin/env node
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyPipelineStack } from '../lib/my-pipeline-stack';
import { App } from '../lib/proposed_api/app';

const app = new App();

new MyApplication(app, 'DevApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const pipeline = new MyPipelineStack(app, 'PipelineStack', {
  env: { account: '355421412380', region: 'eu-west-1' },
});

pipeline.addStage(new MyApplication(app, 'Beta', {
  env: { account: '355421412380', region: 'eu-west-1' },
}));

pipeline.addStage(new MyApplication(app, 'Gamma', {
  env: { account: '561462023695', region: 'us-east-2' },
}));

app.synth();