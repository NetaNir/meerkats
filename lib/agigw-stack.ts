import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as elb_targets from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import * as ddb from '@aws-cdk/aws-dynamodb';

export interface APIGWStackProps extends cdk.StackProps {
  readonly table: ddb.Table;
  readonly cluster: ecs.ICluster;
}

export class APIGWStack extends cdk.Stack {
  public static readonly URL_OUTPUT = 'MeerkatApiGwUrlOutput';

  public readonly handler: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: APIGWStackProps) {
    super(scope, id, props);

    // Lambda Handler
    this.handler = new lambda.Function(this, 'MeerkatLambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'meerkat-lambda.handler',
      code: lambda.Code.fromAsset(path.resolve(__dirname, "./lambda")),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
      description: 'Fake description to force a redeploy of the stack.',
    });
    props.table.grantFullAccess(this.handler);


    // Fargate Service
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256
    });

    const container = taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', 'container')),
    });

    container.addPortMappings({
      containerPort: 8000,
      protocol: ecs.Protocol.TCP
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster: props.cluster,
      taskDefinition,
    });

    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', { vpc: props.cluster.vpc, internetFacing: true });
    const listener = lb.addListener('PublicListener', { port: 80, open: true });

    // Default to Lambda
    listener.addTargets('Lambda', {
      targets: [new elb_targets.LambdaTarget(this.handler)]
    });
    // Additionally route to container
    listener.addTargets('Fargate', {
      port: 8000,
      pathPattern: '/container',
      priority: 10,
      targets: [service]
    });


    // add an output with a well-known name to read it from the integ tests
    new cdk.CfnOutput(this, APIGWStack.URL_OUTPUT, {
      value: `http://${lb.loadBalancerDnsName}/`,
    });
  }
}
