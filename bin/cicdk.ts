#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { APIGWStack } from '../lib/agigw-stack';
import { DDBStack } from '../lib/ddb-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

const apiGwStack = new APIGWStack(app, 'Meerkats-APIGWStack');
const ddbStack = new DDBStack(app, 'Meerkats-DDBStack', {
  grantRead: [apiGwStack.handler]
});

new PipelineStack(app, 'MeertkatsCodePipelineStack', {
  ddbStack,
  apiGwStack,
});

app.synth();