import { MyApplication } from "./my-application";
import { ShellCommandsValidation } from "./proposed_api/validation";

export class MyIntegTest extends ShellCommandsValidation {
  constructor(name: string, app: MyApplication) {
    super({
      name: `IntegTest-${name}`,
      envVars: {
        API_GW_URL: app.urlOutput,
      },
      commands: [
        'set -e',
        // Root URL hits the Lambda
        'curl -Ssf $API_GW_URL',
        // '/container' hits the container
        'curl -Ssf $API_GW_URL/container',
      ]
    });
  }
}