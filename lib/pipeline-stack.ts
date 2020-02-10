import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import *  as cdk from '@aws-cdk/core';


export class MyPipeline extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id);
        const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
        const dAction = new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
            actionName: 'deploy',

        })
        pipeline.addStage({
            stageName: 'beta',
            actions: [

            ]
        })
    }
}
