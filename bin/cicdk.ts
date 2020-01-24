#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CicdkStack } from '../lib/cicdk-stack';

const app = new cdk.App();
new CicdkStack(app, 'CicdkStack');
