#!/usr/bin/env node
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyIntegTest } from '../lib/my-integ-test';
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

const betaApp = new MyApplication(app, 'Beta', {
  prefix: 'beta_a1_UsWest2',
  env: { account: '355421412380', region: 'us-west-2' }
});
const betaStage = pipeline.addStage('beta_a1_UsWest2', betaApp);
betaStage.addValidations(new MyIntegTest('beta', betaApp));

const gammaApp = new MyApplication(app, 'Gamma', {
  prefix: 'gamma_a1_EuWest1',
  env: { account: '355421412380', region: 'eu-west-1' },
});
const gammaStage = pipeline.addStage('gamma_a1_EuWest1', gammaApp);
gammaStage.addValidations(new MyIntegTest('gamma', gammaApp));

const prodApp = new MyApplication(app, 'Prod1', {
  prefix: 'prod_a2_UsEast2',
  env: { account: '561462023695', region: 'us-east-2' },
});
const prodStage = pipeline.addStage('prod_a2_UsEast2', prodApp);
prodStage.addValidations(new MyIntegTest('prod', prodApp));

app.synth();