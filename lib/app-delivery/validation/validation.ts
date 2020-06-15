import { Construct } from '@aws-cdk/core';
import { AppDeliveryStage } from '../stage';
import { ShellScriptValidation, ShellScriptValidationProps } from './shell-script';

export abstract class Validation {
  public static shellScript(props: ShellScriptValidationProps) {
    return new ShellScriptValidation(props);
  }

  public abstract bind(scope: Construct, stage: AppDeliveryStage): void;
}