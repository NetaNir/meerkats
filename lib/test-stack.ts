import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';


export interface APGWTestSatckProps extends cdk.StackProps {
    readonly url: string; 
    readonly expectedResponse: {}
}
export class APGWTestSatck extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }
}