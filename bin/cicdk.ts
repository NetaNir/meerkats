#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { APIGWStack } from '../lib/agigw-stack';
import { DDBStack } from '../lib/ddb-stack';
import { VPCStack } from '../lib/vpc';

const app = new cdk.App();
const prod = {
    region: 'us-west-2',
    account: process.env.BETA_ACCOUNT
}

const vpcStack = new VPCStack(app, "VPCStack", {
    env: prod
});
const apigw = new APIGWStack(app, 'APIGWStack', {
    env: prod, 
    vpc: vpcStack.vpc
});
new DDBStack(app, 'DDBStack', {
    env: prod,
    grantRead: [ apigw.handler ]
});



