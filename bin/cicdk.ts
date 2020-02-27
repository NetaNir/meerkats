#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { APIGWStack } from '../lib/agigw-stack';
import { DDBStack } from '../lib/ddb-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

const ddbStack = new DDBStack(app, 'Meerkats-DDBStack', {
  env: { region: 'us-west-1' },
});
const apiGwStack = new APIGWStack(app, 'Meerkats-APIGWStack', {
  env: { region: 'us-west-1' },
  table: ddbStack.table
});

new PipelineStack(app, 'MeertkatsCodePipelineStack', {
  ddbStack,
  apiGwStack,
});

app.synth();