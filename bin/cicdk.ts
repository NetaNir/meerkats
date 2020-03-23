#!/usr/bin/env node
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyPipelineStack } from '../lib/my-pipeline-stack';
import { App } from '../lib/proposed_api/app';

const app = new App();

new MyApplication(app, 'DevApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  prefix: 'Dev',
});

const pipeline = new MyPipelineStack(app, 'MeertkatsCodePipelineStack', {
  env: { account: '355421412380', region: 'us-west-2' },
});

pipeline.addStage('beta_a1_UsWest2', new MyApplication(app, 'Beta', {
  prefix: 'beta_a1_UsWest2',
  env: { account: '355421412380', region: 'us-west-2' }
}));

pipeline.addStage('gamma_a1_EuWest1', new MyApplication(app, 'Gamma', {
  prefix: 'gamma_a1_EuWest1',
  env: { account: '355421412380', region: 'eu-west-1' },
}));

pipeline.addStage('prod_a2_UsEast2', new MyApplication(app, 'Prod1', {
  prefix: 'prod_a2_UsEast2',
  env: { account: '561462023695', region: 'us-east-2' },
}));

app.synth();