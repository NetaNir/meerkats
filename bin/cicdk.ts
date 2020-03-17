#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { MyApplication } from '../lib/my-application';
import { MyPipelineStack } from '../lib/my-pipeline-stack';

const app = new cdk.App();

new MyApplication(app, 'DevApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  prefix: 'Dev',
});

new MyPipelineStack(app, 'MeertkatsCodePipelineStack', {
  env: {
    region: 'us-west-2',
    account: '355421412380'
  },
});

app.synth();