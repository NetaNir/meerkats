import { AppDeliveryStage, ShellScriptValidation } from "./app-delivery";

export class MyIntegTest extends ShellScriptValidation {
  constructor(name: string, stage: AppDeliveryStage) {
    super({
      name: `IntegTest-${name}`,
      useOutputs: {
        API_GW_URL: stage.stackOutputs('Application').output('URL'),
      },
      commands: [
        // Root URL hits the Lambda
        'curl -Ssf $API_GW_URL',
        // '/container' hits the container
        'curl -Ssf $API_GW_URL/container',
      ]
    });
  }
}