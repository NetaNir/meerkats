#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { WebServiceStack } from '../lib/web-service-stack';
import { WebServicePipelineStack } from '../lib/webservice-pipeline-stack';

const app = new App();

new WebServiceStack(app, 'WebService', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new WebServicePipelineStack(app, 'PipelineStack', {
  env: { account: 'ACCOUNT1', region: 'us-east-2' },
});

app.synth();