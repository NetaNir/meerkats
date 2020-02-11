#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { APIGWStack } from '../lib/agigw-stack';
import { DDBStack } from '../lib/ddb-stack';

const app = new cdk.App();

const apigw = new APIGWStack(app, 'APIGWStack');
new DDBStack(app, 'DDBStack', {
  grantRead: [apigw.handler]
});
