import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import Cicdk = require('../lib/cicdk-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Cicdk.CicdkStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
