#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { PipelineStack } from '../lib/pipeline-stack';
import { DDBStack } from '../lib/ddb-stack';
import { APIGWStack } from '../lib/agigw-stack';

const app = new cdk.App();

const ddbStack = new DDBStack(app, `Dev-Meerkats-DDBStack`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
new APIGWStack(app, `Dev-Meerkats-APIGWStack`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  table: ddbStack.table,
  cluster: ddbStack.cluster,
});

new PipelineStack(app, 'MeertkatsCodePipelineStack', {
  env: {
    region: 'us-west-2',
    account: '355421412380'
  },
});

app.synth();
