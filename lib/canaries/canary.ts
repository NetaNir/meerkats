import * as events from '@aws-cdk/aws-events';
import * as lambda from '@aws-cdk/aws-lambda';
import * as targets from '@aws-cdk/aws-events-targets';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import { Construct, Duration } from '@aws-cdk/core';
import * as path from 'path';

export interface CanaryProps {
  readonly url: string;
}

export class Canary extends Construct {
  constructor(scope: Construct, id: string, props: CanaryProps)  {
    super(scope, id);
    
    const canaryLambda = new lambda.Function(this, 'CanaryLambda', {
      handler: 'apiCanaryBlueprint.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset(path.resolve(__dirname, "./canary-lambda")),
      environment: {
        API_URL: props.url
      },
    });
    
    // create a cloudwatch event rule 
    const rule = new events.Rule(this, 'CanaryRule', {
      schedule: events.Schedule.expression('rate(10 minutes)'),
      targets: [ new targets.LambdaFunction(canaryLambda) ] 
    });
    
    // create a cloudwatch alarm based on the lambda erros metrics
    new cloudwatch.Alarm(this, 'CanaryAlarm', {
      metric: canaryLambda.metricErrors(),
      threshold: 0,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      period: Duration.minutes(5),
      alarmName: 'CanaryAlarm',
    });
  }
}