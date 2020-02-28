import { IAspect, IConstruct, App, Stack } from "@aws-cdk/core";
import { Watchful } from 'cdk-watchful';
import * as sqs from '@aws-cdk/aws-sqs';
import * as ddb from '@aws-cdk/aws-dynamodb';

export class WatchAspect implements IAspect {
  readonly app:App;
  _watchful: Watchful;

  constructor(scope: App) {
    this.app = scope;
  }

  public visit(node: IConstruct): void {
    if (node instanceof ddb.Table) {
      const dd = node as ddb.Table;
      this.watchful.watchDynamoTable('Meerkat table', dd);
    }
  }

  get watchful(): Watchful {
    if (this.watchful === undefined) {
      const stack = new Stack(this.app, 'watchful-Stack');
      const queue = new sqs.Queue(stack, 'watchful-queue');
      this._watchful = new Watchful(stack, 'watchful', {
        alarmSqs: queue.queueArn
      });
    }
    return this._watchful;
  } 

}