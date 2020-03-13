import { IAspect, IConstruct, Stack, CfnResource, CfnOutput, Construct } from "@aws-cdk/core";
import { BaseLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { Integration } from '@aws-cdk/aws-apigateway';
import { Canary } from "../canaries/canary";
import { CdkStage } from "../proposed_api/cdk-pipeline";

export class CanaryAspect implements IAspect {
  _canaryStack: Stack;

  constructor(private readonly scope: Construct, private readonly stage: CdkStage) {}

  public visit(node: IConstruct): void {
    if (Stack.isStack(node)) {
      const children = node.node.children;
      children.forEach( ch => {
        // we can add more types here, APIGateway etc.
        if (ch instanceof BaseLoadBalancer) { 
          new Canary(this.canaryStack, `Canary-${ch.node.uniqueId}`, {
            url: ch.loadBalancerDnsName
          });
          (node as Stack).addDependency(this.canaryStack);
        }
      })
    }
  }

  get canaryStack(): Stack {
    if (this._canaryStack === undefined) {
      // TODO sanitize stage name
      let stackname = this.stage.stageName.replace(/_/g, '-');
      // Where will we create the canary stack? temporaraly creating it in the pipeline account 
      this._canaryStack = new Stack(this.scope, `CanaryStack-${stackname}`, {
        env: {
          account: '355421412380',
          region: 'us-east-1'
        }
      });
    }
    return this._canaryStack; 
  }
}