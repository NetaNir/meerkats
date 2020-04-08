import { Construct, ConstructNode, Stack } from "@aws-cdk/core";

export class ConstructDomain extends Construct {
  private locked = false;

  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  public lock() {
    ConstructNode.prepare(this.node);
    this.locked = true;

    // COMPLICATION: Make sure that no construct in this subtree prepare()s twice.
    for (const construct of this.node.findAll()) {
      (construct as any).prepare = nop;
      (construct as any).node._aspects = [];
    }

    function nop() { /* Empty on purpose */ }
  }

  public get stacks(): Stack[] {
    if (!this.locked) {
      throw new Error('Lock me first');
    }
    return this.node.findAll().filter(Stack.isStack);
  }
}