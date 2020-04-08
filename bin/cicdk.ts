#!/usr/bin/env node
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyPipelineStack } from '../lib/my-pipeline-stack';
import { App } from '../lib/proposed_api/app';

const app = new App();

new MyApplication(app, 'DevApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

app.synth();