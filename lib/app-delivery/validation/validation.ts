import codepipeline = require('@aws-cdk/aws-codepipeline');
import { CfnOutput, Construct } from '@aws-cdk/core';
import { AppDeliveryStage } from '../stage';
import { ShellScriptValidation, ShellScriptValidationProps } from './shell-script';

export interface IValidation {
  bind(scope: Construct, stage: AppDeliveryStage): void;
}

export abstract class Validation {
  public static shellScript(props: ShellScriptValidationProps) {
    return new ShellScriptValidation(props);
  }
}