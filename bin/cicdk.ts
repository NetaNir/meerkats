#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import 'source-map-support/register';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();


new PipelineStack(app, 'MeertkatsCodePipelineStack', {
  env: { 
    region: 'us-west-2',
    account: '355421412380'
  },
});

app.synth();
