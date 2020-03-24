import { IAspect, IConstruct, Stack, CfnResource, CfnOutput, Construct, Environment } from "@aws-cdk/core";
import { BaseLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { Canary } from "../canaries/canary";
import { Table } from "@aws-cdk/aws-dynamodb";

export class CanaryAspect implements IAspect {

  constructor(private readonly scope: Construct, private readonly env: Environment) {}
  
  public visit(node: IConstruct): void {
    // we can add more types here, APIGateway etc.
    if (node instanceof BaseLoadBalancer) { 
      const stack = this.getCanaryStack(node);
      new Canary(stack, `Canary-${node.node.uniqueId}`, {
        url: node.loadBalancerDnsName
      });
    }
    if (node instanceof Table) { 
      const stack = this.getCanaryStack(node);
      new Canary(stack, `Canary-${node.node.uniqueId}`, {
        url: node.tableName
      });
    }
  }
  
  getCanaryStack(node: IConstruct): Stack {
    let suffix = this.scope.node.uniqueId;
    // verify the satck has not been created in the scope
    const stackNode = this.scope.node.tryFindChild(`CanaryStack-${suffix}`);
    if (stackNode) {
      return (stackNode as Stack);
    }
    return new Stack(this.scope, `CanaryStack-${suffix}`, {
      env: this.env
    });
  }
  
}